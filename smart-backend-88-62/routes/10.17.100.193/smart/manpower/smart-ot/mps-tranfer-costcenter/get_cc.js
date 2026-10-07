const express = require("express");
const router = express.Router();
const { pool_iot } = require("../../../../config");

const query = (text, params) => pool_iot.query(text, params);
router.get("/", async (req, res) => {
  try {
    let { factory } = req.query;
    let queryStr =`
with raw_master as (
      select
      mhr_cc,
      mhr_cc_desc,
      mhr_cc_type 
      from
      manpower.k1_smart_man_cc_master_mhr
      union all
      select
      mhr_cc,
      mhr_cc_desc,
      mhr_cc_type 
      from
      manpower.p1_smart_man_cc_master_mhr
      --union all
      --select
      -- mhr_cc,
      -- mhr_cc_desc,
--      mhr_cc_type 
      --from
      -- manpower.n1_smart_man_cc_master_mhr
      --union all
      --select
      -- mhr_cc,
      -- mhr_cc_desc,
--      mhr_cc_type 
      --from
      -- manpower.a1_smart_man_cc_master_mhr
      ), final_data as (
      select
      case
        when mhr_cc like 'K%' then 'K1'
        when mhr_cc like 'P%' then 'P1'
        when mhr_cc like 'N%' then 'N1'
        when mhr_cc like 'A%' then 'A1'
        else 'check'
      end as factory,
      mhr_cc,
      mhr_cc_desc,
      mhr_cc_type 
      from
      raw_master
      )
      select *
      from final_data
      where factory =  $1
    `;
    let params =[factory];
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
