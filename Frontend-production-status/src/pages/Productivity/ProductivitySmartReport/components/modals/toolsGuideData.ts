import React from "react";
import {
  Eye,
  UserCheck,
  UserMinus,
  Calculator,
  Building2,
  UserCog,
  Layers,
  Network,
  TrendingUp,
  FileSpreadsheet,
} from "lucide-react";

export type ToolCategory = "DISPLAY" | "MANPOWER" | "MAPPING" | "DATA";

export interface CategoryTheme {
  label: string;
  iconBg: string;
  iconText: string;
  badgeBg: string;
  badgeText: string;
  accentBorder: string;
  ctaBg: string;
  activeRing: string;
  activeText: string;
}

export const CATEGORY_THEMES: Record<ToolCategory, CategoryTheme> = {
  DISPLAY: {
    label: "Display",
    iconBg: "bg-indigo-600 text-white",
    iconText: "text-white",
    badgeBg: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-200",
    badgeText: "text-indigo-700 dark:text-indigo-300",
    accentBorder: "border-l-indigo-600",
    ctaBg: "bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-500/25",
    activeRing: "border-indigo-600 ring-2 ring-indigo-500/30",
    activeText: "text-indigo-600 dark:text-indigo-400",
  },
  MANPOWER: {
    label: "Manpower",
    iconBg: "bg-purple-600 text-white",
    iconText: "text-white",
    badgeBg: "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-200",
    badgeText: "text-purple-700 dark:text-purple-300",
    accentBorder: "border-l-purple-600",
    ctaBg: "bg-purple-600 hover:bg-purple-700 text-white shadow-purple-500/25",
    activeRing: "border-purple-600 ring-2 ring-purple-500/30",
    activeText: "text-purple-600 dark:text-purple-400",
  },
  MAPPING: {
    label: "Mapping",
    iconBg: "bg-blue-600 text-white",
    iconText: "text-white",
    badgeBg: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200",
    badgeText: "text-blue-700 dark:text-blue-300",
    accentBorder: "border-l-blue-600",
    ctaBg: "bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/25",
    activeRing: "border-blue-600 ring-2 ring-blue-500/30",
    activeText: "text-blue-600 dark:text-blue-400",
  },
  DATA: {
    label: "Data & Excel",
    iconBg: "bg-emerald-600 text-white",
    iconText: "text-white",
    badgeBg: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
    badgeText: "text-emerald-700 dark:text-emerald-300",
    accentBorder: "border-l-emerald-600",
    ctaBg: "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/25",
    activeRing: "border-emerald-600 ring-2 ring-emerald-500/30",
    activeText: "text-emerald-600 dark:text-emerald-400",
  },
};

export const getAssetUrl = (assetPath?: string) => {
  if (!assetPath) return "";
  if (assetPath.startsWith("http://") || assetPath.startsWith("https://") || assetPath.startsWith("data:")) {
    return assetPath;
  }
  const cleanPath = assetPath.startsWith("/") ? assetPath.slice(1) : assetPath;
  const baseUrl = import.meta.env.BASE_URL || "/";
  return baseUrl.endsWith("/") ? `${baseUrl}${cleanPath}` : `${baseUrl}/${cleanPath}`;
};

export const CATEGORIES_CONFIG: { id: string; label: string }[] = [
  { id: "ALL", label: "All" },
  { id: "DISPLAY", label: "Display" },
  { id: "MANPOWER", label: "Manpower" },
  { id: "MAPPING", label: "Mapping" },
  { id: "DATA", label: "Data & Excel" },
];

export interface ToolGuideItem {
  id: string;
  title: string;
  subtitle: string;
  category: ToolCategory;
  categoryLabel: string;
  icon: React.ComponentType<{ className?: string; size?: number }>;
  adminOnly: boolean;
  purpose: string;
  guideImageUrl?: string;
  imageCaption?: string;
  steps: { title: string; desc: string }[];
  keyHighlights: string[];
  tips: string[];
}

export const TOOLS_GUIDE_DATA: ToolGuideItem[] = [
  {
    id: "table_visibility",
    title: "Table Visibility & Reorder (จัดการตารางและจัดลำดับไลน์)",
    subtitle: "จัดการการซ่อน/แสดง เปลี่ยนชื่อเรียก และจัดลำดับการแสดงผลตารางในรายงาน",
    category: "DISPLAY",
    categoryLabel: "Display",
    icon: Eye,
    adminOnly: true,
    purpose:
      "ใช้สำหรับเปิดหรือปิดการแสดงผลตารางผลผลิต (Productivity Board Matrix) ซ่อนไลน์ที่ไม่ต้องการ จัดเรียงลำดับตารางให้ไลน์สำคัญขึ้นก่อน และแก้ไขชื่อเรียกของตารางให้กระชับ เข้าใจง่าย",
    guideImageUrl: "/guide-images/table-visibility-guide.png",
    imageCaption:
      "หน้าต่างจัดการตารางและจัดลำดับไลน์: เลือกแท็บเพื่อสลับโหมดเปิด/ปิด หรือลากจัดลำดับไลน์ พร้อมปุ่มลัดแสดงทั้งหมดและรีเซ็ต",
    steps: [
      {
        title: "1. เปิดหน้าต่างจัดการตารางและจัดลำดับไลน์",
        desc: "คลิกปุ่ม 'จัดการตารางและจัดลำดับไลน์' ในแถบ Management Tools ด้านบนของหน้าจอ",
      },
      {
        title: "2. แท็บ Table Visibility (เปิด/ปิด และเปลี่ยนชื่อ)",
        desc: "คลิกสวิตช์ Toggle หรือการ์ดไลน์เพื่อสลับสถานะเปิดแสดง หรือ 'ซ่อน (การ์ดสีเทา)' และคลิกไอคอนดินสอเพื่อแก้ไขชื่อเรียก (Custom Display Name)",
      },
      {
        title: "3. แท็บ Reorder Lines (จัดลำดับตาราง)",
        desc: "สลับไปที่แท็บ 'Reorder Lines' เพื่อลากและวาง (Drag & Drop) จัดเรียงลำดับตารางไลน์การผลิตตามลำดับที่ต้องการให้แสดงในหน้ารายงาน",
      },
      {
        title: "4. เครื่องมือช่วยจัดการด่วน (Search & Quick Actions)",
        desc: "ใช้ช่องค้นหาหรือแท็บหมวดหมู่โรงงาน (SMT, MOT, ASSY, FPC, QA, CUSTOM) เพื่อกรองไลน์อย่างรวดเร็ว พร้อมปุ่มลัด 'แสดงทั้งหมด' และ 'รีเซ็ตทั้งหมด'",
      },
      {
        title: "5. บันทึกและซิงค์ข้อมูลส่วนกลาง",
        desc: "คลิกปุ่ม 'บันทึกและปิด (Done)' ระบบจะบันทึกการตั้งค่าลงฐานข้อมูลกลาง PostgreSQL ทันที ทำให้ทุกเครื่องและทุกครั้งที่เปิดรายงานจะแสดงผลตามที่ตั้งค่าไว้ตรงกัน",
      },
    ],
    keyHighlights: [
      "รองรับ 2 โหมดการทำงาน: Table Visibility (เปิด/ปิด/แก้ชื่อ) และ Reorder Lines (ลากจัดลำดับไลน์)",
      "ตารางที่ถูกซ่อนจะไม่ถูกลบออกจากระบบ สามารถเปิดกลับมาแสดงได้ตลอดเวลา",
      "ชื่อตารางที่กำหนดใหม่จะถูกนำไปแสดงทั้งในตาราง Matrix และกราฟสรุปทั้งหมด",
      "บันทึกลงฐานข้อมูลกลาง (PostgreSQL) ซิงค์การมองเห็นและลำดับไลน์ให้ผู้ใช้งานทุกคนเห็นตรงกัน",
    ],
    tips: [
      "หากต้องการค้นหาเฉพาะกลุ่มไลน์ ให้คลิกแท็บหมวดหมู่ เช่น SMT หรือ MOT เพื่อคัดกรองอย่างรวดเร็ว",
      "สามารถคืนค่าชื่อเดิมของแต่ละไลน์ได้โดยกดไอคอนดินสอแล้วเลือก 'คืนค่าชื่อเดิม'",
      "หากต้องการให้ตารางแสดงครบทั้งหมดทันที สามารถคลิกปุ่ม 'แสดงทั้งหมด' ได้ในคลิกเดียว",
    ],
  },
  {
    id: "attendance",
    title: "Attendance (ข้อมูลการเข้างานรายวัน)",
    subtitle: "ตรวจสอบรายชื่อพนักงานที่รูดบัตรเข้าทำงานจริง เวลาสแกนเข้า-ออก และคนไปช่วยงาน",
    category: "MANPOWER",
    categoryLabel: "Manpower",
    icon: UserCheck,
    adminOnly: true,
    purpose:
      "ใช้สำหรับตรวจสอบความถูกต้องของข้อมูลสแกนบัตรเข้าทำงานของพนักงานจริงในแต่ละวัน เพื่อยืนยันยอดคนทำงานจริง ยอดคนช่วยงานต่างสาขา และเวลาเข้า-ออก ก่อนนำไปคำนวณ Productivity",
    guideImageUrl: "/guide-images/attendance-guide.png",
    imageCaption:
      "หน้าต่าง Attendance: กรองสถานะ Normal/Absent/Abnormal ตรวจสอบเวลาสแกนบัตรเข้า-ออก และปุ่มคัดกรองคนไปช่วยงานต่างสาขา",
    steps: [
      {
        title: "1. เลือกวันที่และไลน์ (Date & Line Picker)",
        desc: "เลือกวันที่ที่ต้องการตรวจสอบข้อมูลการรูดบัตรเข้าทำงานจริง พร้อมแสดงชื่อไลน์การผลิตที่กำลังดูข้อมูล",
      },
      {
        title: "2. สรุปยอดสแกนและช่วยงาน (Total Scans & Loaned Out)",
        desc: "แสดงจำนวนพนักงานที่สแกนบัตรทั้งหมดในวันนั้น และปุ่มสีฟ้าสำหรับคลิกกรองเฉพาะพนักงานที่ไปช่วยงานสาขาอื่น",
      },
      {
        title: "3. กรองตามสถานะการเข้างาน (Status Filter)",
        desc: "เมนูดรอปดาวน์สำหรับเลือกกรองพนักงานตามสถานะ เช่น Normal (ปกติ), Absent (ไม่มาทำงาน), Abnormal (เวลาผิดปกติ)",
      },
      {
        title: "4. ค้นหาข้อมูลพนักงาน (Search Employee)",
        desc: "พิมพ์ค้นหาจากรหัสพนักงาน หรือชื่อ-นามสกุล แล้วกดปุ่ม 'ค้นหา' เพื่อดูข้อมูลเฉพาะบุคคลได้อย่างรวดเร็ว",
      },
      {
        title: "5. รีเฟรชข้อมูล (Refresh Scans)",
        desc: "กดปุ่มเพื่อดึงข้อมูลสแกนบัตรล่าสุดจากระบบ Time Attendance อีกครั้ง",
      },
      {
        title: "6. ตารางแสดงเวลาเข้า-ออก (Attendance Records Table)",
        desc: "แสดงรายละเอียดรหัสพนักงาน, แผนก / Cost Center, กะการทำงาน (Day/Night), เวลาสแกนเข้า (In) และเวลาสแกนออก (Out)",
      },
      {
        title: "7. ป้ายสถานะการทำงาน (Work Status Badges)",
        desc: "ป้ายแสดงสถานะ: Normal (สีเขียว - เข้างานปกติ), Absent (สีเทา - ไม่พบสแกน), Abnormal (สีส้ม - สแกนเข้าหรือออกไม่ครบ)",
      },
    ],
    keyHighlights: [
      "ดึงข้อมูลเวลาสแกนบัตรจากฐานข้อมูล HR / Time Attendance โดยตรง",
      "มีปุ่มลัดคัดกรองพนักงานที่ไปช่วยงานต่างสาขาได้อย่างรวดเร็ว",
      "แสดงสถานะสีอย่างชัดเจน: Normal (สีเขียว), Abnormal (สีส้ม), Absent (สีเทา)",
      "รองรับการค้นหาแบบระบุรหัสและชื่อ-นามสกุลพนักงาน",
    ],
    tips: [
      "หากตัวเลขชั่วโมงการทำงานหรือคนทำงานของไลน์ดูผิดปกติ ให้เข้ามาตรวจสอบเวลาเข้า-ออกในหน้าต่างนี้เป็นอันดับแรก",
      "หากต้องการดูข้อมูลล่าสุด ให้กดปุ่มรีเฟรชที่มุมขวาบนของแถบเครื่องมือ",
    ],
  },
  {
    id: "manpower_support",
    title: "Manpower Support (ตรวจสอบพนักงานช่วยงาน)",
    subtitle: "ตรวจสอบรายชื่อพนักงานไปช่วยงานต่างสาขา",
    category: "MANPOWER",
    categoryLabel: "Manpower",
    icon: UserMinus,
    adminOnly: true,
    purpose:
      "ใช้สำหรับบันทึกการส่งพนักงานไปช่วยงานต่างสาขา เพื่อหักลบจำนวนคนและ Man Hours ออกจากไลน์ต้นทาง ทำให้ตัวเลข Productivity สะท้อนต้นทุนกำลังคนที่ผลิตจริง ไม่ถูกคิดคนเกินจริง",
    guideImageUrl: "/guide-images/manpower-support-guide.png",
    imageCaption:
      "หน้าต่างจัดการพนักงานช่วยงาน: ระบุรหัสพนักงาน ตรวจสอบ ระบุสาขาและระยะเวลา พร้อมปุ่มเช็คจาก Database และส่งออก Excel",
    steps: [
      {
        title: "1. กรอกรหัสและตรวจสอบพนักงาน (Employee ID & Verify)",
        desc: "พิมพ์รหัสพนักงานแล้วคลิกปุ่ม 'ตรวจสอบ' ระบบจะค้นหาและแสดงชื่อ-นามสกุล และแผนก/Cost Center อัตโนมัติ",
      },
      {
        title: "2. เลือกสาขาและกำหนดระยะเวลา (Branch & Date Range)",
        desc: "เลือกสาขา/สถานที่ที่ไปช่วยงาน (N1, A1, P1, K1) พร้อมกำหนดช่วงวันที่เริ่มต้นและวันที่สิ้นสุดการไปช่วยงาน",
      },
      {
        title: "3. ปุ่มบันทึกข้อมูลช่วยงาน (Save Action)",
        desc: "คลิกปุ่ม '+ บันทึกข้อมูลช่วยงาน' ระบบจะบันทึกและนำข้อมูลไปหักลดยอดคนและชั่วโมง (Man Hours) ในตาราง Productivity อัตโนมัติ",
      },
      {
        title: "4. สรุปยอดและแท็บกรองสถานะ (Summary & Status Tabs)",
        desc: "แสดงจำนวนรายการช่วยงานทั้งหมด และปุ่มแท็บสำหรับคลิกกรองดูเฉพาะกลุ่ม 'กำลังช่วยงาน (Active)' หรือ 'ครบกำหนดแล้ว (Expired)'",
      },
      {
        title: "5. ปุ่มเช็คคนช่วยงานจาก Database (Check Attendance DB)",
        desc: "คลิกปุ่มเพื่อเปิดหน้าต่างตรวจสอบข้อมูลสแกนบัตร (Auto-Detect) ที่ระบบตรวจพบรหัสไปช่วยงานต่างสาขาจาก Time Attendance",
      },
      {
        title: "6. เครื่องมือจัดการด่วน (Batch Edit & Export Excel)",
        desc: "ปุ่ม 'เลือกหลายคนเพื่อแก้ไข' (Batch Edit) สำหรับจัดการทีละหลายรายการพร้อมกัน และปุ่ม 'Export Excel' สำหรับส่งออกข้อมูล",
      },
      {
        title: "7. ตารางและปุ่มจัดการ (Records Table, Edit & Delete)",
        desc: "ตารางแสดงรหัสพนักงาน แผนก ป้ายสีสาขาช่วยงาน พร้อมไอคอนดินสอสีส้มสำหรับแก้ไขข้อมูล และไอคอนถังขยะสีแดงสำหรับลบรายการ",
      },
    ],
    keyHighlights: [
      "ระบบจะหักลดชั่วโมงทำงาน (Man Hours) ออกจากไลน์ต้นทางในวันที่มีผล เพื่อไม่ให้ยอดคนถูกคิดเกินจริง",
      "มีปุ่มเช็คคนช่วยงานจาก Database เชื่อมโยงดึงสถานะสแกนบัตรจาก Time Attendance โดยตรง",
      "รองรับโหมดแก้ไขพร้อมกันหลายรายการ (Batch Edit) เพื่อปรับเปลี่ยนสาขาหรือวันที่สิ้นสุดได้ในคราวเดียว",
      "สามารถส่งออกรายการพนักงานที่ไปช่วยงานเป็นไฟล์ Excel ได้ทันที",
    ],
    tips: [
      "หากไม่ระบุ 'วันสิ้นสุด (End Date)' ระบบจะถือว่าไปช่วยงานต่อเนื่องแบบไม่มีกำหนด",
      "สามารถค้นหาพนักงานได้ทั้งจากรหัสพนักงาน 6 หลัก หรือชื่อ-นามสกุล หรือชื่อแผนก",
      "เมื่อพนักงานกลับมาทำงานที่ไลน์เดิม ให้กดไอคอนดินสอเพื่อใส่วันสิ้นสุด หรือกดไอคอนถังขยะเพื่อลบรายการช่วยงาน",
    ],
  },
  {
    id: "manpower_audit",
    title: "Manpower (ตารางการคำนวณ Daily Manpower)",
    subtitle: "ตรวจสอบตัวแปรคำนวณกำลังคน สแกนบัตร Man Hour, OT และตรวจสอบรายชื่อคนรูดบัตร",
    category: "MANPOWER",
    categoryLabel: "Manpower",
    icon: Calculator,
    adminOnly: true,
    purpose:
      "ใช้สำหรับเปิดดูตารางสรุปข้อมูลแรงงานรายวัน (Daily Manpower Audit) แบบละเอียด แสดงตัวแปรคำนวณทั้งหมดตั้งแต่ Register, Actual Attendance, Leave, Help In/Out, OT1/OT2 จนถึงผลลัพธ์ Total Man Hours ที่ใช้คำนวณ Productivity",
    guideImageUrl: "/guide-images/manpower-audit-guide.png",
    imageCaption:
      "หน้าต่างตารางคำนวณกำลังคน (Daily Manpower): เลือกไลน์ย่อย ตรวจสอบตัวแปรยอดคน ยอดลา ช่วยงาน และชั่วโมงทำงานรวม",
    steps: [
      {
        title: "1. เลือกไลน์และช่วงวันที่ (Line Dropdown & Date Info)",
        desc: "เลือกไลน์ย่อยที่ต้องการตรวจสอบข้อมูลแรงงาน (เช่น Macro PCN) โดยระบบจะแสดงหมวดหมู่โรงงานและช่วงวันที่ของรอบรายงานที่กำลังตรวจสอบ",
      },
      {
        title: "2. หัวตารางและวันที่ทำงาน (Date Columns Header)",
        desc: "แสดงคอลัมน์ชื่อตัวแปร (PARAMETER) และวันที่แต่ละวันตลอดทั้งเดือน พร้อมแยกแถบสีวันทำงานปกติ วันเสาร์ และวันอาทิตย์อย่างชัดเจน",
      },
      {
        title: "3. ยอดลงทะเบียนและคนมาทำงานจริง (Register & Actual Attendance)",
        desc: "แสดงยอดพนักงานที่ลงทะเบียนในระบบ (Register), ยอดมาทำงานจริงรวม (Actual Total) และแยกตามกะการทำงาน (Day Shift / Night Shift)",
      },
      {
        title: "4. ยอดลาและชั่วโมงช่วยงานปกติ (Leave & Help In/Out Normal)",
        desc: "แสดงจำนวนพนักงานที่ลางาน (Leave) พร้อมสรุปชั่วโมงที่ส่งคนไปช่วยงานไลน์อื่น (- Help Out) และรับคนจากไลน์อื่นมาช่วย (+ Help In)",
      },
      {
        title: "5. การทำงานล่วงเวลาและอัตราส่วน OT (OT Attendance & Work Rate %)",
        desc: "สรุปยอดคนทำ OT1, OT2, การช่วยงานช่วง OT พร้อมคำนวณอัตราส่วนการทำงานล่วงเวลา (OT1 Work Rate % / OT2 Holiday Rate %)",
      },
      {
        title: "6. สรุปชั่วโมงทำงานรวม (Total Man Hours Summary)",
        desc: "คำนวณชั่วโมงทำงานปกติ (Normal MH), ชั่วโมงทำงานล่วงเวลา (OT MH) และชั่วโมงทำงานรวมสุทธิ (Total MH) ที่นำไปใช้คำนวณ Productivity",
      },
    ],
    keyHighlights: [
      "แสดงพารามิเตอร์ครบวงจรตั้งแต่ยอดคนลงทะเบียน (Register) จนถึงชั่วโมงทำงานสุทธิ (Total MH)",
      "แยกแถบสีของวันทำงานปกติ วันเสาร์ (สีชมพูอ่อน) และวันอาทิตย์ (สีส้ม/แดงอ่อน) เพื่อให้สังเกตง่าย",
      "มีตัวเลขหักลบชั่วโมงช่วยงาน Help Out (-) และเพิ่มชั่วโมงช่วยงาน Help In (+) ชัดเจน",
      "มีลิงก์ * ด้านล่างตารางสำหรับคลิกเปิดหน้ารายงานสรุปการคำนวณรายไลน์ย่อยและรายชื่อคนรูดบัตร (Admin Audit)",
    ],
    tips: [
      "หาก Total MH ในวันใดวันหนึ่งดูสูงหรือต่ำผิดปกติ ให้ตรวจสอบแถว Leave หรือ Help Out/In ในวันนั้น",
      "แถว Leave มีแถบสีส้มช่วยเน้นให้เห็นวันที่พนักงานหยุดงานหรือลางานจำนวนมากได้ทันที",
      "สามารถคลิกดูตารางของไลน์ย่อยอื่นๆ ได้ทันทีจากดรอปดาวน์เลือกไลน์ด้านบนซ้ายของหน้าต่าง",
    ],
  },
  {
    id: "cost_center",
    title: "Cost Center (จัดการและตรวจสอบศูนย์ต้นทุน)",
    subtitle: "จัดการการแมป Cost Center และ Line Out สำหรับการคำนวณกำลังคน (Manpower)",
    category: "MAPPING",
    categoryLabel: "Mapping",
    icon: Building2,
    adminOnly: true,
    purpose:
      "ใช้สำหรับจัดการและจับคู่รหัสศูนย์ต้นทุน (Cost Center) เข้ากับไลน์ผลิตหลัก (Line Out) เพื่อให้ระบบนำยอดพนักงานและชั่วโมงทำงานจาก Time Attendance ไปคำนวณ Productivity ของแต่ละไลน์ได้อย่างถูกต้องแม่นยำ พร้อมระบบ Verify ตรวจจับการย้ายไลน์อัตโนมัติ",
    guideImageUrl: "/guide-images/cost-center-guide.png",
    imageCaption:
      "หน้าต่างจัดการ Cost Center: ค้นหา กรอง แถบเตือน Unmapped ตารางจัดการ พร้อมโมดอลเพิ่มรหัสและระบบ Verify Mapping ตรวจจับชื่อไลน์ไม่ตรง",
    steps: [
      {
        title: "1. ค้นหาและกรองข้อมูล (Search & Multi-level Filter)",
        desc: "พิมพ์ค้นหารหัส Cost Center หรือชื่อไลน์ พร้อมตัวกรอง Type (Direct/Indirect), Line (เช่น ASY2, SMT) และ Shift (D/N) เพื่อคัดกรองข้อมูลรวดเร็ว",
      },
      {
        title: "2. แถบแจ้งเตือน Cost Center ที่ยังไม่ได้ผูก Line Out (Unmapped Alert)",
        desc: "ระบบสแกนข้อมูลจาก Time Attendance อัตโนมัติ หากพบรหัส Cost Center ที่ยังไม่ได้ผูกเข้ากับไลน์ผลิต จะมีปุ่มสีส้มให้คลิกดูรายการที่ค้างอยู่ได้ทันที",
      },
      {
        title: "3. ประวัติการแก้ไขและเพิ่มรายการใหม่ (History & Add Cost Center)",
        desc: "ปุ่ม 'History' สำหรับเปิดดูประวัติ Audit Log การเพิ่ม/แก้ไขย้อนหลัง และปุ่ม '+ Add Cost Center' สำหรับเปิดโมดอลสร้างรหัสใหม่เข้าระบบ",
      },
      {
        title: "4. ตารางรายการและปุ่มจัดการ (Records Table, Status & Actions)",
        desc: "แสดงรหัส, ชื่อแผนก, ป้าย Type (Direct/Indirect สีน้ำเงิน/ชมพู), ป้าย Line Mapped พร้อมไอคอนดินสอสีฟ้าสำหรับแก้ไข และไอคอนถังขยะสีแดงสำหรับลบ",
      },
      {
        title: "5. กรอกรหัสและข้อมูลพื้นฐาน (Cost Center Code & Setup)",
        desc: "เลือกรหัส Cost Center จากฐานข้อมูล HR (มีระบบ Auto-fill ดึงชื่อแผนกให้อัตโนมัติ), เลือก Type การผลิต, และระบุ Process, Line, Shift",
      },
      {
        title: "6. ตรวจสอบและตรวจจับชื่อไลน์ไม่ตรง (Verify Mapping & Mismatch Alert)",
        desc: "กดปุ่ม 'Verify Mapping' เพื่อเช็คชื่อไลน์จริงในระบบ HR หากชื่อไลน์เปลี่ยนไป ระบบจะแจ้งเตือนพร้อมปุ่ม 'อัปเดตเป็น...' ให้คลิกเปลี่ยนชื่อทันที",
      },
      {
        title: "7. สรุปผลการจับคู่และบันทึกข้อมูล (Match Results & Save Action)",
        desc: "แสดงตัวเลขสรุปพนักงาน HR, ยอดคนช่วยงานเข้า-ออก และประเภท Line Output เมื่อตรวจสอบถูกต้องแล้ว กดปุ่ม 'Add Cost Center' เพื่อบันทึก",
      },
    ],
    keyHighlights: [
      "มีระบบ Auto-Detect สแกนตรวจหารหัส Cost Center ที่มีคนรูดบัตรเข้าทำงานจริงแต่ยังไม่ได้ผูก Line Out",
      "มีปุ่ม Verify Mapping เชื่อมโยงตรวจสอบกับฐานข้อมูล HR โดยตรง ป้องกันการสะกดชื่อไลน์ผิด",
      "มีปุ่มลัด 'อัปเดตเป็น...' ให้คลิกเปลี่ยนชื่อไลน์ให้ตรงกับฐานข้อมูล HR ได้ในคลิกเดียวเมื่อตรวจพบ Mismatch",
      "มีระบบ Audit History บันทึกประวัติการเพิ่ม แก้ไข หรือลบรหัส Cost Center เพื่อความโปร่งใสและตรวจสอบย้อนหลังได้",
    ],
    tips: [
      "เมื่อมีการเปิดไลน์ผลิตใหม่หรือเพิ่ม Cost Center ในระบบ HR ให้สังเกตแถบแจ้งเตือนสีส้มด้านบน แล้วกดคลิกเข้ามาผูกไลน์ได้ทันที",
      "ก่อนกดบันทึก Cost Center ทุกครั้ง ควรกดปุ่ม 'Verify Mapping' เพื่อให้ระบบยืนยันว่ามีพนักงานในระบบ HR และตรวจเช็คชื่อไลน์ให้ตรงกัน",
      "สามารถลบรหัส Cost Center ที่ไม่ได้ใช้งานได้ผ่านไอคอนถังขยะสีแดง (เฉพาะรายการที่อนุญาตให้ลบ)",
    ],
  },
  {
    id: "manpower_snapshot",
    title: "Manpower Snapshot (ระบบปรับแต่งยอดพนักงานย้อนหลัง)",
    subtitle: "ตรวจสอบและปรับแก้แผนก Cost Center, กะทำงาน และไลน์ของพนักงานรายวันย้อนหลังเพื่อความถูกต้อง",
    category: "MANPOWER",
    categoryLabel: "Manpower",
    icon: UserCog,
    adminOnly: true,
    purpose:
      "ใช้สำหรับตรวจสอบและปรับแต่งข้อมูลยอดพนักงานรายวันย้อนหลัง เช่น การย้ายแผนก Cost Center, กะการทำงาน หรือไลน์งาน เพื่อให้ข้อมูลกำลังคนย้อนหลังถูกต้องแม่นยำและสะท้อนหน้างานจริง",
    guideImageUrl: "/guide-images/manpower-snapshot-guide.png",
    imageCaption:
      "หน้าต่าง Manpower Snapshot Adjustment: ตัวเลือกวันที่บันทึกยอด, ตัวกรองค้นหาพนักงาน, แถบปรับ Cost Center แบบกลุ่ม และตารางรายการพนักงาน",
    steps: [
      {
        title: "1. เลือกวันที่บันทึกยอดพนักงาน (Snapshot Date Picker)",
        desc: "เลือกวันที่ที่ต้องการตรวจสอบหรือปรับแต่งข้อมูลยอดพนักงานรายวันย้อนหลัง พร้อมปุ่มรีเฟรชเพื่อดึงข้อมูลล่าสุดของวันนั้นจากระบบกลาง",
      },
      {
        title: "2. ค้นหาและคัดกรองพนักงาน (Search & Multi-Filters)",
        desc: "ช่องค้นหาตามรหัสพนักงานหรือชื่อ พร้อมตัวกรองคัดแยกตามแผนก (Dept), กะทำงาน (Shift: Day/Night), ไลน์การผลิต (Line) และสถานะ โดยแสดงยอดรวมและยอดที่กรองพบ",
      },
      {
        title: "3. ปรับเปลี่ยน Cost Center แบบกลุ่ม (Bulk Cost Center Assignment)",
        desc: "ติ๊กเลือกพนักงานทั้งหมดที่กรองไว้ (Select All Filtered) หรือเลือกทีละคน แล้วเลือกรหัส Cost Center ปลายทาง จากนั้นกดปุ่ม 'Apply to Selected' เพื่อเปลี่ยนแผนกพร้อมกันได้ทันที",
      },
      {
        title: "4. ตารางรายการพนักงานและปรับแก้รายบุคคล (Employee Records Table)",
        desc: "แสดงรหัสพนักงาน, ชื่อ, แผนก/Cost Center, กะ, ไลน์งาน และสถานะ โดยสามารถคลิกเมนูดรอปดาวน์เพื่อเปลี่ยน Cost Center รายคน หรือกดไอคอนดินสอด้านขวาเพื่อแก้ไขแบบละเอียด",
      },
      {
        title: "5. สถานะและปุ่มบันทึกการเปลี่ยนแปลง (Save Changes & Status Indicator)",
        desc: "แสดงสถานะความสมบูรณ์ของข้อมูลย้อนหลัง และปุ่ม 'Save Changes (N รายการ)' เพื่อยืนยันบันทึกการปรับแต่งทั้งหมดเข้าสู่ระบบรายงานกำลังคน",
      },
    ],
    keyHighlights: [
      "สามารถเลือกดูและปรับแก้ข้อมูลยอดพนักงานย้อนหลังได้ตามวันที่ต้องการ",
      "รองรับการค้นหาและกรองหลายเงื่อนไข: แผนก, กะทำงาน, ไลน์ผลิต และสถานะ",
      "มีฟังก์ชันปรับเปลี่ยน Cost Center แบบกลุ่ม (Bulk Update) ในคลิกเดียว",
      "แก้ไขได้ทั้งแบบเลือกเปลี่ยนผ่านเมนูดรอปดาวน์รายคน หรือคลิกปุ่มดินสอเพื่อแก้ไขแบบละเอียด",
    ],
    tips: [
      "เมื่อกรองพนักงานที่ต้องการได้แล้ว สามารถกด 'Select All Filtered' แล้วเลือก Cost Center ปลายทางเพื่ออัปเดตพนักงานทุกคนพร้อมกันทันทีได้อย่างรวดเร็ว",
      "ก่อนกดปุ่ม 'Save Changes' ให้ตรวจสอบจำนวนรายการที่มีการเปลี่ยนแปลงเพื่อความถูกต้องครบถ้วน",
    ],
  },
  {
    id: "custom_line",
    title: "Custom Line (สร้างไลน์ & กลุ่ม Macro Line)",
    subtitle: "สร้างและกำหนดไลน์แบบ Line Group หรือ Macro Line",
    category: "MAPPING",
    categoryLabel: "Mapping",
    icon: Layers,
    adminOnly: true,
    purpose:
      "เครื่องมือสำหรับสร้าง Single Line หรือ Macro Line เพื่อเพิ่มไลน์ผลผลิตใหม่ หรือรวมกลุ่มหลายไลน์เข้าด้วยกันสำหรับแสดงในรายงาน พร้อมผูกยอดผลิตเครื่องจักรและกำลังคน Cost Center",
    guideImageUrl: "/guide-images/custom-line-guide.png",
    imageCaption:
      "หน้าต่างสร้างและรวมกลุ่มไลน์ (Custom Line & Macro Builder): แถบรายการไลน์ที่บันทึกไว้ โหมด Single Line ผูกยอดผลิตและ Cost Center พร้อมโหมด Macro Line รวมกลุ่มหลายไลน์ย่อย",
    steps: [
      {
        title: "1. แถบรายการไลน์ที่บันทึกไว้ (Saved Custom Lines Sidebar)",
        desc: "แสดงรายการไลน์ที่เคยสร้างไว้ทั้งหมด พร้อมแท็บกรอง 'ไลน์เดี่ยว' และ 'Macro Group', ช่องค้นหาด่วน, ปุ่ม '+ สร้างใหม่' และไอคอนถังขยะสำหรับลบไลน์ที่ไม่ต้องการ",
      },
      {
        title: "2. ปุ่มสลับโหมดสร้างไลน์ (Mode Switcher: Single vs Macro)",
        desc: "เลือกระหว่าง 'สร้างไลน์เดี่ยว (Single Line)' เพื่อผูกยอดเครื่องจักรกับ Cost Center หรือ 'รวมกลุ่มไลน์ (Macro Line)' เพื่อรวมหลายไลน์ย่อยเข้าด้วยกัน",
      },
      {
        title: "3. ตั้งชื่อไลน์และเลือกโรงงาน (Line Name & Sectors)",
        desc: "พิมพ์ชื่อไลน์ที่ต้องการ เช่น 'Automotive', เลือกกลุ่มโรงงาน (SMT, FPC, ASSY, MOT) พร้อมเลือกเปิด/ปิดแถวแสดงผล (Plan, Target, OT, Leave)",
      },
      {
        title: "4. เลือกแหล่งยอดผลิตเครื่องจักร (Output Sources & Units)",
        desc: "เลือกหน่วยนับ (Piece, Sheet, Lot) ค้นหาหรือคลิกเลือกไลน์ยอดผลิตเครื่องจักรที่ต้องการนำมารวม พร้อมพิมพ์เพิ่มชื่อไลน์ใหม่ได้ตามต้องการ",
      },
      {
        title: "5. เลือกแหล่งคนทำงาน (Manpower & Cost Center Sources)",
        desc: "คลิกเลือกแผนกหรือรหัส Cost Center ที่รับผิดชอบผลิตในไลน์นี้ เพื่อนำยอดสแกนบัตรและชั่วโมงทำงาน (MH) มาร่วมคำนวณ Productivity",
      },
      {
        title: "6. โหมดรวมกลุ่มไลน์ย่อย (Macro Line: Select Sub-lines)",
        desc: "ในโหมด Macro Line ให้ติ๊กเลือกไลน์ย่อยที่มีอยู่แล้วในตาราง Productivity (เช่น AELT, AIX-ASY) ระบบจะรวมยอดผลิตและกำลังคนของทุกไลน์เข้าด้วยกันอัตโนมัติ",
      },
    ],
    keyHighlights: [
      "รองรับ 2 โหมดครบวงจร: Single Line (ผูกยอดเครื่องจักรกับคน) และ Macro Line (รวมกลุ่มไลน์หลายไลน์ย่อย)",
      "เลือกเปิด/ปิดแถวแสดงผล Plan, Target, OT, Leave ได้อย่างอิสระตามความต้องการของแต่ละไลน์",
      "มีระบบ Live Preview แสดงตัวเลขย้อนหลัง 8 วันจริง ตรวจสอบยอด Output และ Man Hours ทันทีก่อนกดบันทึก",
      "บันทึกข้อมูลเข้าสู่ระบบกลาง ซิงค์ให้ผู้ใช้งานทุกคนเห็นตารางใหม่ตรงกันทันที",
    ],
    tips: [
      "สำหรับ Single Line: ให้คลิกเลือกเครื่องจักรใน STEP 2 และเลือกรหัส Cost Center ใน STEP 3 ที่ทำงานคู่กันจริง",
      "สำหรับ Macro Line: ให้สลับโหมดที่ปุ่มมุมขวาบนเป็น 'รวมกลุ่มไลน์' แล้วติ๊กเลือกไลน์ย่อยที่ต้องการรวมยอดเข้าด้วยกัน",
      "สามารถค้นหาไลน์ที่เคยสร้างไว้ทางแถบด้านซ้าย หรือกดปุ่ม '+ สร้างใหม่' เพื่อเริ่มต้นสร้างไลน์ใหม่ได้ตลอดเวลา",
    ],
  },
  {
    id: "line_mapping",
    title: "Line Group & Output Mapping (จัดการกลุ่มไลน์และยอดผลิต)",
    subtitle: "จัดการจับคู่ขั้นตอนการผลิตและเครื่องจักรเข้ากับกลุ่มไลน์ เพื่อให้ระบบคำนวณยอดผลิตได้อย่างถูกต้อง",
    category: "MAPPING",
    categoryLabel: "Mapping",
    icon: Network,
    adminOnly: true,
    purpose:
      "ใช้สำหรับจับคู่ชื่อเครื่องจักรและขั้นตอนการผลิตเข้ากับกลุ่มไลน์หลัก เพื่อให้ระบบนำตัวเลขผลผลิตไปรวมในกลุ่มไลน์ที่ถูกต้องในรายงาน พร้อมทั้งสามารถกดตรวจสอบตัวเลขผลผลิตจริงจากหน้างานได้ทันที",
    guideImageUrl: "/guide-images/line-mapping-guide.png",
    imageCaption:
      "หน้าต่างตั้งค่า Line Group & Output Mapping: ฟอร์มเพิ่ม/แก้ไขการจับคู่ไลน์, แถบค้นหาและดึงยอดล่าสุด, ตารางรายการพร้อมปุ่มจัดการ และหน้าต่างตรวจสอบยอดผลิตจริง",
    steps: [
      {
        title: "1. ฟอร์มเพิ่มการจับคู่ไลน์ (เพิ่ม Line Output Mapping)",
        desc: "เลือกแผนก/ฝ่าย (FPC, SMT, QA), ระบุชื่อกลุ่มไลน์, เลือกขั้นตอนการผลิต (Process) และเครื่องจักร พร้อมกำหนดรหัสสินค้าที่ต้องการนับยอดหรือยกเว้น",
      },
      {
        title: "2. ปุ่มบันทึกและตรวจสอบยอดผลิต (บันทึก & ตรวจสอบด่วน)",
        desc: "กดปุ่ม '+ บันทึกข้อมูล Line Mapping' เพื่อบันทึกเข้าสู่ระบบ หรือกดปุ่ม 'ตรวจสอบ Output ทันที' เพื่อดูยอดผลิตจริงของค่าที่กำลังกรอกได้ล่วงหน้า",
      },
      {
        title: "3. แถบค้นหา กรอง และดึงยอดผลิตล่าสุด (ค้นหา, กรอง & ซิงค์ข้อมูล)",
        desc: "ช่องค้นหาด่วนตามชื่อกลุ่มไลน์หรือเครื่องจักร, กรองตามแผนก, ปุ่มรีเฟรช, ปุ่ม 'Sync Recent Output' ดึงยอดล่าสุดจากหน้างาน และปุ่ม 'View History' ดูประวัติ",
      },
      {
        title: "4. ตารางแสดงรายการกลุ่มไลน์ที่ตั้งค่าไว้ (รายการ Line Mapping ทั้งหมด)",
        desc: "แสดงรายการที่จับคู่ไว้ทั้งหมด ระบุชื่อกลุ่มไลน์, ขั้นตอนผลิต, เครื่องจักรที่ผูกไว้ และป้ายรหัสสินค้าที่นับรวมหรือยกเว้น (ป้ายสีชมพู)",
      },
      {
        title: "5. ปุ่มจัดการข้อมูล 4 รูปแบบ (ดูยอดผลิต, แก้ไข, ผูกเครื่องจักร, ลบ)",
        desc: "ไอคอนกราฟสีเขียว (เปิดดูยอดผลิตจริง), ดินสอสีฟ้า (แก้ไขข้อมูล), สไลเดอร์สีม่วง (จัดการเครื่องจักรในกลุ่ม), และถังขยะสีแดง (ลบรายการ)",
      },
      {
        title: "6. หน้าต่างเจาะลึกยอดผลิตจริง (ตรวจสอบยอดผลิตหน้างาน)",
        desc: "เจาะลึกตัวเลขยอดผลิตจริงหน้างาน สรุป 4 ด้านสำคัญ (ยอดชิ้นงาน, ยอดแผ่น, ยอดล็อต, วันที่มีการผลิต) พร้อมกราฟแท่งเปรียบเทียบผลผลิตรายวัน",
      },
    ],
    keyHighlights: [
      "ตรวจสอบยอดผลิตจริงหน้างานได้ทันที สรุปทั้งยอดชิ้นงาน (Pieces), แผ่น (Sheets), ล็อต (Lots) และจำนวนวันผลิต",
      "มีแถบกราฟเปรียบเทียบรายวัน ช่วยตรวจเช็คแนวโน้มและความสม่ำเสมอของผลผลิตในแต่ละวัน",
      "รองรับการทดสอบรหัสสินค้าที่ต้องการนับยอด หรือรหัสสินค้าที่ต้องการยกเว้นก่อนบันทึกจริง",
      "ปุ่มซิงค์ดึงยอดผลิตล่าสุด ช่วยอัปเดตข้อมูลการผลิตล่าสุดเข้าสู่ระบบได้อย่างสะดวกรวดเร็ว",
    ],
    tips: [
      "ก่อนบันทึกข้อมูลจับคู่ไลน์ใหม่ แนะนำให้กดปุ่ม 'ตรวจสอบ Output ทันที' เพื่อดูตัวเลขผลผลิตจริงล่วงหน้า ป้องกันการเลือกเครื่องจักรหรือขั้นตอนผิดกลุ่ม",
      "หากต้องการยกเว้นสินค้าบางประเภทที่ไม่ต้องการให้นับยอดรวม ให้พิมพ์รหัสสินค้านั้นในช่อง 'Exclude Prefix (Optional)' เช่น IC1Z, VLOZ",
      "สามารถคลิกที่ไอคอนกราฟสีเขียวในแต่ละแถว เพื่อเปิดดูประวัติยอดผลิตย้อนหลังและสถิติการผลิตของไลน์นั้นๆ ได้ทันที",
    ],
  },
  {
    id: "target_adjustment",
    title: "Target Adjustment (ระบบปรับแต่งเป้าหมายและแผนผลิต)",
    subtitle: "กำหนดเป้าหมายรายเดือนและแผนผลิตรายวัน พร้อมเครื่องมือเติมค่าอัตโนมัติและคัดลอกจาก Excel",
    category: "DATA",
    categoryLabel: "Data & Excel",
    icon: TrendingUp,
    adminOnly: true,
    purpose:
      "ใช้สำหรับกำหนดตัวเลขเป้าหมายผลผลิต (Productivity Target) และแผนผลิตรายวัน (Daily Plan) แบบรายเดือนสำหรับทุกไลน์การผลิต รองรับการคัดลอกจาก Excel และเครื่องมือเติมค่าอัตโนมัติ",
    guideImageUrl: "/guide-images/target-adjustment-guide.png",
    imageCaption:
      "หน้าต่าง Target Adjustment: โหมดสลับเป้าหมาย/แผนผลิต, ปุ่มดาวน์โหลดฟอร์มและนำเข้าไฟล์ Excel, เครื่องมือ Quick Fill และตารางเมทริกซ์รายวัน",
    steps: [
      {
        title: "1. ดาวน์โหลดแบบฟอร์มและนำเข้าไฟล์ (Download & Import File)",
        desc: "ปุ่ม 'Download Form' เพื่อดาวน์โหลดเทมเพลต Excel ตามเดือน/ปีที่เลือก และปุ่ม 'Import File' เพื่ออัปโหลดไฟล์ Excel แผนผลิตกลับเข้าระบบอย่างรวดเร็วโดยไม่ต้องกรอกเอง",
      },
      {
        title: "2. สลับโหมดเป้าหมายและตัวกรอง (Mode & Sector Filters)",
        desc: "สลับดูเป้าหมาย 'Productivity Target' หรือ 'Daily Plan', เลือกหน่วยนับ (Pcs / Sheet), เลือกเดือน/ปี และปุ่มคัดกรองโรงงาน (ALL, SMT, FPC, MACRO) พร้อมช่องค้นหาชื่อไลน์",
      },
      {
        title: "3. เครื่องมือเติมเป้าหมายด่วน (Quick Fill All Days)",
        desc: "เลือกกลุ่มไลน์ที่ต้องการ (หรือกดปุ่ม All 68 ไลน์, SMT, FPC) กรอกตัวเลขเป้าหมาย แล้วกดปุ่ม 'Fill All Days' เพื่อเติมตัวเลขลงทุกวันตลอดทั้งเดือนในคลิกเดียว",
      },
      {
        title: "4. ตารางเมทริกซ์รายวันและรองรับ Excel Paste (Daily Matrix Grid)",
        desc: "แสดงตารางเป้าหมายรายวันตลอดทั้งเดือน พร้อมเน้นสีวันหยุดเสาร์-อาทิตย์ สามารถคลิกแก้ไขตัวเลขในช่องได้โดยตรง หรือคัดลอก (Copy) จาก Excel มาวาง (Paste) ลงในตารางได้ทันที",
      },
      {
        title: "5. สถานะการแก้ไขและปุ่มบันทึก (Save Changes & Status Legend)",
        desc: "แสดงสัญลักษณ์จุดสีส้มเมื่อมีช่องที่ถูกแก้ไขและยังไม่ได้บันทึก พร้อมปุ่มสีน้ำเงิน 'บันทึก (N รายการ)' เพื่อยืนยันการบันทึกตัวเลขลงสู่ระบบรายงาน",
      },
    ],
    keyHighlights: [
      "กำหนดเป้าหมายรายเดือนและแผนผลิตรายวันได้ครบทุกไลน์การผลิตในหน้าจอเดียว",
      "รองรับการคัดลอก (Copy) ข้อมูลจาก Excel แล้วกด Ctrl+V วางลงในตารางได้ทันที",
      "มีเครื่องมือ Quick Fill ช่วยเติมตัวเลขเป้าหมายลงทุกวันตลอดทั้งเดือนได้ในคลิกเดียว",
      "มีแบบฟอร์ม Excel สำเร็จรูปให้ดาวน์โหลดไปกรอก และอัปโหลดกลับเข้าระบบได้อย่างสะดวก",
    ],
    tips: [
      "สามารถเตรียมตัวเลขเป้าหมายในไฟล์ Excel แล้วทำการ Copy ช่วงตาราง จากนั้นคลิกที่ช่องแรกในระบบแล้วกด Ctrl+V เพื่อวางข้อมูลหลายวันและหลายไลน์พร้อมกันได้ทันที",
      "ช่องที่มีการแก้ไขแต่ยังไม่ได้บันทึกจะมีจุดสีส้มแจ้งเตือน อย่าลืมกดปุ่ม 'บันทึก' เพื่อยืนยันข้อมูลลงสู่ระบบ",
    ],
  },
  {
    id: "import_excel",
    title: "Import Excel (ระบบนำเข้าข้อมูล Daily Actual Output)",
    subtitle: "นำเข้าไฟล์ Excel แผนผลิตและยอดผลิตจริง พร้อมระบบดึงข้อมูลอัตโนมัติจากเครือข่ายโรงงาน",
    category: "DATA",
    categoryLabel: "Data & Excel",
    icon: FileSpreadsheet,
    adminOnly: true,
    purpose:
      "ใช้สำหรับนำเข้าไฟล์ Excel แผนผลิตและยอดผลิตจริง (Daily Actual Output) เข้าสู่ระบบรายงานเพื่อคำนวณ Productivity หรือดึงข้อมูลอัตโนมัติจากเครือข่ายโรงงาน และรองรับการกรอก/แก้ไขแผนผลิตด้วยตนเอง",
    guideImageUrl: "/guide-images/import-excel-guide.png",
    imageCaption:
      "หน้าต่างระบบนำเข้าข้อมูล Daily Actual Output: แท็บเลือกโหมดการทำงาน, ปุ่ม Sync ข้อมูลอัตโนมัติ SMT/EFPC, พื้นที่ลากวางไฟล์ Excel และปุ่มยืนยันการบันทึกข้อมูล",
    steps: [
      {
        title: "1. แท็บเลือกโหมดการทำงาน (Mode Navigation Tabs)",
        desc: "มี 3 โหมดหลักให้เลือกใช้งาน: นำเข้าไฟล์ Excel อัตโนมัติ, กรอกหรือแก้ไขแผนผลิตด้วยตนเอง (Manual), และดูประวัติการนำเข้าย้อนหลัง พร้อมบันทึกชื่อผู้ดำเนินการ",
      },
      {
        title: "2. ดึงข้อมูลแผนผลิต SMT อัตโนมัติ (Auto Sync Plan SMT)",
        desc: "คลิกปุ่ม 'Sync ข้อมูล Plan SMT' ระบบจะดึงไฟล์แผนผลิต SMT ล่าสุดจากโฟลเดอร์เครือข่ายโรงงาน (10.17.88.65) เข้าสู่ระบบทันทีในคลิกเดียว โดยไม่ต้องดาวน์โหลดและอัปโหลดไฟล์เอง",
      },
      {
        title: "3. ดึงข้อมูลแผนผลิต EFPC อัตโนมัติ (Auto Sync Plan EFPC)",
        desc: "คลิกปุ่ม 'Sync ข้อมูล Plan EFPC' เพื่อดึงไฟล์รายงาน Output E-FPC ล่าสุดจากโฟลเดอร์เครือข่ายโรงงานเข้าสู่ระบบโดยตรง ป้องกันการเลือกไฟล์ผิดพลาดและประหยัดเวลา",
      },
      {
        title: "4. พื้นที่ลากวางหรือเลือกไฟล์ Excel (Drag & Drop File Upload)",
        desc: "คลิกหรือลากไฟล์ Excel (.xlsx) มาวางในกรอบเส้นประ ระบบจะสแกนอ่านข้อมูลทุกชีทและค้นหาบรรทัด 'Daily Actual Output' ให้โดยอัตโนมัติ พร้อมแสดงพรีวิวให้ตรวจสอบก่อนบันทึก",
      },
      {
        title: "5. ปุ่มยืนยันการบันทึกข้อมูล (Save Confirmation Button)",
        desc: "แสดงจำนวนรายการที่ระบบสแกนพบจากไฟล์ Excel และกดปุ่มนี้เพื่อยืนยันการบันทึกตัวเลขทั้งหมดเข้าสู่ระบบรายงาน เพื่อนำไปคำนวณ Productivity ทันที",
      },
    ],
    keyHighlights: [
      "มีระบบ Auto Sync ดึงไฟล์แผนผลิตจากเครือข่ายโรงงานได้ทั้ง SMT และ EFPC ภายในคลิกเดียว",
      "ระบบสแกนค้นหาบรรทัด 'Daily Actual Output' จากทุกชีทในไฟล์ Excel ให้อัตโนมัติ",
      "มีตารางพรีวิวข้อมูลและคัดกรองรายการก่อนกดยืนยันบันทึกจริง",
      "บันทึกประวัติการนำเข้าไฟล์ย้อนหลัง พร้อมชื่อผู้ดำเนินการและเวลาที่บันทึก",
    ],
    tips: [
      "หากต้องการปรับเปลี่ยนตัวเลขแผนเฉพาะบางไลน์อย่างรวดเร็ว สามารถสลับไปที่แท็บ 'กรอก/แก้ไข Daily Plan (Manual)' เพื่อค้นหาไลน์และแก้ไขตัวเลขรายวันได้ทันที โดยไม่จำเป็นต้องอัปโหลดไฟล์ Excel ใหม่ทั้งชุด",
      "ก่อนกดยืนยันบันทึกข้อมูล ให้ตรวจสอบจำนวนรายการที่ระบบตรวจพบในปุ่มบันทึก เพื่อความถูกต้องครบถ้วน",
    ],
  },
];