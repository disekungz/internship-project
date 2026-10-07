const express = require("express");
const app = express();

const distinct_line = require("../../../../routes/10.17.87.244/iot/smt/Out_of_control_action/distinct_line");
const distinct_model = require("../../../../routes/10.17.87.244/iot/smt/Out_of_control_action/distinct_model");
const distinct_parameter_name = require("../../../../routes/10.17.87.244/iot/smt/Out_of_control_action/distinct_param_name");
const distinct_parts_name = require("../../../../routes/10.17.87.244/iot/smt/Out_of_control_action/distinct_parts_name");

const Table_OutOfControlAction = require("../../../../routes/10.17.87.244/iot/smt/Out_of_control_action/Table_action");
const Insert_action = require("../../../../routes/10.17.87.244/iot/smt/Out_of_control_action/insert_action");

// const Check_pw_save = require("");

app.use("/distinct_line", distinct_line);
app.use("/distinct_model", distinct_model);
app.use("/distinct_parameter_name", distinct_parameter_name);
app.use("/distinct_parts_name", distinct_parts_name);

app.use("/Table_action", Table_OutOfControlAction);
app.use("/Insert_action", Insert_action);

// app.use("/Check_pw_save", Check_pw_save);
module.exports = app;
