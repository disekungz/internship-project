const express = require("express");
const app = express();

const scan = require("../../../routes/10.17.87.244/smart/smart/FakeScan/FakeScan");
const distinct_proc = require("../../../routes/10.17.87.244/smart/smart/FakeScan/distinct_proc")

app.use("/scan", scan);
app.use("/distinct_proc", distinct_proc);

module.exports = app;
