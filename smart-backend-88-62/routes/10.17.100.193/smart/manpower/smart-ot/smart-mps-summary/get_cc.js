const express = require("express");
const router = express.Router();
const { pool_iot } = require("../../../../config");

const query = (text, params) => pool_iot.query(text, params);
router.get("/", async (req, res) => {
  try {
    let { factory } = req.query;
    let queryStr=` 
    with data_cc as (
    --k1
    select
      mhr_dept,
      mhr_cc,
      mhr_cc_desc,
      'K1' as factory
    from
      manpower.k1_smart_man_cc_master_mhr
    union all

    --p1
    select
      mhr_dept,
      mhr_cc,
      mhr_cc_desc,
      'P1' as factory
    from
      manpower.p1_smart_man_cc_master_mhr
    )
    select * from data_cc 
    where factory = $1
    `;
    const params = [factory];    
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
