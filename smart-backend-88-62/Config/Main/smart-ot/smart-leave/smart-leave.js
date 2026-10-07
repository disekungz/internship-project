const express = require("express");
const app = express();

const get_data = require("../../../../routes/10.17.100.193/smart/manpower/smart-ot/smart-leave/get_data");
const resignation = require("../../../../routes/10.17.100.193/smart/manpower/smart-ot/smart-leave/resignation");

app.use("/get_data", get_data);
app.use("/resignation", resignation);


module.exports = app;
