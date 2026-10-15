// ----------------------------------------------------------------------------
// Gate process filter (smart.smart_pln_product_routing_list, gate_proc = 'Y')
// gate เป็นค่ารายคู่ product + process — ตัด '-' ออกจากชื่อ product ก่อนเทียบ
// เพราะแต่ละตารางเก็บ prd_name ทั้งแบบมีขีดและไม่มีขีด
// ----------------------------------------------------------------------------

// CTE สำหรับใส่หลัง WITH
const GATE_PAIRS_CTE = `
  gate_pairs AS (
    SELECT DISTINCT
      REPLACE(TRIM(prd_name), '-', '') AS prd_key,
      TRIM(proc_disp) AS proc
    FROM smart.smart_pln_product_routing_list
    WHERE UPPER(TRIM(gate_proc)) = 'Y'
  )
`;

// เงื่อนไข EXISTS — prdCol / procCol คือคอลัมน์ของตารางที่ต้องการกรอง
const gateExists = (prdCol = "prd_name", procCol = "proc_disp") => `
  EXISTS (
    SELECT 1 FROM gate_pairs g
    WHERE g.prd_key = REPLACE(TRIM(${prdCol}), '-', '')
      AND g.proc = TRIM(${procCol})
  )
`;

module.exports = { GATE_PAIRS_CTE, gateExists };
