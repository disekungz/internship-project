const express = require("express");
const app = express();

const get_data_summary = require("../../../../routes/10.17.100.193/smart/manpower/smart-ot/smart-mps-summary/get_data_summary");
const get_data_cost_factory = require("../../../../routes/10.17.100.193/smart/manpower/smart-ot/smart-mps-summary/get_data_cost_factory");
const get_data_cost_summary = require("../../../../routes/10.17.100.193/smart/manpower/smart-ot/smart-mps-summary/get_data_cost_summary");
const get_code_id = require("../../../../routes/10.17.100.193/smart/manpower/smart-ot/smart-mps-summary/get_code_id");
const get_cc = require("../../../../routes/10.17.100.193/smart/manpower/smart-ot/smart-mps-summary/get_cc");

app.use("/get_data_summary", get_data_summary);
app.use("/get_data_cost_factory", get_data_cost_factory);
app.use("/get_data_cost_summary", get_data_cost_summary);
app.use("/get_code_id", get_code_id);
app.use("/get_cc", get_cc);
module.exports = app;