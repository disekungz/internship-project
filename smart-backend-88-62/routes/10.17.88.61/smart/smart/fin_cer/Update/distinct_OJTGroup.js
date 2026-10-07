const express = require("express");
const router = express.Router();

const { pool_smartb } = require("../../../../config");
const query = (text, params) => pool_smartb.query(text, params);

router.get("/", async (req, res) => {
  const {head, line, dept } = req.query;
  try {
    let queryStr = `

        SELECT DISTINCT group_ojt
        FROM smart.smart_man_tco_certificate 
        WHERE 1=1

    `;
    const params = [];
    let paramIndex = 1;

    // 👥 3. เช็คกลุ่ม line
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

    // 👔 5. เช็ค dept
    if (dept && dept !== "ALL" && dept !== "undefined") {
      queryStr += ` AND dept = $${paramIndex}`;
      params.push(dept);
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
    return res.status(500).json({
      status: "ERROR",
      data: [],
      message: err.message,
    });
  }
});

module.exports = router;
