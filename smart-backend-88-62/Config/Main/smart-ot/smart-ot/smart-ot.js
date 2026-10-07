const express = require("express");
const app = express();

const get_detail_display = require("../../../../routes/10.17.100.193/smart/manpower/smart-ot/get_detail_display");
const get_code_ot = require("../../../../routes/10.17.100.193/smart/manpower/smart-ot/get_code_ot");
const insert_data = require("../../../../routes/10.17.100.193/smart/manpower/smart-ot/insertdata");
const get_data_table = require("../../../../routes/10.17.100.193/smart/manpower/smart-ot/get_data_table");

app.use("/get_detail_display", get_detail_display);
app.use("/get_code_ot", get_code_ot);
app.use("/insert_data", insert_data);
app.use("/get_data_table", get_data_table);

module.exports = app;
