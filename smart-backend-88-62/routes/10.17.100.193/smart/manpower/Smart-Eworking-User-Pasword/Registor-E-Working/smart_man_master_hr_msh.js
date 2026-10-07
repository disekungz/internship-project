const express = require("express");
const router = express.Router();
const { Pool } = require("pg");

const pool = new Pool({
  host: "10.17.66.123",
  port: 5432,
  user: "postgres",
  password: "30vNWICm8ueay2gj",
  database: "iot",
  application_name: "express-api-3000",
});

const query = (text, params) => pool.query(text, params);

//distinct_proc_grp

router.get("/distinct_id_code", async (req, res) => {
  try {
    const {} = req.query;
    let query = `
    select
	distinct msh_id_code as id_code
from
	smart.smart_man_master_hr_msh
order by msh_id_code asc`;

    const queryParams = [];

    const result = await pool.query(query, queryParams);
    res.json(result.rows);
  } catch (error) {
    console.error("Error executing query:", error);
    res.status(500).json({ error: "An error occurred" });
  }
});

router.get("/Usernamesurname", async (req, res) => {
  try {
    const { id_code } = req.query;
    let query = `
select
	msh_id_code as id_code,
	msh_name_eng as "name",
	msh_name_th as surname,
	msh_cc as cost_center,
	msh_car_infor as car_infor,
	msh_stop_car as stop_car, 
	id
from
	smart.smart_man_master_hr_msh
    `;

    const queryParams = [];

    if (id_code && id_code !== "ALL") {
      if (queryParams.length === 0) {
        query += `WHERE`;
      } else {
        query += `WHERE`;
      }
      query += ` msh_id_code = $${queryParams.length + 1}
      `;
      queryParams.push(id_code);
    }

    const result = await pool.query(query, queryParams);
    res.json(result.rows);
  } catch (error) {
    console.error("Error executing query:", error);
    res.status(500).json({ error: "An error occurred" });
  }
});

module.exports = router;
