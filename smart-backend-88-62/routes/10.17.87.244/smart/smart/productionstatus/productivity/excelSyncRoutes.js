const express = require("express");
const router = express.Router();
const { pool_test } = require("../../../../config");
const { syncFpcPlanFolderToDb } = require("../../../../../../services/productivity/fpcExcelSync");
const { syncExcelFolderToDb } = require("../../../../../../services/productivity/excelFolderSync");

// ----------------------------------------------------------------------------
// POST /upload-fpc-daily-plan (Manual Upload from UI)
// ----------------------------------------------------------------------------
router.post("/upload-fpc-daily-plan", async (req, res) => {
  try {
    const { records = [], fileName = 'fpc_plan.xlsx' } = req.body;
    if (!Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ error: "No records provided" });
    }

    await pool_test.query(`
      CREATE TABLE IF NOT EXISTS public.fpc_daily_actual_plan (
        id SERIAL PRIMARY KEY,
        date DATE NOT NULL,
        line VARCHAR(100) NOT NULL,
        piece_plan NUMERIC(15, 2) DEFAULT 0,
        sht_plan NUMERIC(15, 2) DEFAULT 0,
        lot_plan NUMERIC(15, 2) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT unique_fpc_date_line UNIQUE(date, line)
      );
    `);

    let saved = 0;
    for (const r of records) {
      if (!r.date || !r.line) continue;
      await pool_test.query(`
        INSERT INTO public.fpc_daily_actual_plan (date, line, piece_plan, sht_plan, lot_plan, updated_at)
        VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
        ON CONFLICT (date, line) DO UPDATE SET
          piece_plan = EXCLUDED.piece_plan,
          sht_plan = EXCLUDED.sht_plan,
          lot_plan = EXCLUDED.lot_plan,
          updated_at = CURRENT_TIMESTAMP;
      `, [r.date, r.line, r.piece_plan || 0, r.sht_plan || 0, r.lot_plan || 0]);
      saved++;
    }

    res.json({ success: true, count: saved });
  } catch (error) {
    console.error("[ExcelSync] Upload FPC Plan Error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// ----------------------------------------------------------------------------
// POST /upload-smt-daily-actual-output (Manual Upload from UI)
// ----------------------------------------------------------------------------
router.post("/upload-smt-daily-actual-output", async (req, res) => {
  try {
    const { records = [], fileName = 'smt_output.xlsx' } = req.body;
    if (!Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ error: "No records provided" });
    }

    await pool_test.query(`
      CREATE TABLE IF NOT EXISTS public.smt_daily_actual_output (
        id SERIAL PRIMARY KEY,
        date DATE NOT NULL,
        line VARCHAR(100) NOT NULL,
        piece_output NUMERIC(15, 2) DEFAULT 0,
        sht_output NUMERIC(15, 2) DEFAULT 0,
        lot_output NUMERIC(15, 2) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT unique_smt_date_line UNIQUE(date, line)
      );
    `);

    let saved = 0;
    for (const r of records) {
      if (!r.date || !r.line) continue;
      await pool_test.query(`
        INSERT INTO public.smt_daily_actual_output (date, line, piece_output, sht_output, lot_output, updated_at)
        VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
        ON CONFLICT (date, line) DO UPDATE SET
          piece_output = EXCLUDED.piece_output,
          sht_output = EXCLUDED.sht_output,
          lot_output = EXCLUDED.lot_output,
          updated_at = CURRENT_TIMESTAMP;
      `, [r.date, r.line, r.piece_output || 0, r.sht_output || 0, r.lot_output || 0]);
      saved++;
    }

    res.json({ success: true, count: saved });
  } catch (error) {
    console.error("[ExcelSync] Upload SMT Output Error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// ----------------------------------------------------------------------------
// POST /sync-fpc-folder (On-Demand Sync from Network Folder 10.17.86.37)
// ----------------------------------------------------------------------------
router.post("/sync-fpc-folder", async (req, res) => {
  try {
    const syncAll = req.query.syncAll === 'true' || req.body?.syncAll === true;
    const result = await syncFpcPlanFolderToDb(!syncAll);
    res.json(result);
  } catch (error) {
    console.error("[ExcelSync] FPC Folder Sync Error:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ----------------------------------------------------------------------------
// POST /sync-excel-folder (On-Demand Sync from SMT Network Folder 10.17.88.65)
// ----------------------------------------------------------------------------
router.post("/sync-excel-folder", async (req, res) => {
  try {
    const syncAll = req.query.syncAll === 'true' || req.body?.syncAll === true;
    const result = await syncExcelFolderToDb(!syncAll);
    res.json(result);
  } catch (error) {
    console.error("[ExcelSync] SMT Excel Folder Sync Error:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ----------------------------------------------------------------------------
// GET /excel-import-history
// ----------------------------------------------------------------------------

// Clear Excel Import History Log (both DELETE and POST)
router.delete("/excel-import-history", async (req, res) => {
  try {
    await pool_test.query("TRUNCATE TABLE public.excel_import_history;");
    res.json({ success: true, message: "Cleared import history successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/excel-import-history/clear", async (req, res) => {
  try {
    await pool_test.query("TRUNCATE TABLE public.excel_import_history;");
    res.json({ success: true, message: "Cleared import history successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/excel-import-history", async (req, res) => {
  try {
    await pool_test.query(`
      CREATE TABLE IF NOT EXISTS public.excel_import_history (
          id SERIAL PRIMARY KEY,
          file_name VARCHAR(255) NOT NULL,
          record_count INT DEFAULT 0,
          sheet_count INT DEFAULT 0,
          imported_by VARCHAR(100) DEFAULT 'Admin',
          imported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          status VARCHAR(50) DEFAULT 'SUCCESS',
          details TEXT
      );
    `);

    // Auto-clean logs older than 7 days
    await pool_test.query(`
      DELETE FROM public.excel_import_history
      WHERE imported_at < CURRENT_TIMESTAMP - INTERVAL '7 days';
    `);

    const { rows } = await pool_test.query(`
      SELECT file_name, record_count, sheet_count, imported_by, imported_at::text as imported_at, status, details
      FROM public.excel_import_history
      WHERE imported_at >= CURRENT_TIMESTAMP - INTERVAL '7 days'
      ORDER BY imported_at DESC
      LIMIT 20
    `);
    res.json(rows);
  } catch (error) {
    res.json([]);
  }
});

const { syncMatExcelToDb, ensureMatOutputTable } = require("../../../../../../services/productivity/matExcelSync");

// ----------------------------------------------------------------------------
// GET /mat-daily-output (LINE MAT Daily Actual Output: PD_Output & MOS_Output)
// ----------------------------------------------------------------------------
router.get("/mat-daily-output", async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    await ensureMatOutputTable();

    let query = `
      SELECT date::text as date, pd_output, mos_output, pd_prod_target, sht_prod_target, source_file
      FROM public.mat_daily_output
      WHERE 1=1
    `;
    const params = [];
    if (startDate && endDate) {
      query += ` AND date >= $1 AND date <= $2`;
      params.push(startDate, endDate);
    }
    query += ` ORDER BY date ASC`;

    let { rows } = await pool_test.query(query, params);

    // Auto-sync fallback if no rows found
    if (rows.length === 0) {
      try {
        await syncMatExcelToDb();
        const recheck = await pool_test.query(query, params);
        rows = recheck.rows;
      } catch (syncErr) {
        console.warn("[MatDailyOutput] Auto-sync attempt failed or folder unreachable:", syncErr.message);
      }
    }

    res.json(rows);
  } catch (error) {
    console.error("[MatDailyOutput] Error:", error.message);
    res.json([]);
  }
});

// ----------------------------------------------------------------------------
// ALL /sync-mat-excel (On-Demand Sync for LINE MAT Excel from Network Folder)
// ----------------------------------------------------------------------------
router.all("/sync-mat-excel", async (req, res) => {
  try {
    const result = await syncMatExcelToDb();
    res.json(result);
  } catch (error) {
    console.error("[ExcelSync] MAT Excel Sync Error:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
