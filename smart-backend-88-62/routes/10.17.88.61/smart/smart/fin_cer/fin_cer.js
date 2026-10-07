const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const os = require("os");
const { pool_smart } = require("../../../config");

// --- [ ส่วนจัดการที่อยู่รูป (Path Management) ] ---
const uploadDir = os.platform() === "win32" ? "D:/img" : "/app/images";

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
  console.log(`✅ Created directory at: ${uploadDir}`);
}

// --- [ ส่วนของ Helper Functions ] ---
const formatDate = (d) => {
  if (!d) return null;
  const date = new Date(d);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

const addMonths = (d, months) => {
  if (!d) return null;
  const date = new Date(d);
  date.setMonth(date.getMonth() + months);
  return formatDate(date);
};

const getPass = (days) => (Number(days) < 180 ? "Pass" : "Expired");

const buildGroup = (row) => {
  if (!row) return null;
  return {
    pass: getPass(row.number_of_days),
    date: formatDate(row.date_ojt),
    expiry: addMonths(row.date_ojt, 6),
    status: row.status ?? null,
    product: row.product ?? null,
    score: row.score ?? null,
    grade: row.grade ?? null,
  };
};

// --- [ ส่วนของ Multer Config ] ---
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // ใช้ code ที่ส่งมาจาก Body เป็นชื่อไฟล์
    const code = (req.body.code || "unknown").trim().toUpperCase();
    const ext = path.extname(file.originalname).toLowerCase() || ".png";
    // ใช้ชื่อเป็น [CODE][EXTENSION] เพื่อให้ทับไฟล์เก่าไปเลย (ไม่เพิ่มไฟล์ขยะ)
    cb(null, `${code}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error("อนุญาตเฉพาะไฟล์ JPG, PNG, WEBP เท่านั้น"), false);
  },
});

// --- [ ส่วนของ API Routes ] ---

// 1. GET ข้อมูล Certificate (คงเดิม)
router.get("/certificate/:code", async (req, res) => {
  try {
    const code = req.params.code.trim().toUpperCase();
    const result = await pool_smart.query(
      `SELECT *, DATE_PART('day', NOW() - date_ojt) AS number_of_days
       FROM smart.smart_man_tco_certificate
       WHERE code = $1
       ORDER BY date_ojt DESC`, // เรียงล่าสุดขึ้นก่อน
      [code],
    );

    if (result.rows.length === 0)
      return res.status(404).json({ error: "ไม่พบข้อมูล" });

    const rows = result.rows;
    const first = rows[0];

    // ฟังก์ชันช่วยค้นหาข้อมูลกลุ่มที่ต้องการ
    const findGroup = (groupName) =>
      rows.find((r) => r.group_ojt === groupName);

    const responseData = {
      code: first.code,
      name: first.name,
      department: first.department,
      dept: first.dept,
      img: first.images ?? null,
      // กลุ่มทั่วไป
      OPR: buildGroup(findGroup("OPR")),
      JDI: buildGroup(findGroup("JDI_Series")),
      JDI_KAPPA: buildGroup(findGroup("JDI_Series(KAPPA)")),
      General: buildGroup(findGroup("General")),
      INT: buildGroup(findGroup("INT")),
      Sony: buildGroup(findGroup("SONY")),

      // --- ส่วนที่ปรับปรุง: แยก Automotive ---
      // ค้นหาข้อมูล Automotive ทั้งหมดที่มี
      Automotive_SMT: buildGroup(
        rows.find(
          (r) =>
            r.group_ojt === "Automotive" &&
            (r.department || "").toUpperCase().includes("SMT"),
        ),
      ),
      Automotive_FPC: buildGroup(
        rows.find(
          (r) =>
            r.group_ojt === "Automotive" &&
            (r.department || "").toUpperCase().includes("FPC"),
        ),
      ),
    };

    res.json(responseData);
  } catch (err) {
    res.status(500).json({ error: "Server Error" });
  }
});

// 2. POST อัปโหลดรูปภาพ (แก้ไขให้ Insert/Update ลง DB ทันที)
router.post("/upload-photo", upload.single("photo"), async (req, res) => {
  try {
    // Multer จะดึง code มาให้หลังจากประมวลผลไฟล์ (ต้องส่ง code มาพร้อมกับไฟล์ใน FormData)
    const code = (req.body.code || "").trim().toUpperCase();

    if (!code) {
      return res.status(400).json({ error: "กรุณาระบุ code พนักงาน" });
    }
    if (!req.file) {
      return res.status(400).json({ error: "กรุณาเลือกไฟล์รูปภาพ" });
    }

    // สร้าง Path สำหรับเก็บใน Postgres เป็น "img/CODE.png"
    const dbPath = `img/${req.file.filename}`;

    // ทำการ UPDATE ข้อมูลในตารางโดยอ้างอิงจาก code
    // หมายเหตุ: ตรวจสอบชื่อ Table และ Column 'images' กับ 'code' ให้ตรงกับ DB จริง
    const updateResult = await pool_smart.query(
      `UPDATE smart.smart_man_tco_certificate 
       SET images = $1 
       WHERE code = $2`,
      [dbPath, code],
    );

    // เช็คว่ามีการ Update จริงไหม (ถ้า code ไม่มีในระบบจะไม่มีแถวไหนโดนแก้)
    if (updateResult.rowCount === 0) {
      return res.status(404).json({ error: "ไม่พบพนักงานรหัสนี้ในระบบ" });
    }

    res.json({
      success: true,
      message: "อัปโหลดและบันทึกข้อมูลสำเร็จ",
      img: dbPath,
    });
  } catch (err) {
    console.error("Upload Error:", err);
    res.status(500).json({ error: "เกิดข้อผิดพลาดในการอัปโหลด" });
  }
});

module.exports = router;
