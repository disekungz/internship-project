const express = require("express");
const app = express();

const get_data = require("../../../../routes/10.17.100.193/smart/manpower/smart-ot/mps-tranfer-costcenter/get_data");
const get_cc = require("../../../../routes/10.17.100.193/smart/manpower/smart-ot/mps-tranfer-costcenter/get_cc");
const update_cc = require("../../../../routes/10.17.100.193/smart/manpower/smart-ot/mps-tranfer-costcenter/update");
const get_sv = require("../../../../routes/10.17.100.193/smart/manpower/smart-ot/mps-tranfer-costcenter/get_sv");

app.use("/get_data", get_data);
app.use("/get_cc", get_cc);
app.use("/update_cc", update_cc);
app.use("/get_sv", get_sv);


module.exports = app;
