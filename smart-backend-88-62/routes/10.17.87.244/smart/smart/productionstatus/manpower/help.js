// ==========================================
// API Router สำหรับจัดการข้อมูลการช่วยเหลือข้ามไลน์/แผนก (Help & OT Summary)
// ใช้รวบรวมชั่วโมง Help, OT1, OT2 ระหว่าง Line In และ Line Out
// ==========================================
const express = require('express');
const { queryWithRetryPool1 } = require('../../../../config.js');
const { readPersistentCache, writePersistentCache } = require('../../../../../../Utility/persistentCache.js');

const router = express.Router();
let helpSummaryCache = null;            // แคชข้อมูลสรุป Help
let helpRefreshInFlight = false;         // แฟล็กป้องกันการรีเฟรชซ้ำ
const HELP_CACHE_TTL_MS = 5 * 60 * 1000; // อายุแคช 5 นาที
const THAI_MONTHS = {
  '01': 'มกราคม', '02': 'กุมภาพันธ์', '03': 'มีนาคม', '04': 'เมษายน',
  '05': 'พฤษภาคม', '06': 'มิถุนายน', '07': 'กรกฎาคม', '08': 'สิงหาคม',
  '09': 'กันยายน', '10': 'ตุลาคม', '11': 'พฤศจิกายน', '12': 'ธันวาคม',
};

/**
 * ฟังก์ชันแปลงข้อความวันที่ (เช่น ภาษาไทย "15 มกราคม 2568" หรือ "15/01/2568")
 * ให้เป็น JavaScript Date Object ที่ถูกต้อง (แปลง พ.ศ. เป็น ค.ศ. อัตโนมัติ)
 */
const parseDate = value => {
  if (!value) return null;
  const text = String(value).trim();
  const thaiMatch = text.match(/^(\d{1,2})\s+(มกราคม|กุมภาพันธ์|มีนาคม|เมษายน|พฤษภาคม|มิถุนายน|กรกฎาคม|สิงหาคม|กันยายน|ตุลาคม|พฤศจิกายน|ธันวาคม)\s+(\d{4})$/);
  if (thaiMatch) {
    const month = Object.entries(THAI_MONTHS).find(([, name]) => name === thaiMatch[2])?.[0];
    const year = Number(thaiMatch[3]) - 543;
    return month && year > 1900 ? new Date(year, Number(month) - 1, Number(thaiMatch[1])) : null;
  }
  const thaiSlashMatch = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s|$)/);
  if (thaiSlashMatch) {
    const year = Number(thaiSlashMatch[3]);
    return new Date(year >= 2400 ? year - 543 : year, Number(thaiSlashMatch[2]) - 1, Number(thaiSlashMatch[1]));
  }
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const inFlightHelpPromises = new Map();

/**
 * ฟังก์ชันดึงข้อมูลสรุป Help โดยตรง (In-memory Direct Call)
 * พร้อมระบบ Single-Flight Deduplication ป้องกันการ Query ซ้ำซ้อน
 */
async function fetchHelpSummaryData({ requestedMonth = null, requestedDates = [], forceRefresh = false } = {}) {
  const flightKey = requestedDates.length > 0
    ? `dates:${[...requestedDates].sort().join(',')}`
    : (requestedMonth ? `month:${requestedMonth}` : 'current-month');

  // ถ้ามี Request เดียวกันกำลังประมวลผลอยู่ ให้รอ Promise ตัวเดียวกัน
  if (inFlightHelpPromises.has(flightKey)) {
    return inFlightHelpPromises.get(flightKey);
  }

  const promise = (async () => {
    // ตรวจสอบแคช Persistent
    if (!requestedMonth && requestedDates.length === 0 && !helpSummaryCache) {
      helpSummaryCache = await readPersistentCache('manhour-help-summary');
    }
    if (!requestedMonth && requestedDates.length === 0 && helpSummaryCache
      && Date.now() - helpSummaryCache.savedAt < HELP_CACHE_TTL_MS && !forceRefresh) {
      return helpSummaryCache.data;
    }

    // คำนวณช่วงเดือนและรูปแบบวันที่ภาษาไทยสำหรับ Query
    const month = requestedMonth || new Intl.DateTimeFormat('en-CA', {
      year: 'numeric', month: '2-digit', timeZone: 'Asia/Bangkok',
    }).format(new Date());
    const thaiMonthName = THAI_MONTHS[month.slice(5, 7)];
    const thaiYear = Number(month.slice(0, 4)) + 543;
    const thaiMonthNumber = String(Number(month.slice(5, 7)));
    const thaiMonthPadded = month.slice(5, 7);
    const where = requestedDates.length
      ? `(DATE(date_h) IN (${requestedDates.map(() => '?').join(',')})
          OR DATE(date_w) IN (${requestedDates.map(() => '?').join(',')}))`
      : `(date_h >= ? AND date_h < DATE_ADD(?, INTERVAL 1 MONTH)
          OR CAST(date_h AS CHAR) LIKE ?
          OR CAST(date_h AS CHAR) LIKE ?
          OR CAST(date_w AS CHAR) LIKE ?)`;
    const params = requestedDates.length
      ? [...requestedDates, ...requestedDates]
      : [`${month}-01`, `${month}-01`, `%/${thaiMonthNumber}/${thaiYear}%`, `%/${thaiMonthPadded}/${thaiYear}%`, `%${thaiMonthName} ${thaiYear}%`];

    // Query ข้อมูลจาก MySQL (Pool 1)
    const rows = await queryWithRetryPool1(`
      SELECT id_code, CAST(date_h AS CHAR) AS date_h, CAST(date_w AS CHAR) AS date_w, line_in, line_out, hour, type
      FROM tbl_help
      WHERE ${where}
    `, params);

    // รวมยอดชั่วโมงและจัดกลุ่มรหัสพนักงานตาม OT1 / OT2
    const summary = new Map();
    (rows || []).forEach(row => {
      const parsed = parseDate(row.date_w) || parseDate(row.date_h);
      if (!parsed) return;
      const date = `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`;
      if (!date.startsWith(`${month}-`)) return;
      const lineIn = String(row.line_in || '').trim();
      const lineOut = String(row.line_out || '').trim();
      const key = `${date}\u0000${lineIn}\u0000${lineOut}`;
      const current = summary.get(key) || {
        date, line_in: lineIn, line_out: lineOut, hour: 0,
        ot1_employee_ids: new Set(), ot2_employee_ids: new Set(),
      };
      current.hour += Number(row.hour || 0);
      const id = String(row.id_code || '').trim();
      const type = String(row.type || '').trim().toUpperCase();
      // จำแนกประเภท OT
      if (id && (type.includes('OT 2') || type.includes('OT2') || type.includes('HOLIDAY'))) current.ot2_employee_ids.add(id);
      else if (id && (type.includes('OT 1') || type.includes('OT1') || type.includes('WORKING'))) current.ot1_employee_ids.add(id);
      summary.set(key, current);
    });

    const responseData = [...summary.values()].map(item => ({
      ...item,
      ot1_employee_ids: [...item.ot1_employee_ids],
      ot2_employee_ids: [...item.ot2_employee_ids],
    }));

    if (!requestedMonth && requestedDates.length === 0) {
      helpSummaryCache = { savedAt: Date.now(), data: responseData };
      writePersistentCache('manhour-help-summary', helpSummaryCache)
        .catch(error => console.error('[help/summary] Save failed:', error.message));
    }
    return responseData;
  })();

  inFlightHelpPromises.set(flightKey, promise);
  try {
    return await promise;
  } finally {
    inFlightHelpPromises.delete(flightKey);
  }
}

/**
 * GET /summary
 * ดึงข้อมูลสรุปชั่วโมงการยืมตัว/ช่วยงาน (Help) และแยกตาม OT1, OT2 จากตาราง tbl_help
 * รองรับทั้งการระบุเดือน (?month=YYYY-MM) หรือระบุรายวัน (?dates=YYYY-MM-DD,...)
 */
router.get('/summary', async (req, res) => {
  const requestedDates = String(req.query.dates || '').split(',')
    .map(value => value.trim())
    .filter(value => /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(value)).slice(0, 31);
  const requestedMonth = /^[0-9]{4}-(0[1-9]|1[0-2])$/.test(String(req.query.month || '')) ? String(req.query.month) : null;
  const forceRefresh = req.query.refresh === '1';

  try {
    const data = await fetchHelpSummaryData({ requestedMonth, requestedDates, forceRefresh });
    res.set('Cache-Control', 'no-store');
    return res.json(data);
  } catch (error) {
    console.error('[help/summary]', error);
    if (requestedDates.length === 0 && helpSummaryCache) {
      res.set('X-Data-Cache', 'STALE');
      return res.json(helpSummaryCache.data);
    }
    return res.status(500).json({ error: 'Unable to load tbl_help summary', errorMessage: error.message });
  }
});

module.exports = router;
module.exports.default = router;
module.exports.fetchHelpSummaryData = fetchHelpSummaryData;

