const express = require("express");
const app = express();

const output = require("../../../../routes/10.17.87.244/smart/smart/productionstatus/outputoverall/fpc-output");


app.use("/output", output);


module.exports = app;
