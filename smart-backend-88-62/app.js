const createError = require("http-errors");
const express = require("express");
const path = require("path");
const cookieParser = require("cookie-parser");
const logger = require("morgan");
const cors = require("cors");
const compression = require("compression");
const bodyParser = require("body-parser");
const os = require("os"); // 🟢 1. เพิ่ม os เข้ามาเพื่อเช็คระบบเครื่อง
const fs = require("fs"); // 🟢 2. เพิ่ม fs เพื่อเช็ค/สร้างโฟลเดอร์
const cron = require("node-cron");
require("dotenv").config();

const { runDailyCostProcess } = require("./routes/10.17.88.61/smart/smart/smt-reject/syncCostService");

const indexRouter = require("./routes/index");
const usersRouter = require("./routes/users");
const fin_cer = require("./Config/Main/fin_cer/fin_cer");
const spc_spi = require("./Config/Main/smart_smt_SPD-SPI/smart_smt_SPC_SPI");
const spc_aoi = require("./Config/Main/smart_smt_spc_aoi/smart_smt_spc_aoi");
const elt_output = require("./Config/Main/smart_smt_elt_output/smart_smt_elt_output");
const aoi_output = require("./Config/Main/smart_smt_aoi_output/smart_smt_aoi_output");
const spi_output = require("./Config/Main/smart_smt_spi_output/smart_smt_spi_output");
const product_status = require("./Config/Main/production_status/production_status");
const smt_reject = require("./Config/Main/smt_reject/smt_reject");
const request3D = require("./Config/Main/3D/Request/Request");
const Fake = require("./Config/Main/FakeScan/FackeScan");

const app = express();

// 🟢 3. ส่วนตั้งค่าที่อยู่รูปภาพ (Path Management)
// Windows ใช้ D:/images | Docker/Linux ใช้ /app/images
const uploadDir = os.platform() === "win32" ? "D:/img" : "/app/images";

// สร้างโฟลเดอร์ให้อัตโนมัติถ้ายังไม่มี
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

app.use(cors());
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "jade");

app.use(logger("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

// 🟢 4. เปิดประตูให้หน้าบ้านเข้าถึงรูปภาพได้ (Static Routes)
// รองรับกรณีใน DB เก็บเป็น "img/xxx.jpg"
app.use("/api/get-img/img", express.static(uploadDir)); 
// รองรับกรณีเรียกแบบไม่มีคำว่า img
app.use("/api/get-img", express.static(uploadDir));

app.use(express.static(path.join(__dirname, "public")));
app.use(bodyParser.json());

// Routes ของคุณ
app.use("/api_p1", indexRouter);
app.use("/api_p1/users", usersRouter);
app.use("/api/fin_cer", fin_cer);
app.use("/api_p1/smart_smt_spc_spi", spc_spi);
app.use("/api_p1/smart_smt_spc_aoi", spc_aoi);
app.use("/api_p1/smart_smt_elt_output", elt_output);
app.use("/api_p1/smart_smt_aoi_output", aoi_output);
app.use("/api_p1/smart_smt_spi_output", spi_output);
app.use("/api_p1/production_status", product_status);
app.use("/api_p1/smt_reject", smt_reject);
app.use("/api_p1/3D",request3D);
app.use("/api_p1/Fake",Fake);

// ------------------------------------------------------------------
// ⏰ 3. ตั้งค่า Cron Job สำหรับ Sync Cost Data อัตโนมัติทุกๆ 1 ชั่วโมง
// ------------------------------------------------------------------
cron.schedule("0 * * * *", async () => {
  console.log("⏰ [Cron Job] เริ่มซิงค์ข้อมูลราคาประจำวันอัตโนมัติ...");
  try {
    await runDailyCostProcess();
  } catch (error) {
    console.error("❌ Cron job process failed:", error);
  }
});

// 🚀 (Optional) ให้สั่งซิงค์ข้อมูลทันที 1 รอบเมื่อ Server เริ่มสตาร์ท
runDailyCostProcess().catch((err) => 
  console.error("❌ Initial cost sync failed on startup:", err)
);
// ------------------------------------------------------------------

// Error Handling (คงเดิม)
app.use(function (req, res, next) {
    next(createError(404));
});

app.use(function (err, req, res, next) {
    res.locals.message = err.message;
    res.locals.error = req.app.get("env") === "development" ? err : {};
    res.status(err.status || 500);
    res.render("error");
});

module.exports = app;