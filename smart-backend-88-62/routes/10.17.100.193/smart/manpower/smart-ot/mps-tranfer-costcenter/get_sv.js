const express = require("express");
const router = express.Router();
const { pool_iot } = require("../../../../config");

const query = (text, params) => pool_iot.query(text, params);
router.get("/", async (req, res) => {
  try {
    let { cost_center, factory } = req.query;
    let queryStr;
    //k1
    let queryStrK1 =
      `
        select distinct map_id_sv ,map_sv_name, map_sv_cc 
        FROM manpower.k1_smart_man_approve_sv_map 
        where map_sv_cc = $1
      `
      ;
      //p1
    let queryStrP1 =
      `
        select distinct map_id_sv ,map_sv_name, map_sv_cc 
        FROM manpower.p1_smart_man_approve_sv_map 
        where map_sv_cc = $1
      `
      ;
      //n1
    let queryStrN1 =
      `
        select distinct map_id_sv ,map_sv_name, map_sv_cc 
        FROM manpower.n1_smart_man_approve_sv_map 
        where map_sv_cc = $1
      `
      ;
      //a1
    let queryStrA1 =
      `
        select distinct map_id_sv ,map_sv_name, map_sv_cc 
        FROM manpower.a1_smart_man_approve_sv_map 
        where map_sv_cc = $1
      `
      ;
      //..add factry..//
    const params = [cost_center];
    if (factory === 'K1') {
      queryStr = queryStrK1;
    } else if (factory === 'P1') {
      queryStr = queryStrP1;
    }else if (factory === 'N1') {
      queryStr = queryStrN1;
    }else if (factory === 'A1') {
      queryStr = queryStrA1;
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
