const express = require("express");
const router = express.Router();

const { pool_iot } = require("../../../../config");
const query = (text, params) => pool_iot.query(text, params);

router.get("/", async (req, res) => {
  const {
    startdate,
    stopdate,
    model = "ALL",
    machine_no = "ALL",
    // parts_name = "ALL",
    // item_reject_desc = "ALL",
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
        id,
        TO_CHAR(created_at, 'YYYY-MM-DD HH24:MI') as created_at,
        device_id AS machine_no,
        model_name AS model,   
        lot_id AS lot_no,
        total_input,
        reject_count,
        yield,
        std_target
      from
        smt.smt_aoi_output_analysis
	WHERE created_at >= $1::date
        AND created_at < ($2::date + interval '1 day')
             --     AND ($3 = 'ALL' OR aor_machine_no = $3)
             --     AND ($4 = 'ALL' OR aor_program_name = $4)
             --     AND ($5 = 'ALL' OR ref_name = $5)
             --     AND ($6 = 'ALL' OR item_reject_desc = $6)
      
    `;

    if (machine_no !== "ALL" && machine_no !== "") {
      params.push(machine_no);
      queryStr += ` AND device_id = $${params.length} `;
    }
    if (model !== "ALL" && model !== "") {
      params.push(model);
      queryStr += ` AND model_name = $${params.length} `;
    }
    // if (parts_name !== "ALL" && parts_name !== "") {
    //   params.push(parts_name);
    //   queryStr += ` AND a.ref_name = $${params.length} `;
    // }
    // if (item_reject_desc !== "ALL" && item_reject_desc !== "") {
    //   params.push(item_reject_desc);
    //   queryStr += ` AND a.item_reject_desc = $${params.length} `;
    // }
    // if (out_spec === "true") {
    //   queryStr += ` AND spc_xr_0 is true `;
    // }
    // if (out_con === "true") {
    //   queryStr += ` AND spc_xr_1 is true `;
    // }
    queryStr += ` ORDER BY created_at `;
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
    // สำคัญมาก: เปลี่ยนตรงนี้เพื่อดูว่า Database ฟ้องว่าอะไร
    console.error("DEBUG SQL ERROR:", err.message);
    return res.status(500).json({
      status: "ERROR",
      message: err.message, // ส่ง error จริงกลับไปดูที่หน้าจอหรือ Postman
      detail: "Check console for full error",
    });
  }
});

module.exports = router;
