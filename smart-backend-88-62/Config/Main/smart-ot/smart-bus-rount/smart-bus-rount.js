const express = require("express");
const app = express();

const get_bus_detaile = require("../../../../routes/10.17.100.193/smart/manpower/smart-ot/smart-bus/get_bus_detaile");
const get_bus_detaileby_employee = require("../../../../routes/10.17.100.193/smart/manpower/smart-ot/smart-bus/get_bus_detaileby_employee");
const get_data = require("../../../../routes/10.17.100.193/smart/manpower/smart-ot/smart-bus/get_data");
const update_bus = require("../../../../routes/10.17.100.193/smart/manpower/smart-ot/smart-bus/update");
const get_data_bus_summary = require("../../../../routes/10.17.100.193/smart/manpower/smart-ot/smart-bus/get_data_bus_summary");

app.use("/get_bus_detaile", get_bus_detaile);
app.use("/get_bus_detaileby_employee", get_bus_detaileby_employee);
app.use("/get_data", get_data);
app.use("/update_bus", update_bus);
app.use("/get_data_bus_summary", get_data_bus_summary);


module.exports = app;
