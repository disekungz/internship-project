const express = require("express");
const app = express();

const get_data = require("../../../../routes/10.17.100.193/smart/manpower/smart-ot/smart-adjust-time/get_data");

app.use("/get_data", get_data);

module.exports = app;
