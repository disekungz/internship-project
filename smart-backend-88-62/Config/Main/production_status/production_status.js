const express = require("express");
const app = express();

//WIP&OUTPUT
const wip = require("./wip/wip");
const outputoverall = require("./outputoverall/OverallProduction");
const outputbyproduct = require("./outputbyproduct/output_product");
const outputbyprocess = require("./outputbyprocess/output_process");
const manpower = require("./manpower/mh");

//Productivity
const productivity = require("./productivity/productivity");

app.use("/wip", wip);
app.use("/outputoverall", outputoverall);
app.use("/outputbyproduct", outputbyproduct);
app.use("/outputbyprocess", outputbyprocess);
app.use("/productivity", productivity);
app.use("/attendance", productivity);
app.use("/manpower", manpower);
app.use("/mh", manpower);

module.exports = app;

