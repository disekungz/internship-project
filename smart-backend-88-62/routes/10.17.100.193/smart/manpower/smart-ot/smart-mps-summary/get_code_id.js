const express = require("express");
const router = express.Router();
const { pool_iot } = require("../../../../config");

const query = (text, params) => pool_iot.query(text, params);
router.get("/", async (req, res) => {
  try {
    let { factory } = req.query;
    let queryStr=` 
    select
      distinct
      mps_factory,
      mps_emp_id,
      mps_emp_name_thai,
      mps_emp_name_eng
    from
      manpower.smart_man_mps_database_master
    where 1=1
    `;
    const params = [];
    if (factory) {
      params.push(factory);
      queryStr += ` and mps_factory = $${params.length}`
    }
    
    let result = await query(queryStr, params);
    if (result.rows.length === 0) {
      return res.status(200).send({
        status: "ERROR",
        message: "not found data",
        data: [],
      });
    } else {
      return res.status(200).send({
        status: "OK",
        message: "successfully!",
        data: result.rows,
      });
    }
  } catch (error) {
    res.status(500).send({
      status: "ERROR",
      message: error.toString(),
    });
  }
});

module.exports = router;
