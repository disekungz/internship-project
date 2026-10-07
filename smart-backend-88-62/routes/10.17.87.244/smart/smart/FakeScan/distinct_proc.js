const express = require("express");
const router = express.Router();

const { pool_smart } = require("../../../config");
const query = (text, params) => pool_smart.query(text, params);

router.get("/", async (req, res) => {
  try {
    // 💡 เติม ::text เพื่อล็อค Type และไม่ส่ง params ที่ไม่ได้ใช้ออกไป
    let queryStr = `
        SELECT DISTINCT proc_disp
        FROM smart.smart_fpc_lot_wip_history 
        WHERE factory_code::text = '9'
        ORDER BY proc_disp
    `;

    const result = await query(queryStr); // ❌ ตัด params ออกตรงนี้

    if (result.rows.length > 0) {
      return res.json({
        status: "OK",
        data: result.rows,
        message: "Data found",
      });
    } else {
      return res.json({
        status: "OK",
        data: [],
        message: "No data found",
      });
    }
  } catch (err) {
    console.error(err.message);
    return res.json({
      status: "ERROR",
      data: [],
      message: err.message,
    });
  }
});

module.exports = router;