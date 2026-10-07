const express = require("express");
const router = express.Router();

const { pool_iot } = require("../../../../config");
const query = (text, params) => pool_iot.query(text, params);

router.post("/", async (req, res) => {
  const {
    id,
    root_cause,
    action,
    action_by,
    action_date,
    approve_by,
    approve_date,
  } = req.body;

  try {
    let params = [
      id,
      root_cause,
      action,
      action_by,
      action_date,
      approve_by,
      approve_date,
    ];
    let queryStr = `
    UPDATE smt.smt_aoi_output_analysis_action 
    SET
      root_cause = $2,
      "action" = $3,
      action_by = $4,
      action_date = $5,
      approve_by = $6,
      approve_date = $7
    WHERE
      id = $1
    RETURNING *;
  `;
    const result = await query(queryStr, params);

    if (result.rows.length > 0) {
      res.json({
        status: "OK",
        data: result.rows,
        message: "Data updated successfully",
      });
    } else {
      return res.status(404).json({
        status: "ERROR",
        data: [],
        message: `No record found matching the ID: ${id}`,
      });
    }
  } catch (err) {
    console.error("Error executing query:", err.message);
    res.status(500).json({
      status: "ERROR",
      data: [],
      message: err.message,
    });
  }
});
module.exports = router;
