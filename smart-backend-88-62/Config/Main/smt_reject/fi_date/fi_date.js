const express = require("express");
const app = express();

const date = require("../../../../routes/10.17.88.61/smart/smart/smt-reject/fi-date/fi_date");
app.use("/date", date);
module.exports = app;
