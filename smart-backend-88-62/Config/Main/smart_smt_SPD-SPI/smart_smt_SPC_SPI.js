const express = require("express");
const app = express();

const distinct_line = require("../../../routes/10.17.87.244/iot/smt/smt_spc_spi/distinct_line");
const distinct_model = require("../../../routes/10.17.87.244/iot/smt/smt_spc_spi/distinct_model");
const distinct_parts_name = require("../../../routes/10.17.87.244/iot/smt/smt_spc_spi/distinct_parts_name");
// const distinct_layer = require("");
const distinct_parameter_name = require("../../../routes/10.17.87.244/iot/smt/smt_spc_spi/distinct_param_name");

const Table_spc_lpi = require("../../../routes/10.17.87.244/iot/smt/smt_spc_spi/Table_spc_lpi");
const Charts = require("../../../routes/10.17.87.244/iot/smt/smt_spc_spi/Charts");

//หน้าอื่นของ SPI
const Outofruleaction = require("./OutOfRuleAction/OutOfRuleAction");
const Out_of_Control_Action = require("./OutOfControlAction/OutOfControlAction")

app.use("/distinct_line", distinct_line);
app.use("/distinct_model", distinct_model);
app.use("/distinct_parts_name", distinct_parts_name);
// app.use("/distinct_layer", distinct_layer);
app.use("/distinct_parameter_name", distinct_parameter_name);

app.use("/Table_spc_spi", Table_spc_lpi);
app.use("/Charts", Charts);

//หน้าอื่นของ SPI
app.use("/Out_Of_Rule_Action", Outofruleaction);
app.use("/Out_Of_Control_Action", Out_of_Control_Action);

module.exports = app;