const express = require("express");
const app = express();

const table = require("../../../../routes/10.17.88.61/smart/smart/fin_cer/Update/get_table");
const distinct_dept = require("../../../../routes/10.17.88.61/smart/smart/fin_cer/Update/distinct_dept");
// const tableexport = require("../../../../routes/10.17.88.61/smart/smart/fin_cer/Record/get_table_export");
const distinct_line = require("../../../../routes/10.17.88.61/smart/smart/fin_cer/Update/distinct_line");
const distinct_head = require("../../../../routes/10.17.88.61/smart/smart/fin_cer/Update/distinct_head");
const distinct_group_ojt = require("../../../../routes/10.17.88.61/smart/smart/fin_cer/Update/distinct_OJTGroup");
const Data1 = require("../../../../routes/10.17.88.61/smart/smart/fin_cer/Update/update");

app.use("/get_table", table);
app.use("/distinct_dept", distinct_dept);
// app.use("/tableexport", tableexport);
app.use("/distinct_line", distinct_line);
app.use("/distinct_head", distinct_head);
app.use("/distinct_group_ojt", distinct_group_ojt);
app.use("/sync-tco", Data1);

module.exports = app;
