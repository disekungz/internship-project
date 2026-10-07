const { pool_smart, pool_test } = require('../../routes/10.17.87.244/config');
const pgPool = pool_smart;
const poolTest = pool_test;
const { computeLiveAttendanceData } = require('./attendanceComputeService');
const { clearAllCache } = require('../../Utility/apiCache');


function dayjs(input) {
  const d = input ? (input instanceof Date ? new Date(input.getTime()) : new Date(input)) : new Date();
  return {
    toDate: () => d,
    isValid: () => !isNaN(d.getTime()),
    format: (fmt = 'YYYY-MM-DD') => {
      if (isNaN(d.getTime())) return '';
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const h = String(d.getHours()).padStart(2, '0');
      const min = String(d.getMinutes()).padStart(2, '0');
      const s = String(d.getSeconds()).padStart(2, '0');
      if (fmt === 'YYYY-MM') return y + '-' + m;
      if (fmt === 'YYYY') return String(y);
      if (fmt === 'YYYY-MM-DD HH:mm:ss') return `${y}-${m}-${day} ${h}:${min}:${s}`;
      return y + '-' + m + '-' + day;
    },
    year: () => d.getFullYear(),
    month: () => d.getMonth(),
    date: () => d.getDate(),
    day: () => d.getDay(),
    hour: () => d.getHours(),
    minute: () => d.getMinutes(),
    diff: (other, unit) => {
      const od = other && other.toDate ? other.toDate() : new Date(other);
      const diffMs = d.getTime() - od.getTime();
      if (unit === 'minute' || unit === 'minutes') return diffMs / (1000 * 60);
      if (unit === 'hour' || unit === 'hours') return diffMs / (1000 * 60 * 60);
      if (unit === 'day' || unit === 'days') return diffMs / (1000 * 60 * 60 * 24);
      return diffMs;
    },
    add: (val, unit) => {
      const res = new Date(d.getTime());
      if (unit === 'day' || unit === 'days') res.setDate(res.getDate() + val);
      return dayjs(res);
    },
    startOf: (unit) => {
      const res = new Date(d.getTime());
      if (unit === 'month') { res.setDate(1); res.setHours(0,0,0,0); }
      else if (unit === 'year') { res.setMonth(0); res.setDate(1); res.setHours(0,0,0,0); }
      else if (unit === 'isoWeek') {
        const day = (res.getDay() + 6) % 7;
        res.setDate(res.getDate() - day);
        res.setHours(0,0,0,0);
      }
      return dayjs(res);
    },
    endOf: (unit) => {
      const res = new Date(d.getTime());
      if (unit === 'month') {
        const nextM = new Date(res.getFullYear(), res.getMonth() + 1, 0, 23, 59, 59, 999);
        return dayjs(nextM);
      } else if (unit === 'year') {
        return dayjs(new Date(res.getFullYear(), 11, 31, 23, 59, 59, 999));
      } else if (unit === 'isoWeek') {
        const day = (res.getDay() + 6) % 7;
        res.setDate(res.getDate() + (6 - day));
        res.setHours(23, 59, 59, 999);
        return dayjs(res);
      }
      return dayjs(res);
    },
    isBefore: (other) => d < (other && other.toDate ? other.toDate() : new Date(other)),
    isAfter: (other) => d > (other && other.toDate ? other.toDate() : new Date(other)),
    isSame: (other, unit) => {
      const od = other && other.toDate ? other.toDate() : new Date(other);
      if (unit === 'day') {
        return d.getFullYear() === od.getFullYear() && d.getMonth() === od.getMonth() && d.getDate() === od.getDate();
      }
      return d.getTime() === od.getTime();
    }
  };
}


/**
 * Check if there are any dates in the given month/range where updated_date in smart_man_time_attendance
 * is newer than updated_at in public.productivity_attendance_daily_snapshot.
 */
async function checkMonthAttendanceStatus({ month, startDate, endDate }) {
  let rangeStart = startDate;
  let rangeEnd = endDate;

  if (month && /^\d{4}-\d{2}$/.test(month)) {
    rangeStart = `${month}-01`;
    rangeEnd = dayjs(rangeStart).endOf('month').format('YYYY-MM-DD');
  } else if (!rangeStart || !rangeEnd) {
    rangeStart = dayjs().startOf('month').format('YYYY-MM-DD');
    rangeEnd = dayjs().endOf('month').format('YYYY-MM-DD');
  }

  const endPlusOne = dayjs(rangeEnd).add(1, 'day').format('YYYY-MM-DD');

  // 1. Query per-date majority updated_date and record_count from smart.smart_man_time_attendance
  // (Filtering out stale leftover records whose updated_date does not match the majority batch)
  const attRes = await pgPool.query(`
    WITH update_counts AS (
      SELECT 
        SUBSTRING(dlh_effective_date_time, 1, 10) as work_date,
        updated_date,
        COUNT(*) as cnt
      FROM smart.smart_man_time_attendance
      WHERE dlh_effective_date_time >= $1 AND dlh_effective_date_time < $2
      GROUP BY SUBSTRING(dlh_effective_date_time, 1, 10), updated_date
    ),
    majority_update AS (
      SELECT work_date, updated_date, cnt
      FROM (
        SELECT work_date, updated_date, cnt,
               ROW_NUMBER() OVER (PARTITION BY work_date ORDER BY cnt DESC, updated_date DESC) as rn
        FROM update_counts
      ) t
      WHERE rn = 1
    )
    SELECT 
      m.work_date,
      m.updated_date as last_attendance_update,
      m.cnt as record_count
    FROM majority_update m
    ORDER BY m.work_date ASC
  `, [rangeStart, endPlusOne]);

  // 2. Query per-date updated_at from public.productivity_attendance_daily_snapshot
  const snapRes = await poolTest.query(`
    SELECT 
      work_date::text as work_date,
      updated_at as last_snapshot_update
    FROM public.productivity_attendance_daily_snapshot
    WHERE work_date >= $1 AND work_date <= $2
    ORDER BY work_date ASC
  `, [rangeStart, rangeEnd]);

  const snapshotMap = new Map();
  snapRes.rows.forEach(r => {
    snapshotMap.set(r.work_date, r.last_snapshot_update);
  });

  const changedDates = [];
  const dateDetails = [];
  let latestOverallAttendanceUpdate = null;

  attRes.rows.forEach(row => {
    const wDate = row.work_date;
    const attUpdated = row.last_attendance_update ? new Date(row.last_attendance_update) : null;
    const snapUpdated = snapshotMap.has(wDate) ? new Date(snapshotMap.get(wDate)) : null;

    if (attUpdated && (!latestOverallAttendanceUpdate || attUpdated > latestOverallAttendanceUpdate)) {
      latestOverallAttendanceUpdate = attUpdated;
    }

    let isChanged = false;
    let reason = 'UP_TO_DATE';

    if (!snapUpdated) {
      isChanged = true;
      reason = 'NO_SNAPSHOT';
    } else if (attUpdated && attUpdated.getTime() > snapUpdated.getTime()) {
      isChanged = true;
      reason = 'ATTENDANCE_UPDATED';
    }

    if (isChanged) {
      changedDates.push(wDate);
    }

    dateDetails.push({
      workDate: wDate,
      recordCount: parseInt(row.record_count, 10),
      lastAttendanceUpdate: attUpdated ? attUpdated.toISOString() : null,
      lastSnapshotUpdate: snapUpdated ? snapUpdated.toISOString() : null,
      isChanged,
      reason
    });
  });

  return {
    hasNewUpdate: changedDates.length > 0,
    month: month || rangeStart.substring(0, 7),
    startDate: rangeStart,
    endDate: rangeEnd,
    totalDatesWithData: attRes.rows.length,
    changedDates,
    totalDaysChanged: changedDates.length,
    latestAttendanceUpdate: latestOverallAttendanceUpdate ? latestOverallAttendanceUpdate.toISOString() : null,
    dateDetails
  };
}

/**
 * Selectively sync attendance ONLY for specific target dates.
 * Preserves all untouched dates (e.g. 16-31 remains untouched if targetDates are only 1-15).
 */
async function syncSelectiveAttendanceDates({ targetDates, month, startDate, endDate }) {
  let datesToSync = Array.isArray(targetDates) ? targetDates.filter(Boolean) : [];

  // If no targetDates provided, auto-detect changed dates for the month/range
  if (datesToSync.length === 0) {
    const status = await checkMonthAttendanceStatus({ month, startDate, endDate });
    datesToSync = status.changedDates;
  }

  if (datesToSync.length === 0) {
    return {
      success: true,
      message: 'ข้อมูลทั้งหมดเป็นปัจจุบันแล้ว ไม่พบวันที่ต้องอัปเดต',
      syncedDates: [],
      totalSynced: 0
    };
  }

  // Sort dates chronologically
  datesToSync.sort();
  console.log(`[AttendanceSync] Selectively syncing ${datesToSync.length} dates:`, datesToSync);

  // 1. Group contiguous dates for efficient batch processing with computeLiveAttendanceData
  // 1. Group contiguous dates for efficient batch processing
  const contiguousRanges = [];
  let currentRange = [datesToSync[0], datesToSync[0]];

  for (let i = 1; i < datesToSync.length; i++) {
    const prevDate = dayjs(datesToSync[i - 1]);
    const currDate = dayjs(datesToSync[i]);

    if (currDate.diff(prevDate, 'day') === 1) {
      currentRange[1] = datesToSync[i];
    } else {
      contiguousRanges.push(currentRange);
      currentRange = [datesToSync[i], datesToSync[i]];
    }
  }
  contiguousRanges.push(currentRange);

  const syncedResults = {};

  // 2. Compute live data and upsert into productivity_attendance_daily_snapshot ONLY for target dates
  for (const [rStart, rEnd] of contiguousRanges) {
    const liveMetrics = await computeLiveAttendanceData(rStart, rEnd);
    for (const [dStr, metrics] of Object.entries(liveMetrics)) {
      if (datesToSync.includes(dStr)) {
        await poolTest.query(`
          INSERT INTO public.productivity_attendance_daily_snapshot (work_date, metrics, updated_at)
          VALUES ($1, $2, NOW())
          ON CONFLICT (work_date) DO UPDATE 
          SET metrics = EXCLUDED.metrics, updated_at = NOW()
        `, [dStr, JSON.stringify(metrics)]);
        syncedResults[dStr] = metrics;
      }
    }
  }

  // 3. Rollup period summary for the affected date range
  const overallStart = startDate || datesToSync[0];
  const overallEnd = endDate || datesToSync[datesToSync.length - 1];

  try {
    const { syncProductivityPeriodSummary } = require('./periodSummaryService');
    await syncProductivityPeriodSummary(overallStart, overallEnd);
  } catch (err) {
    console.warn('[AttendanceSync] Period summary rollup warning:', err.message);
  }

  // 4. Clear memory cache
  try {
    clearAllCache();
  } catch (e) {}

  return {
    success: true,
    message: `ซิงค์และอัปเดตข้อมูล Attendance ${datesToSync.length} วัน เรียบร้อยแล้ว`,
    syncedDates: datesToSync,
    totalSynced: datesToSync.length,
    startDate: overallStart,
    endDate: overallEnd,
    syncedAt: new Date().toISOString()
  };
}

module.exports = {
  checkMonthAttendanceStatus,
  syncSelectiveAttendanceDates
};
