const express = require("express");
const router = express.Router();

const { pool_iot } = require("../../../../config");
const query = (text, params) => pool_iot.query(text, params);

router.get("/", async (req, res) => {
  const {
    startdate,
    stopdate,
    machine_no = "ALL",
    model = "ALL",
    parts_name = "ALL",
    item_reject_desc = "ALL",
    // layer = "ALL",

    // out_con,
    // out_spec,
  } = req.query;

  // Validate the input parameters
  if (!startdate || !stopdate) {
    return res.status(400).json({
      status: "ERROR",
      message: "startdate and stopdate are required",
    });
  }

  try {
    // SQL query with parameters
    const params = [
      startdate,
      stopdate, //layer,ในquery ด้านล่าง
    ];
    let queryStr = `
       select
        a.id,
        TO_CHAR(a.update_date, 'YYYY-MM-DD HH24:MI') as update_date,
        a.aor_machine_no AS machine_no,
        a.aor_program_name AS model,
        a.inspect_month,       
        a.aor_lot_no AS lot_no,
        a.ref_name AS parts_name,
        a.item_reject_desc,
        a.total_input,
        a.reject_count,
        b.cal_month,
        a.pi,
        b.p_cl,
        b.p_ucl,
        b.p_lcl,
        CASE 
                WHEN a.pi > b.p_ucl THEN true 
                ELSE false 
            END as is_out_control
        
      from
        smt.smt_aoi_pchart_analysis a
      INNER join  
        smt.smt_aoi_pchart_ucl_lcl b
      ON
        a.aor_machine_no = b.aor_machine_no
            AND  a.aor_program_name = b.aor_program_name        
            AND a.ref_name = b.ref_name
            AND a.item_reject_desc = b.item_reject_desc
            AND a.inspect_month = b.cal_month
	  WHERE a.update_date >= $1::date
        AND a.update_date < ($2::date + interval '1 day')

        -- 2. เพิ่มเงื่อนไข: บังคับให้เดือนในตารางตรงกับเดือนของ startdate ($1)
            -- สมมติ cal_month เก็บเป็น 'YYYY-MM' เช่น '2026-04'
            AND b.cal_month = TO_CHAR($1::date, 'YYYY-MM')
            AND a.inspect_month = TO_CHAR($1::date, 'YYYY-MM')

             --     AND ($3 = 'ALL' OR aor_machine_no = $3)
             --     AND ($4 = 'ALL' OR aor_program_name = $4)
             --     AND ($5 = 'ALL' OR ref_name = $5)
             --     AND ($6 = 'ALL' OR item_reject_desc = $6)
      
    `;

    if (machine_no !== "ALL" && machine_no !== "") {
      params.push(machine_no);
      queryStr += ` AND a.aor_machine_no = $${params.length} `;
    }
    if (model !== "ALL" && model !== "") {
      params.push(model);
      queryStr += ` AND a.aor_program_name = $${params.length} `;
    }
    if (parts_name !== "ALL" && parts_name !== "") {
      params.push(parts_name);
      queryStr += ` AND a.ref_name = $${params.length} `;
    }
    if (item_reject_desc !== "ALL" && item_reject_desc !== "") {
      params.push(item_reject_desc);
      queryStr += ` AND a.item_reject_desc = $${params.length} `;
    }
    // if (out_spec === "true") {
    //   queryStr += ` AND spc_xr_0 is true `;
    // }
    // if (out_con === "true") {
    //   queryStr += ` AND spc_xr_1 is true `;
    // }
    queryStr += ` ORDER BY update_date `;
    const result = await query(queryStr, params);

    // Respond with appropriate data
    if (result.rows.length > 0) {
      return res.json({
        status: "OK",
        data: result.rows,
        message: "Data found",
      });
    } else {
      return res.json({
        status: "OK",
        data: [],
        message: "No data found",
      });
    }
  } catch (err) {
    console.error("Database error:", err.message);
    return res.status(500).json({
      status: "ERROR",
      message: "Internal Server Error",
    });
  }
});

module.exports = router;
