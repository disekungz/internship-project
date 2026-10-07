const express = require("express");
const app = express();

const distinct_Machine_No = require("../../../routes/10.17.87.244/iot/smt/smt_aoi_output/smt_aoi_output/distinct_Machine");
const distinct_model = require("../../../routes/10.17.87.244/iot/smt/smt_aoi_output/smt_aoi_output/distinct_model");

const Table_elt_output = require("../../../routes/10.17.87.244/iot/smt/smt_aoi_output/smt_aoi_output/Table_aoi_output");
const Charts = require("../../../routes/10.17.87.244/iot/smt/smt_aoi_output/smt_aoi_output/charts");

//หน้าอื่นของ AOI
const AOI_Output = require("./Out_of_control_action/Out_of_control_action");
//หน้าอื่นของ AOI
app.use("/out_of_control_action", AOI_Output);

app.use("/distinct_machine_no", distinct_Machine_No);
app.use("/distinct_model", distinct_model);

app.use("/Table_aoi_output", Table_elt_output);
app.use("/Charts", Charts);

module.exports = app;
