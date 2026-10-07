const { initExcelFolderScheduler } = require("./excelFolderSync");
const { initFpcFolderScheduler } = require("./fpcExcelSync");
const { getThaiTimeInfo, syncSmartManpower } = require("./snapshotManager");
const { syncDailyOutputSnapshotFromPostgres } = require("./outputSnapshotService");
const { syncProductivityPeriodSummary } = require("./periodSummaryService");
const { syncMatExcelToDb } = require("./matExcelSync");
const { pool_test } = require("../../routes/10.17.87.244/config");

let lastExecutedKey = '';

const initSnapshotScheduler = () => {
  // Initialize Network Folder Auto-Sync Schedulers (SMT 10.17.88.65 & FPC 10.17.86.37)
  initExcelFolderScheduler();
  initFpcFolderScheduler();

  console.log('[SnapshotScheduler] Initialized Daily Auto-Snapshot Scheduler (09:00 AM Daily Run)');

  // Startup Check (after 5 seconds)
  setTimeout(async () => {
    try {
      const { yesterdayStr, todayStr } = getThaiTimeInfo();
      await syncSmartManpower(todayStr, 'startup_check').catch(() => {});

      const checkRes = await pool_test.query(
        'SELECT count(*) as count FROM public.output_daily_snapshot WHERE output_date = $1',
        [yesterdayStr]
      );
      const rowCount = parseInt(checkRes.rows[0]?.count || '0', 10);
      if (rowCount === 0) {
        console.log(`[SnapshotScheduler] Startup Check: Missing output snapshot for yesterday (${yesterdayStr}), running automatic sync...`);
        await syncDailyOutputSnapshotFromPostgres(3);
      } else {
        console.log(`[SnapshotScheduler] Startup Check: Output snapshot for yesterday (${yesterdayStr}) is already up to date (${rowCount} records).`);
      }

      // LINE MAT Daily Excel Auto-Sync (Startup Check)
      try {
        await syncMatExcelToDb();
      } catch (matErr) {
        console.warn("[SnapshotScheduler] Startup MAT Excel sync warning:", matErr.message);
      }
    } catch (err) {
      console.error('[SnapshotScheduler] Startup sync error:', err.message);
    }
  }, 5000);

  // Interval check every minute
  setInterval(async () => {
    try {
      const { todayStr, yesterdayStr, currentHour, currentMinute } = getThaiTimeInfo();
      const currentRunKey = `${todayStr}_H${currentHour}_M${currentMinute}`;

      if (lastExecutedKey === currentRunKey) return;

      // 09:00 AM Daily Run
      if (currentHour === 9 && currentMinute === 0) {
        lastExecutedKey = currentRunKey;
        console.log(`[SnapshotScheduler] Executing Manpower Smart Delta Check for date: ${todayStr} at 09:00 AM...`);
        await syncSmartManpower(todayStr, '09:00_daily');

        console.log(`[SnapshotScheduler] Scheduled Output Sync Triggered at 09:00 AM for yesterday (${yesterdayStr})...`);
        await syncDailyOutputSnapshotFromPostgres(3);

        await syncProductivityPeriodSummary().catch(e => console.error('[SnapshotScheduler] Auto period rollup error:', e.message));
      }
    } catch (err) {
      console.error('[SnapshotScheduler Error]:', err.message);
    }
  }, 60000);
};

module.exports = { initSnapshotScheduler };
