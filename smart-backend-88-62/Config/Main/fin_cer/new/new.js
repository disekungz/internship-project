const express = require("express");
const app = express();

const recer_seach = require("../../../../routes/10.17.88.61/smart/smart/fin_cer/Newtraining/New_seach");
const save_recer = require("../../../../routes/10.17.88.61/smart/smart/fin_cer/Newtraining/New_save");

app.use("/search", recer_seach);
app.use("/recer", save_recer);

module.exports = app;
