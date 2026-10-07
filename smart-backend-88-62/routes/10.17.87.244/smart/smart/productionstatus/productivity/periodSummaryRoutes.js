const express = require("express");
const router = express.Router();
const { pool_test, pool_smart } = require("../../../../config");
const { getCached, setCache } = require("../../../../../../Utility/apiCache");

// ----------------------------------------------------------------------------
// GET /period-summary
// Query Pre-aggregated Period Summaries (DAILY, WEEKLY, MONTHLY, YEARLY)
// ----------------------------------------------------------------------------
router.get("/period-summary", async (req, res) => {
  try {
    const { periodType, startDate, endDate, factory, lineGroup } = req.query;
    let query = `
      SELECT id, period_type, period_key, start_date::text as start_date, end_date::text as end_date,
             factory, line_group, op_leader_register, total_man_hour,
             piece_plan, piece_output, sht_output, lot_output, piece_prod_target,
             actual_productivity, sum_productivity,
             sht_plan, lot_plan, sht_prod_target, sht_actual_productivity, sht_sum_productivity,
             ot_psn, ot_working_day_rate, ot_holiday_day_rate,
             leave_psn, leave_working_day_rate, updated_at
      FROM public.productivity_period_summary
      WHERE 1=1
    `;
    const params = [];

    if (periodType) {
      params.push(periodType.toUpperCase());
      query += ` AND period_type = $${params.length}`;
    }
    if (startDate) {
      params.push(startDate);
      query += ` AND end_date >= $${params.length}`;
    }
    if (endDate) {
      params.push(endDate);
      query += ` AND start_date <= $${params.length}`;
    }
    if (factory) {
      params.push(factory.toUpperCase());
      query += ` AND factory = $${params.length}`;
    }
    if (lineGroup) {
      params.push(lineGroup);
      query += ` AND line_group = $${params.length}`;
    }

    query += ` ORDER BY start_date ASC, line_group ASC`;

    const { rows } = await pool_test.query(query, params);
    res.json(rows);
  } catch (error) {
    console.error("[PeriodSummary] Error fetching period-summary data:", error.message);
    res.status(500).json({ error: "Failed to fetch period summary", details: error.message });
  }
});

// ----------------------------------------------------------------------------
// GET /productivity-smart-report
// Query daily snapshot or rolled up smart report records
// ----------------------------------------------------------------------------
router.get(["/productivity-smart-report", "/process-output-detail", "/daily-output-by-line"], async (req, res) => {
  try {
    const { startDate, endDate, lineGroup = "ALL", factory = "ALL" } = req.query;
    if (!startDate || !endDate) {
      return res.status(400).json({ error: "startDate and endDate are required" });
    }

    let query = `
      SELECT output_date::text as output_date, line_group, mc_line, process_name, factory,
             SUM(COALESCE(actual_piece_qty, 0)) as actual_piece_qty,
             SUM(COALESCE(actual_piece_qty, 0)) as actual_pcs_qty,
             SUM(COALESCE(actual_sht_qty, 0)) as actual_sht_qty,
             SUM(COALESCE(actual_lot_qty, 0)) as actual_lot_qty
      FROM public.output_daily_snapshot
      WHERE output_date >= $1 AND output_date <= $2
    `;
    const params = [startDate, endDate];

    if (factory && factory !== "ALL") {
      params.push(factory.toUpperCase());
      query += ` AND factory = $${params.length}`;
    }
    if (lineGroup && lineGroup !== "ALL") {
      const groups = lineGroup.split(",").map(g => g.trim());
      const placeholders = groups.map(g => {
        params.push(g);
        return `$${params.length}`;
      }).join(",");
      query += ` AND line_group IN (${placeholders})`;
    }

    query += ` GROUP BY output_date, line_group, mc_line, process_name, factory ORDER BY output_date ASC`;

    const { rows } = await pool_test.query(query, params);
    res.json(rows);
  } catch (error) {
    console.error("[ProductivitySmartReport] Error:", error.message);
    res.status(500).json({ error: "Failed to fetch smart report data", details: error.message });
  }
});

// ----------------------------------------------------------------------------
// GET /custom-macro-lines & POST & DELETE
// ----------------------------------------------------------------------------
router.get("/custom-macro-lines", async (req, res) => {
  try {
    const result = await pool_test.query(`
      SELECT id, macro_name, sub_lines as line_members, sub_lines, output_source_line,
             show_plan_row, show_target_row, show_ot_rows, show_leave_rows, units, factory, is_active, updated_at
      FROM public.custom_macro_lines
      WHERE is_active = TRUE
      ORDER BY macro_name ASC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error("[CustomMacro] GET Error:", error.message);
    res.status(500).json({ error: "Failed to fetch custom macro lines" });
  }
});

router.post("/custom-macro-lines", async (req, res) => {
  try {
    const { macro_name, line_members, sub_lines } = req.body;
    const members = line_members || sub_lines;
    if (!macro_name || !Array.isArray(members) || members.length === 0) {
      return res.status(400).json({ error: "macro_name and line_members/sub_lines array are required" });
    }
    const result = await pool_test.query(`
      INSERT INTO public.custom_macro_lines (macro_name, sub_lines, updated_at)
      VALUES ($1, $2::jsonb, CURRENT_TIMESTAMP)
      ON CONFLICT (macro_name) 
      DO UPDATE SET sub_lines = EXCLUDED.sub_lines, updated_at = CURRENT_TIMESTAMP
      RETURNING *;
    `, [macro_name.trim(), JSON.stringify(members)]);
    res.json(result.rows[0]);
  } catch (error) {
    console.error("[CustomMacro] POST Error:", error.message);
    res.status(500).json({ error: "Failed to save custom macro line" });
  }
});

router.delete("/custom-macro-lines/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await pool_test.query(`DELETE FROM public.custom_macro_lines WHERE id = $1`, [id]);
    res.json({ success: true, message: "Deleted successfully" });
  } catch (error) {
    console.error("[CustomMacro] DELETE Error:", error.message);
    res.status(500).json({ error: "Failed to delete custom macro line" });
  }
});

// ----------------------------------------------------------------------------
// GET & POST /table-visibility
// ----------------------------------------------------------------------------
router.get("/table-visibility", async (req, res) => {
  try {
    await pool_test.query(`
      CREATE TABLE IF NOT EXISTS public.productivity_table_visibility (
        id SERIAL PRIMARY KEY,
        section_key VARCHAR(100) UNIQUE NOT NULL,
        is_visible BOOLEAN NOT NULL DEFAULT true,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    const { rows } = await pool_test.query(`
      SELECT section_key, is_visible FROM public.productivity_table_visibility
    `);
    res.json(rows);
  } catch (error) {
    console.error("[TableVisibility] GET Error:", error.message);
    res.status(500).json({ error: "Failed to fetch table visibility" });
  }
});

router.post("/table-visibility", async (req, res) => {
  try {
    const { section_key, is_visible } = req.body;
    if (!section_key) {
      return res.status(400).json({ error: "section_key is required" });
    }
    const result = await pool_test.query(`
      INSERT INTO public.productivity_table_visibility (section_key, is_visible, updated_at)
      VALUES ($1, $2, CURRENT_TIMESTAMP)
      ON CONFLICT (section_key)
      DO UPDATE SET is_visible = EXCLUDED.is_visible, updated_at = CURRENT_TIMESTAMP
      RETURNING *;
    `, [section_key, is_visible === true]);
    res.json(result.rows[0]);
  } catch (error) {
    console.error("[TableVisibility] POST Error:", error.message);
    res.status(500).json({ error: "Failed to update table visibility" });
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
    const { rows } = await pool_test.query(`
      SELECT file_name, record_count, sheet_count, imported_by, imported_at::text as imported_at, status, details
      FROM public.excel_import_history
      ORDER BY imported_at DESC
      LIMIT 50
    `);
    res.json(rows);
  } catch (error) {
    res.json([]);
  }
});

// ----------------------------------------------------------------------------
// GET /smt-daily-actual-output & /fpc-daily-actual-plan
// ----------------------------------------------------------------------------
router.get("/smt-daily-actual-output", async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    let query = `
      SELECT line, date::text as date, daily_plan 
      FROM public.smt_daily_actual_plan
      WHERE line NOT ILIKE 'Daily Actual plan%'
        AND line NOT ILIKE 'Daily plan%'
        AND line NOT ILIKE '%actual plan%'
        AND line NOT ILIKE 'Daily Output%'
    `;
    const params = [];
    if (startDate && endDate) {
      query += ` AND date >= $1 AND date <= $2`;
      params.push(startDate, endDate);
    }
    query += ` ORDER BY date ASC, line ASC`;
    const { rows } = await pool_test.query(query, params);
    res.json(rows);
  } catch (error) {
    res.json([]);
  }
});

router.get("/fpc-daily-actual-plan", async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    let query = `SELECT id, date::text as date, line, piece_plan, sht_plan, lot_plan FROM public.fpc_daily_actual_plan WHERE 1=1`;
    const params = [];
    if (startDate) { params.push(startDate); query += ` AND date >= $${params.length}`; }
    if (endDate) { params.push(endDate); query += ` AND date <= $${params.length}`; }
    query += ` ORDER BY date ASC, line ASC`;
    const { rows } = await pool_test.query(query, params);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// ----------------------------------------------------------------------------
// POST /sync-period-summary (On-Demand Rollup Calculation)
// ----------------------------------------------------------------------------
router.post("/sync-period-summary", async (req, res) => {
  try {
    const { syncProductivityPeriodSummary } = require("../../../../../../services/productivity/periodSummaryService");
    const { startDate, endDate } = req.body || {};
    const result = await syncProductivityPeriodSummary(startDate, endDate);
    res.json({ success: true, ...result });
  } catch (err) {
    console.error("[PeriodSummaryRoutes] Sync error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});


// ----------------------------------------------------------------------------
// GET /matrix-targets
// ----------------------------------------------------------------------------
router.get("/matrix-targets", async (req, res) => {
  try {
    const { startDate, endDate, line } = req.query;
    let query = `
      SELECT line, date::text as date, 
             COALESCE(pcs_prod_target, 0) as pcs_prod_target, 
             COALESCE(sht_prod_target, 0) as sht_prod_target
      FROM public.line_productivity_targets
      WHERE 1=1
    `;
    const params = [];
    if (startDate && endDate) {
      params.push(startDate, endDate);
      query += ` AND date >= $1 AND date <= $2`;
    }
    if (line) {
      params.push(line);
      query += ` AND line = $${params.length}`;
    }
    query += ` ORDER BY date ASC, line ASC`;

    const { rows } = await pool_test.query(query, params);
    res.json(rows);
  } catch (error) {
    console.error("[MatrixTargets] GET Error:", error.message);
    res.json([]);
  }
});

// ----------------------------------------------------------------------------
// POST /save-matrix-targets (Batch Save Matrix Targets with selective update)
// ----------------------------------------------------------------------------
router.post("/save-matrix-targets", async (req, res) => {
  try {
    const { records, monthLabel } = req.body;
    if (!records || !Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ error: "No records provided" });
    }

    let savedCount = 0;
    const client = await pool_test.connect();
    try {
      await client.query("BEGIN");
      for (const r of records) {
        if (!r.line || !r.date) continue;
        const hasPcs = r.pcs_prod_target !== undefined || r.pcsTarget !== undefined;
        const hasSht = r.sht_prod_target !== undefined || r.shtTarget !== undefined;
        const pcsTarget = hasPcs ? Number(r.pcs_prod_target ?? r.pcsTarget ?? 0) : 0;
        const shtTarget = hasSht ? Number(r.sht_prod_target ?? r.shtTarget ?? 0) : 0;

        await client.query(`
          INSERT INTO public.line_productivity_targets (line, date, pcs_prod_target, sht_prod_target, updated_at)
          VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
          ON CONFLICT (line, date)
          DO UPDATE SET pcs_prod_target = CASE WHEN $5::boolean THEN EXCLUDED.pcs_prod_target ELSE line_productivity_targets.pcs_prod_target END,
                        sht_prod_target = CASE WHEN $6::boolean THEN EXCLUDED.sht_prod_target ELSE line_productivity_targets.sht_prod_target END,
                        updated_at = CURRENT_TIMESTAMP;
        `, [r.line, r.date, pcsTarget, shtTarget, hasPcs, hasSht]);
        savedCount++;
      }
      await client.query("COMMIT");
    } catch (txErr) {
      await client.query("ROLLBACK");
      throw txErr;
    } finally {
      client.release();
    }

    // Record in history log
    try {
      await pool_test.query(`
        INSERT INTO public.excel_import_history (file_name, record_count, sheet_count, imported_by, details)
        VALUES ($1, $2, $3, $4, $5);
      `, [
        `Manual Matrix Targets - ${monthLabel || 'Monthly'}`,
        savedCount,
        1,
        'Admin',
        `กำหนด Target ผลิตภาพ (Productivity Target) จำนวน ${savedCount} รายการ`
      ]);
    } catch (e) {
      console.warn("[MatrixTargets] Could not insert excel_import_history:", e.message);
    }

    res.json({ success: true, count: savedCount });
  } catch (error) {
    console.error("[MatrixTargets] POST Error:", error.message);
    res.status(500).json({ error: "Failed to save matrix targets", details: error.message });
  }
});


// ----------------------------------------------------------------------------
// GET /mat-targets (LINE MAT Targets from mat_daily_output)
// ----------------------------------------------------------------------------
router.get("/mat-targets", async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    let query = `
      SELECT date::text as date, pd_prod_target, sht_prod_target
      FROM public.mat_daily_output
      WHERE (pd_prod_target IS NOT NULL OR sht_prod_target IS NOT NULL)
    `;
    const params = [];
    if (startDate && endDate) {
      query += ` AND date >= $1 AND date <= $2`;
      params.push(startDate, endDate);
    }
    query += ` ORDER BY date ASC`;

    const { rows } = await pool_test.query(query, params);
    res.json(rows);
  } catch (error) {
    console.error("[MAT Targets] Error fetching mat targets:", error.message);
    res.json([]);
  }
});

// ----------------------------------------------------------------------------
// POST /save-mat-targets (LINE MAT Targets into mat_daily_output)
// ----------------------------------------------------------------------------
router.post("/save-mat-targets", async (req, res) => {
  try {
    const { records, monthLabel } = req.body;
    if (!records || !Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ error: "No records provided" });
    }

    const client = await pool_test.connect();
    let savedCount = 0;
    try {
      await client.query("BEGIN");
      for (const r of records) {
        if (!r.date) continue;

        const hasPd = r.pd_prod_target !== undefined && r.pd_prod_target !== null;
        const hasSht = r.sht_prod_target !== undefined && r.sht_prod_target !== null;
        const pdVal = hasPd ? Number(r.pd_prod_target) : null;
        const shtVal = hasSht ? Number(r.sht_prod_target) : null;

        await client.query(`
          INSERT INTO public.mat_daily_output (date, pd_output, mos_output, pd_prod_target, sht_prod_target, updated_at)
          VALUES ($1, 0, 0, $2, $3, CURRENT_TIMESTAMP)
          ON CONFLICT (date)
          DO UPDATE SET
            pd_prod_target = CASE WHEN $4::boolean THEN $2 ELSE mat_daily_output.pd_prod_target END,
            sht_prod_target = CASE WHEN $5::boolean THEN $3 ELSE mat_daily_output.sht_prod_target END,
            updated_at = CURRENT_TIMESTAMP
        `, [r.date, pdVal, shtVal, hasPd, hasSht]);
        savedCount++;
      }
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }

    res.json({ success: true, count: savedCount });
  } catch (error) {
    console.error("[MAT Targets] Error saving mat targets:", error.message);
    res.status(500).json({ error: "Failed to save MAT targets", details: error.message });
  }
});

module.exports = router;

