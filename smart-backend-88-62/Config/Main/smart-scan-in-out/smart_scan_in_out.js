const express = require("express");
const app = express();

const Scan_in_out = require("./smart-scan-in-out/smart_scan_in_out");

app.use("/Scan_in_out", Scan_in_out);

module.exports = app;
