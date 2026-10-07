const express = require("express");
const app = express();

const insert_record = require("../../../../routes/10.17.88.61/smart/smart/fin_cer/Record/insert_record");
const table = require("../../../../routes/10.17.88.61/smart/smart/fin_cer/Record/get_table");
const tableexport = require("../../../../routes/10.17.88.61/smart/smart/fin_cer/Record/get_table_export");
const distinct_line = require("../../../../routes/10.17.88.61/smart/smart/fin_cer/Record/distinct_line");
const distinct_head = require("../../../../routes/10.17.88.61/smart/smart/fin_cer/Record/distinct_head");
const distinct_group_ojt= require("../../../../routes/10.17.88.61/smart/smart/fin_cer/Record/distinct_OJTGroup");

app.use("/production", insert_record);
app.use("/table", table);
app.use("/tableexport", tableexport);
app.use("/distinct_line", distinct_line);
app.use("/distinct_head", distinct_head);
app.use("/distinct_group_ojt", distinct_group_ojt);

module.exports = app;
