const express = require("express");
const path = require("path");

const routesPath = path.join(
    __dirname,
    "../../../../routes/10.17.87.244/smart/smart/productionstatus/manpower",
);

const manhourRouter = require(path.join(routesPath, "manhour"));
const deptSummaryRouter = require(path.join(routesPath, "deptSummary"));
const helpRouter = require(path.join(routesPath, "help")).default;
const lineManagerRouter = require(path.join(routesPath, "lineManager"));
const authRouter = require(path.join(routesPath, "auth")).default;
const p1StatusRouter = require(path.join(routesPath, "p1ManpowerStatus"));
const recruitResignRouter = require(path.join(routesPath, "recruitResign"));

const mhApp = express.Router();

mhApp.use("/manhour", manhourRouter);
mhApp.use("/dept_summary", deptSummaryRouter);
mhApp.use("/p1_status", p1StatusRouter);
mhApp.use("/p1_manpower_status", p1StatusRouter);
mhApp.use("/recruit_resign", recruitResignRouter);
mhApp.use("/", manhourRouter);
mhApp.use("/help", helpRouter);
mhApp.use("/linemanager", lineManagerRouter);
mhApp.use("/", lineManagerRouter);
mhApp.use("/auth", authRouter);

module.exports = mhApp;