const express = require("express");
const app = express();

const distinct_machine_no = require("../../../../routes/10.17.87.244/iot/smt/smt_aoi_output/Out_of_control_action/distinct_Machine");
const distinct_model = require("../../../../routes/10.17.87.244/iot/smt/smt_aoi_output/Out_of_control_action/distinct_model");
// const distinct_product = require("");
// const distinct_layer = require("");

const Table_OutOfControlAction = require("../../../../routes/10.17.87.244/iot/smt/smt_aoi_output/Out_of_control_action/Table_action");
const Insert_action = require("../../../../routes/10.17.87.244/iot/smt/smt_aoi_output/Out_of_control_action/insert_action");

const Check_pw_save = require("../../../../routes/10.17.87.244/iot/smt/smt_aoi_output/Out_of_control_action/Check_pw_save");

app.use("/distinct_machine_no", distinct_machine_no);
app.use("/distinct_model", distinct_model);
// app.use("/distinct_product", distinct_product);
// app.use("/distinct_layer", distinct_layer);

app.use("/Table_action", Table_OutOfControlAction);
app.use("/Insert_action", Insert_action);

app.use("/Check_pw_save", Check_pw_save);
module.exports = app;
