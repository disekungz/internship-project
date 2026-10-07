const { Pool } = require("pg");
const mariadb = require("mariadb");

//pool_database
const pool_smart = new Pool({
  host: process.env.POSTGRES_HOST_NAME_10_17_88_61,
  port: process.env.POSTGRES_PORTS_10_17_88_61,
  user: process.env.POSTGRES_USER_NAME_10_17_88_61,
  password: process.env.POSTGRES_PASSWORD_10_17_88_61,
  database: "smart",
});

const pool_smartb = new Pool({
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

// ── 🦭 MariaDB Pool (ฐานข้อมูลที่สี่ที่เพิ่มใหม่) ───────────────────────────
const pool_smartd = mariadb.createPool({
  host: process.env.MARIADB_HOST_NAME_10_17_87_50,
  port: process.env.MARIADB_PORT_10_17_87_50,
  user: process.env.MARIADB_USER_NAME_10_17_87_50,
  password: process.env.MARIADB_PASSWORD_10_17_87_50,
  database: "ot",
});

module.exports = {
  pool_smart,
  pool_smartb,
  pool_smartc,
  pool_smartd
};