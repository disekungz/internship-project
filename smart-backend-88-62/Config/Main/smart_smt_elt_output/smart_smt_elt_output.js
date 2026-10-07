const express = require("express");
const app = express();

const distinct_Machine_No = require("../../../routes/10.17.87.244/iot/smt/smt_elt_output/smt_elt_output/distinct_Machine_No");
const distinct_model = require("../../../routes/10.17.87.244/iot/smt/smt_elt_output/smt_elt_output/distinct_model");
const Table_elt_output = require("../../../routes/10.17.87.244/iot/smt/smt_elt_output/smt_elt_output/Table_elt_output");
const Charts = require("../../../routes/10.17.87.244/iot/smt/smt_elt_output/smt_elt_output/Charts");

// หน้าอื่นของ ELT 
const Out_of_control = require("./out_of_control/out_of_control");


app.use("/distinct_machine_no", distinct_Machine_No);
app.use("/distinct_model", distinct_model);


app.use("/Table_elt_output", Table_elt_output);
app.use("/Charts", Charts);

//หน้าอื่นของ ELT
// app.use("/Out_Of_Rule_Action", Outofruleaction);
app.use("/Out_Of_Control_Action", Out_of_control);

module.exports = app;
