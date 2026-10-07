const express = require("express");
const app = express();

const get_detail_display = require("../../../../routes/10.17.100.193/smart/manpower/smart-scan-in-out/get_detail_display");
const table_detail = require("../../../../routes/10.17.100.193/smart/manpower/smart-scan-in-out/table_detail");
const insert_data = require("../../../../routes/10.17.100.193/smart/manpower/smart-scan-in-out/insertdata");

app.use("/get_detail_display", get_detail_display);
app.use("/table_detail", table_detail);
app.use("/insert_data", insert_data);

module.exports = app;
