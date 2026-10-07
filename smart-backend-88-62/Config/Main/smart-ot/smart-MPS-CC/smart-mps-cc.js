const express = require("express");
const app = express();

const get_data = require("../../../../routes/10.17.100.193/smart/manpower/smart-ot/smart-mps-contract/get_data");
const get_cc = require("../../../../routes/10.17.100.193/smart/manpower/smart-ot/smart-mps-contract/get_cc");
const get_data_detail_dialog = require("../../../../routes/10.17.100.193/smart/manpower/smart-ot/smart-mps-contract/get_data_detail_dialog");
const insert_contract = require("../../../../routes/10.17.100.193/smart/manpower/smart-ot/smart-mps-contract/insert_contract");
const update_cc = require("../../../../routes/10.17.100.193/smart/manpower/smart-ot/smart-mps-contract/update");
const get_sv = require("../../../../routes/10.17.100.193/smart/manpower/smart-ot/smart-mps-contract/get_sv");

app.use("/get_data", get_data);
app.use("/get_cc", get_cc);
app.use("/get_data_detail_dialog", get_data_detail_dialog);
app.use("/insert_contract", insert_contract);
app.use("/update_cc", update_cc);
app.use("/get_sv", get_sv);


module.exports = app;
