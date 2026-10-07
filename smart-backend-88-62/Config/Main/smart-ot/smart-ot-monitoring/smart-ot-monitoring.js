const express = require("express");
const app = express();

const get_data_chart = require("../../../../routes/10.17.100.193/smart/manpower/smart-ot/smart-ot-monitoring/get_data_in_direct");
const get_data_summary = require("../../../../routes/10.17.100.193/smart/manpower/smart-ot/smart-ot-monitoring/get_data_summary");
const get_departmenty = require("../../../../routes/10.17.100.193/smart/manpower/smart-ot/smart-ot-monitoring/get_departmenty");
const get_data_depm = require("../../../../routes/10.17.100.193/smart/manpower/smart-ot/smart-ot-monitoring/get_data_depm");

app.use("/get_data_summary", get_data_summary);
app.use("/get_data_chart", get_data_chart);
app.use("/get_departmenty", get_departmenty);
app.use("/get_data_depm", get_data_depm);

module.exports = app;
