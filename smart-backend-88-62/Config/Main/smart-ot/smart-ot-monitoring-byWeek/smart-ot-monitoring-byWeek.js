const express = require("express");
const app = express();

const get_department = require("../../../../routes/10.17.100.193/smart/manpower/smart-ot/smart-monitoringOT-byWeek/get_department");
const get_data = require("../../../../routes/10.17.100.193/smart/manpower/smart-ot/smart-monitoringOT-byWeek/get_data");
const get_week_code = require("../../../../routes/10.17.100.193/smart/manpower/smart-ot/smart-monitoringOT-byWeek/get_week_code");
const get_emp = require("../../../../routes/10.17.100.193/smart/manpower/smart-ot/smart-monitoringOT-byWeek/get_emp");

app.use("/get_data", get_data);
app.use("/get_week_code", get_week_code);
app.use("/get_department", get_department);
app.use("/get_emp", get_emp);

module.exports = app;
