const express = require("express");
const app = express();

const fi_date = require("./fi_date/fi_date");
app.use("/fi_date", fi_date);

module.exports = app;
