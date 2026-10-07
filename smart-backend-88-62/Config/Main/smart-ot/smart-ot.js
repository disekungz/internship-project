const express = require("express");
const app = express();

const OT_Request = require("./smart-ot/smart-ot");
const Login = require("./smart-login/smart-login");
const Approve = require("./smart-approve/smart-approve");
const MPS_CC = require("./smart-MPS-CC/smart-mps-cc");
const Adjust = require("./smart-adjust-time/smart-adjust-time");
const monitoring = require("./smart-ot-monitoring/smart-ot-monitoring");
const bus_rount = require("./smart-bus-rount/smart-bus-rount");
const leave = require("./smart-leave/smart-leave");
const newComer = require("./smart-newComer/smart-newComer");
const monitoring_by_week = require("./smart-ot-monitoring-byWeek/smart-ot-monitoring-byWeek");
const MPS_tranfer = require("./smart-MPS-tranfer-cc/smart-mps-tranfer-cc");
const MPS_summary = require("./smaert-mps-summary/smart-mps-summary");
const Attendent = require("./smart-attendent/smart-attendent");
const ot_summarydata = require("./smart-summary-ot-data/smart-summary-ot-data");
const suport = require("./smart-suport/smart-suport");


app.use("/OT_Request", OT_Request);
app.use("/Login", Login);
app.use("/Approve", Approve);
app.use("/MPS_CC", MPS_CC);
app.use("/Adjus_time", Adjust);
app.use("/Monitoring", monitoring);
app.use("/bus_rount", bus_rount);
app.use("/leave", leave);
app.use("/newComer", newComer);
app.use("/monitoring_by_week", monitoring_by_week);
app.use("/MPS_tranfer", MPS_tranfer);
app.use("/MPS_summary", MPS_summary);
app.use("/Attendent", Attendent);
app.use("/summary_ot_data",ot_summarydata);
app.use("/suport", suport);

module.exports = app;
