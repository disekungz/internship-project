import { DEPARTMENTS, DEPARTMENT_COLORS } from '../constants';

export { DEPARTMENTS, DEPARTMENT_COLORS };

// ✅ เป้าหมาย (ดึงค่าจริงจาก API targets ได้ด้วย)
export const LEAVE_TARGET = 5;
export const OT_TARGET = 65;      // เส้นแดง Target OT (direct.acc.)
export const OT_DAILY_TARGET = 75; // เส้นน้ำเงิน Target OT รายวัน

// ✅ สีเส้น/ส่วนประกอบกราฟตามมาตรฐานรายงาน
export const INDIRECT_COLOR = '#1F3864'; // แท่ง Indirect (น้ำเงินเข้ม)
export const ACC_COLOR = '#C2410C';      // เส้นสะสม Acc. (ส้ม)
export const SUM_COLOR = '#2563EB';      // ตัวเลข SUM / เส้น SUM (น้ำเงิน)
export const TARGET_COLOR = '#DC2626';   // เส้น Target (แดง)
export const OT_DAILY_COLOR = '#1D4ED8'; // เส้น Target OT รายวัน (น้ำเงิน)

// ✅ กลุ่มสนับสนุนสำหรับกราฟ Leave ratio_<group> (MPS/MOU/DC/PER/IND)
//    - แสดงเฉพาะกลุ่มที่มีข้อมูลคน (เช็กจาก supportGroups[g].total.people ในหน้าเว็บ)
export const SUPPORT_LEAVE_GROUPS = ['MPS', 'MOU', 'DC', 'PER', 'IND'] as const;
