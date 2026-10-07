const express = require("express");
const app = express();

const get_cc = require("../../../../routes/10.17.100.193/smart/manpower/smart-ot/smart-approve/get_cc");
const get_data = require("../../../../routes/10.17.100.193/smart/manpower/smart-ot/smart-approve/get_data");
const update = require("../../../../routes/10.17.100.193/smart/manpower/smart-ot/smart-approve/update");

app.use("/get_cc", get_cc);
app.use("/get_data", get_data);
app.use("/update", update);

module.exports = app;
