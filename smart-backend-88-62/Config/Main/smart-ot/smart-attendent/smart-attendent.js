const express = require("express");
const app = express();

const get_data = require("../../../../routes/10.17.100.193/smart/manpower/smart-ot/smart-attendent/get_data");
const get_departmenty = require("../../../../routes/10.17.100.193/smart/manpower/smart-ot/smart-attendent/get_departmenty");

app.use("/get_data", get_data);
app.use("/get_departmenty", get_departmenty);


module.exports = app;
