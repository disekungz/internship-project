const express = require("express");
const app = express();

const get_bus_detaile = require("../../../../routes/10.17.100.193/smart/manpower/smart-ot/smart-newComer/get_bus_detaile");
const get_cc = require("../../../../routes/10.17.100.193/smart/manpower/smart-ot/smart-newComer/get_cc");
const get_emplyment = require("../../../../routes/10.17.100.193/smart/manpower/smart-ot/smart-newComer/get_emplyment");
const get_position = require("../../../../routes/10.17.100.193/smart/manpower/smart-ot/smart-newComer/get_position");
const get_super = require("../../../../routes/10.17.100.193/smart/manpower/smart-ot/smart-newComer/get_super");
const insert_new_emp = require("../../../../routes/10.17.100.193/smart/manpower/smart-ot/smart-newComer/insert_new_emp");
const insert_newcommer_upload = require("../../../../routes/10.17.100.193/smart/manpower/smart-ot/smart-newComer/insert_newcommer_upload");

app.use("/get_bus_detaile", get_bus_detaile);
app.use("/get_cc", get_cc);
app.use("/get_emplyment", get_emplyment);
app.use("/get_position", get_position);
app.use("/get_super", get_super);
app.use("/insert_new_emp", insert_new_emp);
app.use("/insert_newcommer_upload", insert_newcommer_upload);


module.exports = app;
