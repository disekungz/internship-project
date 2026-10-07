// ดึง pool_smart มาจาก config.js ที่มีอยู่แล้ว
const { pool_smart } = require("../../../config"); 

// ขั้นตอนที่ 1: สร้างตารางสรุปราคาประจำวัน (ถ้ายังไม่มี)
async function createSummaryTable() {
  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS smart.smart_smt_daily_cost_summary (
        production_date date NOT NULL,
        prd_name varchar(100) NOT NULL,
        final_cost numeric(14, 4) NOT NULL,
        updated_at timestamp DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT smart_smt_daily_cost_summary_pkey PRIMARY KEY (production_date, prd_name)
    );

    CREATE INDEX IF NOT EXISTS idx_smt_daily_cost_date_prd 
    ON smart.smart_smt_daily_cost_summary (production_date, prd_name);
  `;
  try {
    await pool_smart.query(createTableQuery);
    console.log("-> สร้างตาราง smart.smart_smt_daily_cost_summary เรียบร้อยแล้ว");
  } catch (error) {
    console.error("Error creating table:", error);
    throw error;
  }
}

// ขั้นตอนที่ 2: ซิงค์ข้อมูลราคารายวัน
async function syncCostForDate(targetDate) {
  const syncQuery = `
    INSERT INTO smart.smart_smt_daily_cost_summary (production_date, prd_name, final_cost)
    SELECT 
        target_dates.output_date,
        target_dates.prd_name,
        COALESCE(p_price.tt_cost, m.diff_total, 0) AS final_cost
    FROM (
        SELECT DISTINCT output_date::date AS output_date, TRIM(prd_name) AS prd_name
        FROM smart.smart_reject_lot_smt
        WHERE output_date::date = $1
    ) target_dates

    LEFT JOIN LATERAL (
        SELECT p.tt_cost
        FROM smart.smart_pln_price p
        WHERE UPPER(TRIM(p.prd_name)) = UPPER(TRIM(target_dates.prd_name))
          AND p.effective_date::date <= target_dates.output_date::date
        ORDER BY p.effective_date DESC
        LIMIT 1
    ) p_price ON true

    LEFT JOIN smart.smart_smt_fi_cost_master_new m 
      ON UPPER(TRIM(m.item)) = UPPER(TRIM(target_dates.prd_name))
     AND m.file_month = TO_CHAR(target_dates.output_date, 'YYYY-MM')

    ON CONFLICT (production_date, prd_name) 
    DO UPDATE SET final_cost = EXCLUDED.final_cost, updated_at = CURRENT_TIMESTAMP;
  `;

  try {
    await pool_smart.query(syncQuery, [targetDate]);
    console.log(`-> ซิงค์ราคาของวันที่ ${targetDate} สำเร็จเรียบร้อย!`);
  } catch (error) {
    console.error(`Error syncing date ${targetDate}:`, error);
    throw error;
  }
}

/**
 * คำนวณ Production Date (รอบวันผลิต) โดยตัดรอบเวลา 09:00 AM (เวลาไทย Asia/Bangkok)
 * - ช่วงเวลา 09:00:00 ถึง 23:59:59 -> นับเป็นรอบของ "วันนี้" (YYYY-MM-DD)
 * - ช่วงเวลา 00:00:00 ถึง 08:59:59 -> นับเป็นรอบของ "เมื่อวาน" (กะดึกต่อเนื่อง)
 */
function getProductionDate(date = new Date()) {
  const shifted = new Date(date.getTime() - 9 * 60 * 60 * 1000);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(shifted);
}

/**
 * คำนวณวันก่อนหน้า (1 วัน) สำหรับรูปแบบ 'YYYY-MM-DD'
 */
function getPreviousDate(dateStr) {
  const [year, month, day] = dateStr.split("-").map(Number);
  const d = new Date(Date.UTC(year, month - 1, day));
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().split("T")[0];
}

// ฟังก์ชันหลักที่สั่งรันกระบวนการ
async function runDailyCostProcess(targetDateStr) {
  const bangkokNowStr = new Date().toLocaleString("th-TH", { timeZone: "Asia/Bangkok" });
  console.log(`\n=== [${bangkokNowStr}] เริ่มกระบวนการประมวลผลราคาประจำวัน (รอบตัด 09:00 น.) ===`);

  await createSummaryTable();

  if (targetDateStr) {
    // 1. กรณีระบุ targetDateStr เจาะจงมา (เช่น สั่งรันย้อนหลัง)
    console.log(`กำลังประมวลผลข้อมูลเฉพาะวันที่ระบุ: ${targetDateStr}`);
    await syncCostForDate(targetDateStr);
  } else {
    // 2. กรณีรันแบบอัตโนมัติ (เช่น Cron Job รายชั่วโมง หรือ Server Start)
    // คำนวณรอบวันปัจจุบันตามเกณฑ์ 09:00 - 09:00 วันถัดไป
    const currentProdDate = getProductionDate();
    const prevProdDate = getPreviousDate(currentProdDate);

    // ซิงค์รอบวันก่อนหน้า (เพื่อเก็บตก Lot ของกะที่เพิ่งปิดรอบ 09:00 น.)
    console.log(`[1/2] กำลังซิงค์ข้อมูลรอบวันก่อนหน้า (Finalize กะที่ปิดรอบ): ${prevProdDate}`);
    await syncCostForDate(prevProdDate);

    // ซิงค์รอบวันปัจจุบัน (กะที่กำลังดำเนินการผลิตอยู่)
    console.log(`[2/2] กำลังซิงค์ข้อมูลรอบวันปัจจุบัน (Active Shift): ${currentProdDate}`);
    await syncCostForDate(currentProdDate);
  }

  console.log("=== เสร็จสิ้นการทำงาน ===\n");
}

module.exports = { runDailyCostProcess, getProductionDate };