const express = require("express");
const router = express.Router();
const { pool_iot } = require("../../../../config");

const query = (text, params) => pool_iot.query(text, params);
router.get("/", async (req, res) => {
  try {
    let { factory } = req.query;
    let queryStr = `
        WITH b_agg AS (
        SELECT
            b.dsn_select_date,
            b.id_no,
            b.dsn_con_wk
        FROM manpower.p1_smart_man_working_input_dsn b
        -- ถ้ามีเงื่อนไขของ b ให้ใส่ "ในนี้" ได้เลย (ไม่ทำให้ a หาย)
        -- WHERE b.dsn_select_date = DATE '2026-02-02'
        --  where b.dsn_select_date = '2026-01-13'   ---select date 'dsn_select_date'
        where b.dsn_select_date = TO_CHAR(CURRENT_DATE, 'YYYY-MM-DD')
        )
        select 
        -- id,
        -- create_date,
        -- update_date,
        TO_CHAR(CURRENT_DATE, 'YYYY-MM-DD') AS update_date,
        a.factory,
        -- a.emp_id,
        -- pickup_point,
        a.rount,
        -- b.dsn_con_wk,
        -- ba.dsn_select_date,
        COUNT(DISTINCT a.emp_id) as employee_cnt,
        COUNT(DISTINCT a.emp_id) - count(ba.dsn_con_wk) as normal_cnt,
        count(ba.dsn_con_wk) as ot_cnt
        from
        manpower.p1_smart_man_bus_route_master a
        left join b_agg ba
        ON  ba.id_no = a.emp_id 
        where 1=1
        --and TO_CHAR(CURRENT_DATE, 'YYYY-MM-DD') = ba.dsn_select_date

        `;
    ;
    const last_query = ` 
    group by a.factory, a.rount
    order by employee_cnt desc;
    `
    const params = [];
    if (factory) {
      params.push(factory);
      queryStr += ` and a.factory = $${params.length}`
    }
    queryStr += last_query;
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
