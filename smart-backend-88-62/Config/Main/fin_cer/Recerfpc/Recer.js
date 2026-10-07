const express = require("express");
const app = express();

const recer_seach = require("../../../../routes/10.17.88.61/smart/smart/fin_cer/Recerfin/Recer_seach");
const save_recer = require("../../../../routes/10.17.88.61/smart/smart/fin_cer/Recerfin/Recer_save");

app.use("/search", recer_seach);
app.use("/recer", save_recer);

module.exports = app;
