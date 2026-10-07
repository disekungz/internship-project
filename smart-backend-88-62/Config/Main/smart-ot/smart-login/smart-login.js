const express = require("express");
const app = express();

const get_detail_user = require("../../../../routes/10.17.100.193/smart/manpower/smart-ot/smart-login/get_detail_user");
const insert_user = require("../../../../routes/10.17.100.193/smart/manpower/smart-ot/smart-login/insertuser");
const login = require("../../../../routes/10.17.100.193/smart/manpower/smart-ot/smart-login/login");

app.use("/get_detail_user", get_detail_user);
app.use("/insert_user", insert_user);
app.use("/login", login);

module.exports = app;
