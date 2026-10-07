// ==========================================
// API Router สำหรับจัดการกลุ่มไลน์การผลิตและ Cost Center (Line Manager)
// - จัดการ Mapping และ Formula VDS สำหรับแต่ละ Line ในโรงงาน
// - ดึงรายชื่อ Cost Center Direct/Indirect เพื่อนำไป Map เข้ากลุ่มไลน์
// ==========================================
const express = require("express");
const { pool_test } = require("../../../../config.js");
const { clearManhourDataCache, broadcastManhourChange } = require("./manhour.js");
const {
  ADMIN_VDS_FORMULA_REGISTRY,
  LINE_GROUPS,
  TAB_LINES,
} = require("../../../../../../Utility/lineGroups.js");

const router = express.Router();
let costCenterCache = { expiresAt: 0, values: [] };

const uniqueStrings = (values, { uppercase = false } = {}) => [
  ...new Set(
    (Array.isArray(values) ? values : [])
      .map((value) => String(value || "").trim())
      .filter(Boolean)
      .map((value) => (uppercase ? value.toUpperCase() : value)),
  ),
];

router.get("/lines/cost-center-prefixes", async (req, res) => {
  if (costCenterCache.expiresAt > Date.now()) {
    return res.json({
      costCenters: costCenterCache.values,
      costCenterLines: costCenterCache.lines || {},
      cached: true,
    });
  }
  try {
    const result = await pool_test.query(`
      SELECT cost_center_name, line, line_out FROM public.cost_centers
      WHERE cost_center_name IS NOT NULL
    `);
    const lineMap = {};
    const values = [
      ...new Set(
        result.rows
          .map((row) => {
            const prefix = String(row.cost_center_name || "")
              .trim()
              .toUpperCase()
              .match(/^P\d+/)?.[0];
            const l1 = String(row.line_out || "").trim();
            const l2 = String(row.line || "").trim();
            if (prefix) {
              if (!lineMap[prefix]) lineMap[prefix] = new Set();
              if (l1) lineMap[prefix].add(l1);
              if (l2) lineMap[prefix].add(l2);
            }
            return prefix;
          })
          .filter(Boolean),
      ),
    ].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

    const formattedLines = {};
    for (const [k, v] of Object.entries(lineMap)) {
      formattedLines[k] = Array.from(v).sort();
    }

    costCenterCache = {
      expiresAt: Date.now() + 5 * 60 * 1000,
      values,
      lines: formattedLines,
    };
    return res.json({
      costCenters: values,
      costCenterLines: formattedLines,
      cached: false,
    });
  } catch {
    return res.json({
      costCenters: [
        "P310",
        "P363",
        "P460",
        "P461",
        "P462",
        "P463",
        "P464",
        "P465",
        "P466",
        "P468",
      ],
      costCenterLines: {},
      fallback: true,
    });
  }
});

router.get("/lines/vds-formulas", async (req, res) => {
  try {
    const result = await pool_test.query(`
      SELECT parent_line_name, child_lines, display_pages, cost_center_prefixes
      FROM public.manhour_line_mappings
      WHERE parent_line_name ILIKE '%VDS%'
      ORDER BY parent_line_name ASC
    `);
    const formulas = { ...ADMIN_VDS_FORMULA_REGISTRY };
    result.rows.forEach((row) => {
      formulas[row.parent_line_name] = {
        lines: Array.isArray(row.child_lines) ? row.child_lines : JSON.parse(row.child_lines || "[]"),
        pages: Array.isArray(row.display_pages) ? row.display_pages : JSON.parse(row.display_pages || "[]"),
        costCenterPrefixes: Array.isArray(row.cost_center_prefixes) ? row.cost_center_prefixes : JSON.parse(row.cost_center_prefixes || "[]"),
      };
      LINE_GROUPS[row.parent_line_name] = formulas[row.parent_line_name].lines;
      (formulas[row.parent_line_name].pages || []).forEach((page) => {
        if (TAB_LINES[page] && !TAB_LINES[page].includes(row.parent_line_name)) {
          TAB_LINES[page].push(row.parent_line_name);
        }
      });
    });
    return res.json({ formulas });
  } catch (err) {
    console.error("Error fetching VDS formulas from DB Test:", err);
    return res.json({ formulas: ADMIN_VDS_FORMULA_REGISTRY });
  }
});

router.post("/lines/vds-formulas", async (req, res) => {
  const formula = String(req.body?.formula || "")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();
  const lines = uniqueStrings(req.body?.lines);
  const pages = uniqueStrings(req.body?.pages).filter(
    (page) => TAB_LINES[page],
  );
  const costCenterPrefixes = uniqueStrings(req.body?.costCenterPrefixes, {
    uppercase: true,
  });

  if (!formula || !formula.includes("VDS")) {
    return res.status(400).json({ error: "Formula name must contain VDS" });
  }
  if (formula.length > 120) {
    return res.status(400).json({ error: "Formula name is too long" });
  }
  if (lines.length === 0) {
    return res.status(400).json({ error: "Select at least one member line" });
  }
  if (pages.length === 0) {
    return res.status(400).json({ error: "Select at least one display page" });
  }

  try {
    const query = `
      INSERT INTO public.manhour_line_mappings 
        (parent_line_name, shifts, child_lines, display_pages, main_category, formula_groups, cost_center_prefixes, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      ON CONFLICT (parent_line_name) 
      DO UPDATE SET
        child_lines = EXCLUDED.child_lines,
        display_pages = EXCLUDED.display_pages,
        cost_center_prefixes = EXCLUDED.cost_center_prefixes,
        updated_at = NOW();
    `;
    await pool_test.query(query, [
      formula,
      JSON.stringify([]),
      JSON.stringify(lines),
      JSON.stringify(pages),
      JSON.stringify([]),
      JSON.stringify([]),
      JSON.stringify(costCenterPrefixes),
    ]);

    LINE_GROUPS[formula] = lines;
    pages.forEach((page) => {
      if (TAB_LINES[page] && !TAB_LINES[page].includes(formula)) {
        TAB_LINES[page].push(formula);
      }
    });

    await clearManhourDataCache();
    broadcastManhourChange([]);
    return res.status(201).json({
      ok: true,
      formula,
      rule: { lines, pages, costCenterPrefixes },
    });
  } catch (error) {
    console.error("Error saving VDS formula to DB Test:", error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Unable to save VDS",
    });
  }
});

router.delete("/lines/vds-formulas/:formula", async (req, res) => {
  const formula = String(req.params.formula || "")
    .trim()
    .toUpperCase();
  if (!formula) {
    return res.status(400).json({ error: "Formula name is required" });
  }

  try {
    await pool_test.query("DELETE FROM public.manhour_line_mappings WHERE parent_line_name = $1", [formula]);
    delete LINE_GROUPS[formula];
    Object.keys(TAB_LINES).forEach((page) => {
      TAB_LINES[page] = TAB_LINES[page].filter((item) => item !== formula);
    });

    await clearManhourDataCache();
    broadcastManhourChange([]);
    return res.json({ ok: true, formula });
  } catch (error) {
    console.error("Error deleting VDS formula from DB Test:", error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Unable to delete VDS formula",
    });
  }
});

// ==============================================
// 🐘 PostgreSQL (Database "Test" via pool_test) Line Mappings
// ==============================================

// 1. GET: ดึงรายการ Line Mapping ทั้งหมดจาก DB "Test"
router.get("/lines/custom-mappings", async (req, res) => {
  try {
    const result = await pool_test.query(`
      SELECT parent_line_name, shifts, child_lines, display_pages, main_category, formula_groups, cost_center_prefixes
      FROM public.manhour_line_mappings
      ORDER BY parent_line_name ASC
    `);
    const mappings = {};
    result.rows.forEach((row) => {
      mappings[row.parent_line_name] = {
        shifts: Array.isArray(row.shifts) ? row.shifts : JSON.parse(row.shifts || "[]"),
        lines: Array.isArray(row.child_lines) ? row.child_lines : JSON.parse(row.child_lines || "[]"),
        displayPages: Array.isArray(row.display_pages) ? row.display_pages : JSON.parse(row.display_pages || "[]"),
        macroGroups: Array.isArray(row.main_category) ? row.main_category : JSON.parse(row.main_category || "[]"),
        formulaGroups: Array.isArray(row.formula_groups) ? row.formula_groups : JSON.parse(row.formula_groups || "[]"),
        costCenterPrefixes: Array.isArray(row.cost_center_prefixes) ? row.cost_center_prefixes : JSON.parse(row.cost_center_prefixes || "[]"),
      };
    });
    return res.json({ ok: true, data: mappings });
  } catch (err) {
    console.error("Error fetching line mappings from DB Test:", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// 2. POST: บันทึก/อัปเดต Line Mapping ลง DB "Test" (Upsert)
router.post("/lines/custom-mappings", async (req, res) => {
  const { parent, shifts, lines, displayPages, macroGroups, formulaGroups, costCenterPrefixes } = req.body || {};
  const parentName = String(parent || "").trim().toUpperCase();

  if (!parentName) {
    return res.status(400).json({ ok: false, error: "Parent line name is required" });
  }

  try {
    const query = `
      INSERT INTO public.manhour_line_mappings 
        (parent_line_name, shifts, child_lines, display_pages, main_category, formula_groups, cost_center_prefixes, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      ON CONFLICT (parent_line_name) 
      DO UPDATE SET
        shifts = EXCLUDED.shifts,
        child_lines = EXCLUDED.child_lines,
        display_pages = EXCLUDED.display_pages,
        main_category = EXCLUDED.main_category,
        formula_groups = EXCLUDED.formula_groups,
        cost_center_prefixes = EXCLUDED.cost_center_prefixes,
        updated_at = NOW();
    `;
    await pool_test.query(query, [
      parentName,
      JSON.stringify(shifts || []),
      JSON.stringify(lines || []),
      JSON.stringify(displayPages || []),
      JSON.stringify(macroGroups || []),
      JSON.stringify(formulaGroups || []),
      JSON.stringify(costCenterPrefixes || []),
    ]);

    await clearManhourDataCache();
    broadcastManhourChange([]);
    return res.json({ ok: true, message: `Saved line mapping for ${parentName} successfully` });
  } catch (err) {
    console.error("Error saving line mapping to DB Test:", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// 3. DELETE: ลบ Line Mapping ออกจาก DB "Test"
router.delete("/lines/custom-mappings/:parent", async (req, res) => {
  const parentName = String(req.params.parent || "").trim().toUpperCase();
  if (!parentName) {
    return res.status(400).json({ ok: false, error: "Parent line name is required" });
  }

  try {
    await pool_test.query("DELETE FROM public.manhour_line_mappings WHERE parent_line_name = $1", [parentName]);
    await clearManhourDataCache();
    broadcastManhourChange([]);
    return res.json({ ok: true, message: `Deleted ${parentName} successfully` });
  } catch (err) {
    console.error("Error deleting line mapping from DB Test:", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
module.exports.default = router;
