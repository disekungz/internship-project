const express = require("express");
const router = express.Router();
const { pool_iot } = require("../../../../config");

const query = (text, params) => pool_iot.query(text, params);
router.get("/", async (req, res) => {
  try {
    let {cost_center} = req.query;
    let queryStr =
      `
    select
      map_id_sv,
      map_sv_name,
      map_sv_cc
    from
      manpower.k1_smart_man_approve_sv_map
    where 1=1 
      `
      ;
    const params = [];
    if(cost_center){
      params.push(cost_center);
      queryStr+=` AND map_sv_cc = $${params.length}`
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
