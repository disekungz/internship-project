const express = require("express");
const router = express.Router();
const { pool_iot } = require("../../../../config");

const query = (text, params) => pool_iot.query(text, params);
router.patch("/", async (req, res) => {
  try {
    let {pickup,rount,code_id} = req.query;
    let queryStr =
      `
      update
        manpower.p1_smart_man_bus_route_master
      set
        update_date = now(),
        pickup_point = $1,
        rount = $2
      where
        emp_id = $3;
      `
      ;
    const params = [pickup,rount,code_id];
    let result = await query(queryStr, params);
      return res.status(200).send({
        status: "OK",
        message: "Update successfully!",
        data: result.rows,
      });
    // }
  } catch (error) {
    res.status(500).send({
      status: "ERROR",
      message: error.toString(),
    });
  }
});

module.exports = router;
