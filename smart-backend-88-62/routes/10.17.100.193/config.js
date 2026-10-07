const { Pool } = require("pg");

//pool_database
const pool_iot = new Pool({
  host: process.env.POSTGRES_HOST_NAME_10_17_100_193,
  port: process.env.POSTGRES_PORTS_10_17_100_193,
  user: process.env.POSTGRES_USER_NAME_10_17_100_193,
  password: process.env.POSTGRES_PASSWORD_10_17_100_193,
  database: "smf",
});

module.exports = { pool_iot };
