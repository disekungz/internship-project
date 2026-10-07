const express = require("express");
const app = express();

const outputByProductApi = require("../../../../routes/10.17.87.244/smart/smart/productionstatus/outputbyproduct/output_by_product_api");

app.use("/", outputByProductApi);

module.exports = app;
