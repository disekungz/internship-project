const express = require("express");
const router = express.Router();
const { pool_iot } = require("../../../../config");

router.post("/", async (req, res) => {
  const client = await pool_iot.connect();

  try {
    const { data_new_comer } = req.body;

    if (!Array.isArray(data_new_comer) || data_new_comer.length === 0) {
      return res.status(400).json({
        status: "ERROR",
        message: "Invalid or empty data_new_comer array",
      });
    }

    await client.query("BEGIN");

    //  ดึง employee_id ล่าสุด และ lock row
    const result = await client.query(
      `SELECT employee_id
       FROM manpower.k1_smart_man_name_list_master
       WHERE employee_id LIKE 'M%'
       ORDER BY employee_id DESC
       LIMIT 1
       FOR UPDATE`
    );

    let lastCode = result.rows[0]?.employee_id || "M000000";
    const results = [];

    for (const item of data_new_comer) {
      const nextCode = "M" + String(Number(lastCode.slice(1)) + 1).padStart(6, "0");
      lastCode = nextCode;

      const {
        name_th, name_en, join_date, birthDate, supervisor, gender,
        cost_center_id, cost_center, company, factory,
        position_group, employment_status, job_status, citizen_id,
        pickup, car
      } = item;

      try {
        // ---------------- Master Table ----------------
        const insertMaster = await client.query(
          `
          INSERT INTO manpower.k1_smart_man_name_list_master (
            create_date, update_date, employee_id, name_th, name_eng,
            join_date, birth_date, supervisor, gender,
            cost_center_id, msh_cc, company, factory,
            position_group, employment_status, job_status, id_number
          ) VALUES (
            now() at time zone 'asia/bangkok',
            now() at time zone 'asia/bangkok',
            $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15
          )
          ON CONFLICT (name_th,name_eng) DO UPDATE SET
            update_date = EXCLUDED.update_date,
            name_eng = EXCLUDED.name_eng,
            join_date = EXCLUDED.join_date,
            birth_date = EXCLUDED.birth_date,
            supervisor = EXCLUDED.supervisor,
            gender = EXCLUDED.gender,
            cost_center_id = EXCLUDED.cost_center_id,
            msh_cc = EXCLUDED.msh_cc,
            company = EXCLUDED.company,
            factory = EXCLUDED.factory,
            position_group = EXCLUDED.position_group,
            employment_status = EXCLUDED.employment_status,
            job_status = EXCLUDED.job_status,
            id_number = EXCLUDED.id_number
          RETURNING employee_id
          `,
          [
            nextCode, name_th, name_en, join_date, birthDate,
            supervisor, gender, cost_center_id, cost_center,
            company, factory, position_group, employment_status,
            job_status, citizen_id
          ]
        );

        // ---------------- History Table ----------------
        const insertHistory = await client.query(
          `
          INSERT INTO manpower.k1_k1_smart_man_name_list_master_history (
            create_date, update_date, employee_id, name_th, name_eng,
            join_date, birth_date, supervisor, gender,
            cost_center_id, msh_cc, company, factory,
            position_group, employment_status, job_status, id_number, status, reason
          ) VALUES (
            now() at time zone 'asia/bangkok',
            now() at time zone 'asia/bangkok',
            $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,true,null
          )
          ON CONFLICT (name_th,name_eng) DO UPDATE SET
            update_date = EXCLUDED.update_date,
            name_eng = EXCLUDED.name_eng,
            join_date = EXCLUDED.join_date,
            birth_date = EXCLUDED.birth_date,
            supervisor = EXCLUDED.supervisor,
            gender = EXCLUDED.gender,
            cost_center_id = EXCLUDED.cost_center_id,
            msh_cc = EXCLUDED.msh_cc,
            company = EXCLUDED.company,
            factory = EXCLUDED.factory,
            position_group = EXCLUDED.position_group,
            employment_status = EXCLUDED.employment_status,
            job_status = EXCLUDED.job_status,
            id_number = EXCLUDED.id_number
          RETURNING employee_id
          `,
          [
            nextCode, name_th, name_en, join_date, birthDate,
            supervisor, gender, cost_center_id, cost_center,
            company, factory, position_group, employment_status,
            job_status, citizen_id
          ]
        );

        // ---------------- Bus Route ----------------
        // ตรวจสอบว่าชื่อคนนี้มีอยู่แล้วใน master
        const empCheck = await client.query(
          `SELECT employee_id FROM manpower.k1_smart_man_name_list_master WHERE name_th = $1`,
          [name_th]
        );

        let insertBusResult;
        if (empCheck.rows.length > 0) {
          const empIdOld = empCheck.rows[0].employee_id;

          // update bus route ของคนนี้
          const updateBus = await client.query(
            `UPDATE manpower.k1_smart_man_bus_route_master
             SET update_date = now() at time zone 'asia/bangkok',
                 factory = $1,
                 pickup_point = $2,
                 rount = $3
             WHERE emp_id = $4
             RETURNING emp_id`,
            [factory, pickup, car, empIdOld]
          );

          if (updateBus.rowCount === 0) {
            // ถ้าไม่มี route เดิม → insert ใหม่
            insertBusResult = await client.query(
              `INSERT INTO manpower.k1_smart_man_bus_route_master
               (create_date, update_date, factory, emp_id, pickup_point, rount)
               VALUES (now() at time zone 'asia/bangkok',
                       now() at time zone 'asia/bangkok',
                       $1, $2, $3, $4)
               RETURNING emp_id`,
              [factory, nextCode, pickup, car]
            );
          } else {
            insertBusResult = updateBus;
          }
        } else {
          // insert ใหม่ ใช้ emp_id ใหม่
          insertBusResult = await client.query(
            `INSERT INTO manpower.k1_smart_man_bus_route_master
             (create_date, update_date, factory, emp_id, pickup_point, rount)
             VALUES (now() at time zone 'asia/bangkok',
                     now() at time zone 'asia/bangkok',
                     $1, $2, $3, $4)
             RETURNING emp_id`,
            [factory, nextCode, pickup, car]
          );
        }

        // ---------------- ตรวจสอบ insert ทั้ง 3 ตาราง ----------------
        if (
          insertMaster.rowCount === 0 ||
          insertHistory.rowCount === 0 ||
          insertBusResult.rowCount === 0
        ) {
          throw new Error(`Insert failed in one of the tables for employee_id ${nextCode}`);
        }

        results.push({ employee_id: nextCode, name_th, status: "INSERT OK" });

      } catch (insertErr) {
        console.error("Insert failed for:", nextCode, insertErr.message);
        results.push({ employee_id: nextCode, name_th, status: "INSERT FAIL", message: insertErr.message });
        throw insertErr; // rollback ทั้ง transaction
      }
    }

    await client.query("COMMIT");
    return res.json({ status: "OK", message: "Insert process completed", data: results });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Transaction error:", err);
    return res.status(500).json({ status: "ERROR", message: err.message, data: [] });
  } finally {
    client.release();
  }
});

module.exports = router;
