const express = require("express");
const app = express();

const Insert_request = require("../../../../routes/10.17.88.61/smart/smart/3D/Requests/insert");
const Table = require("../../../../routes/10.17.88.61/smart/smart/3D/Requests/Table");
const updatetime = require("../../../../routes/10.17.88.61/smart/smart/3D/Requests/update-time");
const editupdate = require("../../../../routes/10.17.88.61/smart/smart/3D/Requests/editupdate");
const distinct_product = require('../../../../routes/10.17.88.61/smart/smart/3D/Requests/distinct_product');

// หน้าอื่น
const sumoutput = require("../sumoutput/sumoutput");

// หน้าอื่น
app.use("/sumoutput", sumoutput);


// const Insert_request = require("../../../../routes/10.17.87.244/smart/smart/3D/Requests/insert");
// const Table = require("../../../../routes/10.17.87.244/smart/smart/3D/Requests/Table");
// const updatetime = require("../../../../routes/10.17.87.244/smart/smart/3D/Requests/update-time");
// const editupdate = require("../../../../routes/10.17.87.244/smart/smart/3D/Requests/editupdate");
// const distinct_product = require('../../../../routes/10.17.87.244/smart/smart/3D/Requests/distinct_product');

app.use("/insert", Insert_request);
app.use("/table",Table);
app.use("/update", updatetime);
app.use("/update",editupdate);
app.use("/distinct_product", distinct_product);

module.exports = app;
