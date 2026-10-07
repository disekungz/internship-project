const express = require("express");
const router = express.Router();

const { pool_iot } = require("../../../config");
const query = (text, params) => pool_iot.query(text, params);

router.get("/", async (req, res) => {
  const { pw_save } = req.query;
  try {
    let params = [pw_save];
    let queryStr = `
        SELECT DISTINCT
            employee_id,
            password as pw_save 
            -- pw_unlock
        FROM
          smt.smt_user_print
        WHERE
            password = $1
    `;

    const result = await query(queryStr, params);

    // Always return status 200 with "OK" for the API response
    return res.status(200).json({
      status: "OK",
      data: result.rows || [],
      message: result.rows.length > 0 ? "Data found" : "No data found",
    });
  } catch (err) {
    console.error(err.message);
    // In case of an error, log it and send a status 500 response
    return res.status(500).json({
      status: "ERROR",
      data: [],
      message: err.message,
    });
  }
});

module.exports = router;
