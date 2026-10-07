const express = require("express");
const app = express();

const distinct_Machine_No = require("../../../routes/10.17.87.244/iot/smt/smt_spc_aoi/smt_spc_aoi/distinct_Machine_No");
const distinct_model = require("../../../routes/10.17.87.244/iot/smt/smt_spc_aoi/smt_spc_aoi/distinct_model");
const distinct_parts_name = require("../../../routes/10.17.87.244/iot/smt/smt_spc_aoi/smt_spc_aoi/distinct_parts_name");
// const distinct_layer = require("");
const distinct_item_reject_desc = require("../../../routes/10.17.87.244/iot/smt/smt_spc_aoi/smt_spc_aoi/distinct_item_reject_desc");

const Table_spc_aoi = require("../../../routes/10.17.87.244/iot/smt/smt_spc_aoi/smt_spc_aoi/Table_spc_aoi");
const Charts = require("../../../routes/10.17.87.244/iot/smt/smt_spc_aoi/smt_spc_aoi/Charts");

//หน้าอื่นของ AOI
// const Outofruleaction = require("./OutOfRuleAction/OutOfRuleAction");
// const Out_of_Control_Action = require("./OutOfControlAction/OutOfControlAction");

app.use("/distinct_machine_no", distinct_Machine_No);
app.use("/distinct_model", distinct_model);
app.use("/distinct_parts_name", distinct_parts_name);
// // app.use("/distinct_layer", distinct_layer);
app.use("/distinct_item_reject_desc", distinct_item_reject_desc);

app.use("/Table_spc_aoi", Table_spc_aoi);
app.use("/Charts", Charts);

//หน้าอื่นของ SPI
// app.use("/Out_Of_Rule_Action", Outofruleaction);
// app.use("/Out_Of_Control_Action", Out_of_Control_Action);

module.exports = app;
