const express = require("express");
const app = express();

const wip_tasks = require("../../../../routes/10.17.87.244/smart/smart/productionstatus/wip/tasks");
const dailyp1 = require("../../../../routes/10.17.87.244/smart/smart/productionstatus/wip/dailyP1");
const target = require("../../../../routes/10.17.87.244/smart/smart/productionstatus/wip/target");


app.use("/wip_tasks", wip_tasks);
app.use("/daily-p1", dailyp1);
app.use("/target",target);

module.exports = app;
