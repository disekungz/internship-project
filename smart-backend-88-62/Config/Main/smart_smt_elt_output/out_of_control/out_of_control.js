const express = require("express");
const app = express();

const distinct_machine = require("../../../../routes/10.17.87.244/iot/smt/smt_elt_output/out_of_control_action/distinct_machine");
const distinct_product = require("../../../../routes/10.17.87.244/iot/smt/smt_elt_output/out_of_control_action/distinct_model");
const insert_action = require("../../../../routes/10.17.87.244/iot/smt/smt_elt_output/out_of_control_action/insert_action");
const table_action = require("../../../../routes/10.17.87.244/iot/smt/smt_elt_output/out_of_control_action/Table_action");

app.use("/distinct_machine",distinct_machine);
app.use("/distinct_product",distinct_product);
app.use("/insert_action",insert_action);
app.use("/table_action",table_action);

module.exports = app;
