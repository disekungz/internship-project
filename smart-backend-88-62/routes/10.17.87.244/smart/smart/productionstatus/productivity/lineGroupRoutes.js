const express = require("express");
const router = express.Router();
const { pool_test } = require("../../../../config");

// GET /api_p1/production_status/productivity/line-groups
router.get("/", async (req, res) => {
  try {
    const { rows } = await pool_test.query(`
      SELECT group_name, process_name, mc_line, prd_prefix, exclude_prefixes,
             COALESCE(factory, 'SMT') as factory, id,
             CASE WHEN COALESCE(factory, 'SMT') = 'FPC' THEN 1 ELSE 2 END as factory_order
      FROM public.line_output_mapping 
      WHERE group_name IS NOT NULL AND is_active = TRUE
      ORDER BY factory_order ASC, id ASC
    `);

    const groupMap = new Map();
    rows.forEach(row => {
      if (!groupMap.has(row.group_name)) {
        groupMap.set(row.group_name, {
          name: row.group_name,
          processes: new Set(),
          mcLines: new Set(),
          prefixes: new Set(),
          excludePrefixes: new Set(),
          factory: row.factory
        });
      }
      const g = groupMap.get(row.group_name);
      if (row.process_name) g.processes.add(row.process_name.trim().toUpperCase());
      if (row.mc_line) g.mcLines.add(row.mc_line.trim().toUpperCase());
      if (row.prd_prefix) {
        row.prd_prefix.split(/[\n,]+/).map(p => p.trim().toUpperCase()).filter(Boolean).forEach(p => g.prefixes.add(p));
      }
      if (row.exclude_prefixes) {
        row.exclude_prefixes.split(/[\n,]+/).map(p => p.trim().toUpperCase()).filter(Boolean).forEach(p => g.excludePrefixes.add(p));
      }
    });

    const result = Array.from(groupMap.values()).map(g => ({
      name: g.name,
      processes: Array.from(g.processes),
      mcLines: Array.from(g.mcLines),
      prefixes: Array.from(g.prefixes),
      excludePrefixes: Array.from(g.excludePrefixes),
      factory: g.factory || 'SMT'
    }));

    res.json(result);
  } catch (error) {
    console.error("[LineGroups] Error fetching line groups:", error.message);
    res.status(500).json({ error: "Failed to fetch line groups" });
  }
});

module.exports = router;
