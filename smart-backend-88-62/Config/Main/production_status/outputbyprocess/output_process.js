const express = require("express");
const app = express();

const outputByProcessApi = require("../../../../routes/10.17.87.244/smart/smart/productionstatus/outputbyprocess/output_by_process_api");

app.use("/", outputByProcessApi);

module.exports = app;
