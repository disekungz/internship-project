const express = require("express");
const router = express.Router();
const { pool_iot } = require("../../../../config");

const query = (text, params) => pool_iot.query(text, params);
router.get("/", async (req, res) => {
  try {
    let { code_id,status } = req.query;
    const queryStr =
      `
      select
      map_id_sv,
      map_sv_name,
      map_sv_cc
    from
      manpower.p1_smart_man_approve_sv_map
    where map_id_sv=$1;
      `
      ;
    let result = await query(queryStr, [code_id]);

    if (result.rows.length === 0) {
      return res.status(200).send({
        status: "ERROR",
        message: "not found data",
        data: result.rows,
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
