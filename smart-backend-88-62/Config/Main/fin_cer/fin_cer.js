const express = require("express");
const app = express();

const fin_cer = require("../../../routes/10.17.88.61/smart/smart/fin_cer/fin_cer");
const FPCrecer = require("./Recerfpc/Recer");
const New = require("./new/new");
const Rec = require("./Record/recode");
const Update = require("./Update/update");

app.use("/", fin_cer);
app.use("/FPCSMT", FPCrecer);
app.use("/new", New);
app.use("/record", Rec);
app.use("/update", Update);

module.exports = app;
