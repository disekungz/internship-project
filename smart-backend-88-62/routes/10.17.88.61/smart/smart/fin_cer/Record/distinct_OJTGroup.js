const express = require("express");
const router = express.Router();

const { pool_smartb } = require("../../../../config");
const query = (text, params) => pool_smartb.query(text, params);

router.get("/", async (req, res) => {
  const { fromDate, toDate, head, line } = req.query;
  try {
    let queryStr = `

        SELECT DISTINCT group_ojt
        FROM smart.smart_man_tco_inspection_record 
        WHERE 1=1

    `;
    const params = [];
    let paramIndex = 1;

    // 📅 2. ลอจิกวันที่แบบเสถียร (เปรียบเทียบเฉพาะส่วนของวันที่ ไม่สนใจเศษเวลาวินาที)
    if (fromDate && toDate) {
      queryStr += ` AND created_at::date BETWEEN $${paramIndex}::date AND $${paramIndex + 1}::date`;
      params.push(fromDate);
      params.push(toDate);
      paramIndex += 2;
    }

    // 👥 3. เช็คกลุ่ม OJT
    if (line && line !== "ALL" && line !== "undefined") {
      queryStr += ` AND line = $${paramIndex}`;
      params.push(line);
      paramIndex++;
    }

    // 👔 4. เช็ค Leader / Head
    if (head && head !== "ALL" && head !== "undefined") {
      queryStr += ` AND head = $${paramIndex}`;
      params.push(head);
      paramIndex++;
    }

    queryStr += ` ORDER BY group_ojt;`;

    const result = await query(queryStr, params);

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
