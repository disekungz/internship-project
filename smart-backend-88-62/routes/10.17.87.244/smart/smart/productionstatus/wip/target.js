const express = require('express');
const { pool_smart } = require('../../../../config');
const query = (text, params) => pool_smart.query(text, params);
const { readPersistentCache, writePersistentCache } = require('../../../../../../Utility/persistentCache');

const router = express.Router();
let targetCache = null;
let targetRefreshInFlight = false;
const TARGET_CACHE_TTL_MS = 5 * 60 * 1000;

// (Target P1)
router.get('/', async (req, res) => {
  if (!targetCache) targetCache = await readPersistentCache('wip-target-v3');
  if (targetCache && Date.now() - targetCache.savedAt < TARGET_CACHE_TTL_MS) {
    res.set('X-Data-Cache', 'HIT');
    return res.status(200).json(targetCache.data);
  }
  if (targetCache && req.query.refresh !== '1') {
    res.set('X-Data-Cache', 'STALE-WHILE-REVALIDATE');
    if (!targetRefreshInFlight) {
      targetRefreshInFlight = true;
      setImmediate(() => {
        fetch('http://127.0.0.1:8080/api_p1/production_status/wip/target?refresh=1')
          .catch(error => console.error('[target/cache] Background refresh failed:', error.message))
          .finally(() => { targetRefreshInFlight = false; });
      });
    }
    return res.status(200).json(targetCache.data);
  }
  let targetTasks = [];

  try {
    const targetQuery = `
      SELECT 
        date AS effective_date, 
        p1,
        fpc_total,
        fpc_gen,
        fpc_automotive,
        smt_total,
        smt_gen,
        smt_automotive
      FROM smart.smart_fpc_smt_target_wip_history
    `;
    const targetResult = await query(targetQuery);

    if (targetResult && targetResult.rows) {
      targetTasks = targetResult.rows.map((row, index) => {
        
        let isoDate = "";
        if (row.effective_date) {
          try {
            const d = new Date(row.effective_date);
            // แปลงวันที่ให้อยู่ในฟอร์แมต YYYY-MM-DD
            isoDate = !isNaN(d.getTime()) ? d.toISOString().split('T')[0] : "";
          } catch (e) {
            isoDate = "";
          }
        }
        
        return {
          id: index + 900000,
          status: 'target',
          effective_date: isoDate, 
          p1: Number(row.p1 || 0),
          fpc_total: Number(row.fpc_total || 0),
          fpc_gen: Number(row.fpc_gen || 0),
          fpc_automotive: Number(row.fpc_automotive || 0),
          smt_total: Number(row.smt_total || 0),
          smt_gen: Number(row.smt_gen || 0),
          smt_automotive: Number(row.smt_automotive || 0),
        };
      });
    }
    targetCache = { savedAt: Date.now(), data: targetTasks };
    writePersistentCache('wip-target-v3', targetCache)
      .catch(error => console.error('[target/cache] Save failed:', error.message));
    res.set('X-Data-Cache', 'MISS');
    res.status(200).json(targetTasks);

  } catch (targetError) {
    console.error("🚨 เกิดข้อผิดพลาดใน Target History:", targetError.message || targetError);
    if (targetCache) {
      res.set('X-Data-Cache', 'STALE');
      return res.status(200).json(targetCache.data);
    }
    res.status(500).json({ error: "ไม่สามารถดึงข้อมูล Target History ได้" });
  }
});

module.exports = router;
