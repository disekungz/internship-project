const express = require("express");
const 
app = express();

const calendarRoutes = require("../../../../routes/10.17.87.244/smart/smart/productionstatus/productivity/calendarRoutes");
const lineGroupRoutes = require("../../../../routes/10.17.87.244/smart/smart/productionstatus/productivity/lineGroupRoutes");
const periodSummaryRoutes = require("../../../../routes/10.17.87.244/smart/smart/productionstatus/productivity/periodSummaryRoutes");
const productivitySettingRoutes = require("../../../../routes/10.17.87.244/smart/smart/productionstatus/productivity/productivitySettingRoutes");
const attendanceRoutes = require("../../../../routes/10.17.87.244/smart/smart/productionstatus/productivity/attendanceRoutes");
const productivityLoanRoutes = require("../../../../routes/10.17.87.244/smart/smart/productionstatus/productivity/productivityLoanRoutes");
const excelSyncRoutes = require("../../../../routes/10.17.87.244/smart/smart/productionstatus/productivity/excelSyncRoutes");

// Mounting all sub-routers with multiple prefix aliases to guarantee zero 404s
app.use("/calendar", calendarRoutes);
app.use("/line-groups", lineGroupRoutes);
app.use("/settings", productivitySettingRoutes);
app.use("/attendance", productivityLoanRoutes);
app.use("/attendance", attendanceRoutes);
app.use("/", productivitySettingRoutes); // allows /admin-login, /admin-users, etc. at root
app.use("/", attendanceRoutes);
app.use("/", productivityLoanRoutes);
app.use("/", excelSyncRoutes);
app.use("/", periodSummaryRoutes);

module.exports = app;
