const { Pool } = require("pg");
const mariadb = require("mariadb");

//pool_database
const pool_iot = new Pool({
  host: process.env.POSTGRES_HOST_NAME_10_17_87_244,
  port: process.env.POSTGRES_PORTS_10_17_87_244,
  user: process.env.POSTGRES_USER_NAME_10_17_87_244,
  password: process.env.POSTGRES_PASSWORD_10_17_87_244,
  database: "iot",
});
const pool_smart = new Pool({
  host: process.env.POSTGRES_HOST_NAME_10_17_87_244,
  port: process.env.POSTGRES_PORTS_10_17_87_244,
  user: process.env.POSTGRES_USER_NAME_10_17_87_244,
  password: process.env.POSTGRES_PASSWORD_10_17_87_244,
  database: "smart",
});
const pool_smartc = new Pool({
  host: process.env.POSTGRES_HOST_NAME_127_0_0_1,
  port: process.env.POSTGRES_PORTS_127_0_0_1,
  user: process.env.POSTGRES_USER_NAME_127_0_0_1,
  password: process.env.POSTGRES_PASSWORD_127_0_0_1,
  database: "postgres",
});
const pool_smart61 = new Pool({
  host: process.env.POSTGRES_HOST_NAME_10_17_88_61,
  port: process.env.POSTGRES_PORTS_10_17_88_61,
  user: process.env.POSTGRES_USER_NAME_10_17_88_61,
  password: process.env.POSTGRES_PASSWORD_10_17_88_61,
  database: "smart",
});

const pool_ot = mariadb.createPool({
  host: process.env.MARIADB_HOST_NAME_10_17_87_50,
  port: process.env.MARIADB_PORTS_10_17_87_50,
  user: process.env.MARIADB_USER_NAME_10_17_87_50,
  password: process.env.MARIADB_PASSWORD_10_17_87_50,
  database: "ot",
});

const pool_test = new Pool({
  host: process.env.POSTGRES_HOST_NAME_10_17_87_244,
  port: process.env.POSTGRES_PORTS_10_17_87_244,
  user: process.env.POSTGRES_USER_NAME_10_17_87_244,
  password: process.env.POSTGRES_PASSWORD_10_17_87_244,
  database: "Test",
});



// ==============================
// Helper: Query with Retry (PostgreSQL pool_smart)
// ==============================
async function queryWithRetry(sql, params = [], retries = 2) {
  let lastErr;
  for (let i = 0; i <= retries; i++) {
    try {
      const result = await pool_smart.query(sql, params);
      return result.rows !== undefined ? result.rows : result;
    } catch (err) {
      lastErr = err;
      if (i < retries) await new Promise(r => setTimeout(r, 500 * (i + 1)));
    }
  }
  throw lastErr;
}

// ==============================
// Helper: Query with Retry Pool1 (MariaDB pool_ot — tbl_employee, tbl_date, tbl_help, etc.)
// ==============================
async function queryWithRetryPool1(sql, params = [], retries = 2) {
  let lastErr;
  for (let i = 0; i <= retries; i++) {
    try {
      const result = await pool_ot.query(sql, params);
      // MariaDB returns plain array; mysql2 returns [rows, fields]
      if (Array.isArray(result) && Array.isArray(result[0])) return result[0];
      return Array.isArray(result) ? result : [];
    } catch (err) {
      lastErr = err;
      if (i < retries) await new Promise(r => setTimeout(r, 500 * (i + 1)));
    }
  }
  throw lastErr;
}

// ==============================
// Helper: Query with Retry Pool2 (PostgreSQL pool_test — snapshot, cost_centers, manhour_line_mappings)
// ==============================
async function queryWithRetryPool2(sql, params = [], retries = 2) {
  let lastErr;
  for (let i = 0; i <= retries; i++) {
    try {
      const result = await pool_test.query(sql, params);
      return result.rows !== undefined ? result.rows : result;
    } catch (err) {
      lastErr = err;
      if (i < retries) await new Promise(r => setTimeout(r, 500 * (i + 1)));
    }
  }
  throw lastErr;
}

// ==============================
// Helper: safeGetDate — แปลงค่าวันที่ต่างๆ เป็น Date Object (return null ถ้าไม่ถูกต้อง)
// ==============================
function safeGetDate(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}


module.exports = { pool_iot, pool_smart, pool_smartc, pool_smart61 , pool_test, pool_ot,
  queryWithRetry, queryWithRetryPool1, queryWithRetryPool2, safeGetDate,
 };
