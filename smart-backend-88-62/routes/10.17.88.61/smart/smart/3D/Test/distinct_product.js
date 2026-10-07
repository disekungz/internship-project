const express = require("express");
const router = express.Router();

const { pool_smart61 } = require("../../../../config");
const query = (text, params) => pool_smart61.query(text, params);

router.get("/", async (req, res) => {

  try {
    let queryStr = `

        SELECT DISTINCT product
        FROM cr.smart_pln_cr_product_master
        WHERE  item LIKE '94%'
            OR item LIKE '95%'
        
    `;

    const last_query = `ORDER BY product`;
    queryStr += last_query;
    const result = await query(queryStr);

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