const express = require("express");
const router = express.Router();
const { pool_iot } = require("../../../../config");

const query = (text, params) => pool_iot.query(text, params);

router.get("/", async (req, res) => {
  try {
    let { data, from_date, to_date, factory } = req.query;

    // 🔹 ถ้าไม่ส่งวันที่มา ให้ default เป็นวันนี้
    const today = new Date().toISOString().split("T")[0];
    from_date = from_date || today;
    to_date = to_date || today;

    let queryStr = `
    select 
      to_char(c.dsn_date_time, 'YYYY-MM-DD HH24:MI:SS') as dsn_date_time,
      c.id_no,
      t.name_th,
      c.dsn_select_date,
      c.dsn_con_wk,
      c.dsn_process_cc,
      split_part(t.supervisor, '] ', 2) as supervisor,
      c.dsn_department,
      h.pickup_point,
      h.rount
    from 
      manpower.p1_smart_man_working_input_dsn c 
    left join manpower.p1_smart_man_name_list_master t
      on c.id_no = t.employee_id 
    left join manpower.p1_smart_man_bus_route_master h
      on c.id_no = h.emp_id
    where c.dsn_select_date::date BETWEEN $1 AND $2
    `;

    let params = [from_date, to_date];

    if (factory) {
      params.push(factory);
      queryStr += ` and h.factory = $${params.length}`;
    }

    if (data) {
      params.push(data);
      queryStr += ` and c.verify_status = ANY($${params.length})`;
    }

    queryStr += ` order by c.dsn_select_date desc`;

    let result = await query(queryStr, params);

    return res.status(200).send({
      status: "OK",
      message: "successfully!",
      data: result.rows,
    });
  } catch (error) {
    console.log(error.message);
    res.status(500).send({
      status: "ERROR",
      message: error.toString(),
    });
  }
});

module.exports = router;
