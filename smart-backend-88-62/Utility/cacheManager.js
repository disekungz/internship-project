// ==========================================
// 🚀 High-Performance Multi-Tier Cache Manager (Stale-While-Revalidate & Immutable Caching)
// Tier 1: In-Memory Map (0 ms instant response)
// Tier 2: Persistent Disk Cache (Survives server restarts)
// 
// Policy:
// 1. Past Months (Jan - Aug): Immutable / Long-lived Cache (Permanent in Memory & Disk)
//    - Auto-revalidated if forced (?refresh=1) or when data mutations occur (POST/PUT/DELETE)
// 2. Current Month (Sep): Stale-While-Revalidate (SWR)
//    - Returns cached data instantly (0 ms)
//    - Background revalidation every 15-30 seconds if stale
// ==========================================

const { readPersistentCache, writePersistentCache, removePersistentCache, removePersistentCachePattern } = require('./persistentCache.js');

const memoryStore = new Map();
const inFlightRevalidations = new Set();

const CURRENT_MONTH_STALE_TTL_MS = 20 * 1000; // 20 วินาทีสำหรับเดือนปัจจุบัน
const MEMORY_GC_INTERVAL_MS = 10 * 60 * 1000;  // 10 นาที Clean Memory

/**
 * ดึงเดือนปัจจุบันในรูปแบบ YYYY-MM (เวลา Asia/Bangkok)
 */
function getCurrentMonthString() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit'
  }).format(new Date());
}

/**
 * ตรวจสอบว่าเดือนที่ระบุเป็นเดือนในอดีตหรือไม่
 */
function isPastMonth(monthStr) {
  if (!monthStr || typeof monthStr !== 'string') return false;
  const cur = getCurrentMonthString();
  return monthStr < cur;
}

/**
 * ระบบ Multi-Tier Cache with Stale-While-Revalidate
 * @param {string} cacheKey - คีย์ประจำข้อมูล
 * @param {string} month - เดือนในรูปแบบ YYYY-MM
 * @param {Function} fetchFreshFn - ฟังก์ชันคำนวณหรือดึงข้อมูลสดจากฐานข้อมูล
 * @param {Object} options - ตัวเลือกเสริม เช่น isRefresh, transformFn
 */
async function getOrRevalidate(cacheKey, month, fetchFreshFn, options = {}) {
  const isRefresh = Boolean(options.isRefresh);
  const curMonth = getCurrentMonthString();
  const isPast = isPastMonth(month);

  // 1. กรณี Force Refresh (?refresh=1): ข้ามแคช ดึงสด และอัปเดตแคชใหม่
  if (isRefresh) {
    const freshData = await fetchFreshFn();
    const entry = {
      savedAt: Date.now(),
      month,
      isPast,
      data: freshData
    };
    memoryStore.set(cacheKey, entry);
    writePersistentCache(cacheKey, entry).catch(() => {});
    return freshData;
  }

  // 2. ตรวจสอบ Tier 1: In-Memory Cache (0 ms)
  if (memoryStore.has(cacheKey)) {
    const memEntry = memoryStore.get(cacheKey);
    if (memEntry && memEntry.data) {
      if (isPast) {
        // เดือนในอดีต: คืนค่าทันทีแบบถาวร (Immutable)
        return memEntry.data;
      }

      // เดือนปัจจุบัน: ตรวจสอบความสดใหม่ (Stale-While-Revalidate)
      const isStale = (Date.now() - memEntry.savedAt) > CURRENT_MONTH_STALE_TTL_MS;
      if (isStale && !inFlightRevalidations.has(cacheKey)) {
        triggerBackgroundRevalidation(cacheKey, month, fetchFreshFn);
      }
      return memEntry.data;
    }
  }

  // 3. ตรวจสอบ Tier 2: Persistent Disk Cache
  try {
    const diskEntry = await readPersistentCache(cacheKey);
    if (diskEntry && diskEntry.data) {
      // โหลดกลับเข้า Memory Store (Tier 1)
      memoryStore.set(cacheKey, diskEntry);

      if (isPast) {
        return diskEntry.data;
      }

      // เดือนปัจจุบัน: ถ้าข้อมูลจากดิสก์เก่าเกินเกณฑ์ ให้ Revalidate ในเบื้องหลัง
      const isStale = (Date.now() - (diskEntry.savedAt || 0)) > CURRENT_MONTH_STALE_TTL_MS;
      if (isStale && !inFlightRevalidations.has(cacheKey)) {
        triggerBackgroundRevalidation(cacheKey, month, fetchFreshFn);
      }
      return diskEntry.data;
    }
  } catch (err) {
    // Disk cache miss or read error, proceed to fetch
  }

  // 4. กรณีไม่มีแคชเลย (Cold Start): ดึงข้อมูลจากฐานข้อมูลทันที บันทึกทั้ง 2 Tier แล้วตอบกลับ
  const freshData = await fetchFreshFn();
  const entry = {
    savedAt: Date.now(),
    month,
    isPast,
    data: freshData
  };
  memoryStore.set(cacheKey, entry);
  writePersistentCache(cacheKey, entry).catch(() => {});
  return freshData;
}

/**
 * สั่งให้รัน Revalidation ในเบื้องหลังเงียบๆ โดยไม่บล็อกหน้าเว็บ
 */
function triggerBackgroundRevalidation(cacheKey, month, fetchFreshFn) {
  inFlightRevalidations.add(cacheKey);
  (async () => {
    try {
      const freshData = await fetchFreshFn();
      const isPast = isPastMonth(month);
      const entry = {
        savedAt: Date.now(),
        month,
        isPast,
        data: freshData
      };
      memoryStore.set(cacheKey, entry);
      await writePersistentCache(cacheKey, entry);
    } catch (err) {
      console.warn(`⚠️ [CacheManager] Background revalidation failed for ${cacheKey}:`, err.message);
    } finally {
      inFlightRevalidations.delete(cacheKey);
    }
  })();
}

/**
 * ล้างแคชของเดือนที่ระบุ (ใช้เมื่อมีการแก้ไขเป้าหมาย หรือข้อมูลในอดีตมีการเปลี่ยนแปลง)
 */
async function invalidateMonth(month) {
  if (!month) return;
  const keysToDelete = [];
  for (const [key, entry] of memoryStore.entries()) {
    if (key.includes(month) || (entry && entry.month === month)) {
      keysToDelete.push(key);
    }
  }

  for (const key of keysToDelete) {
    memoryStore.delete(key);
    await removePersistentCache(key).catch(() => {});
  }

  // ล้างไฟล์บน Disk Cache ที่ตรงกับเดือนนั้นทั้งหมด
  await removePersistentCachePattern(month).catch(() => {});
}

/**
 * ล้างแคชเจาะจงตาม Key
 */
async function invalidateKey(cacheKey) {
  if (!cacheKey) return;
  memoryStore.delete(cacheKey);
  await removePersistentCache(cacheKey).catch(() => {});
}

/**
 * ล้างแคชทั้งหมดในระบบ
 */
async function invalidateAll() {
  memoryStore.clear();
  inFlightRevalidations.clear();
}

module.exports = {
  getCurrentMonthString,
  isPastMonth,
  getOrRevalidate,
  invalidateMonth,
  invalidateKey,
  invalidateAll,
};
