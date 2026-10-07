/**
 * การตั้งค่ากราฟสำหรับระบบ Manpower (Graph Configuration)
 * - กลุ่มข้อมูล (Persons, Hours, Rate %)
 * - ตัวเลือกแกนกราฟ (รายวัน Date, รายสัปดาห์ Week, รายไลน์ Line)
 * - ช่วงสัปดาห์ W1-W5 และตัวเลือกค่าสถิติต่างๆ
 */

// กลุ่มประเภทของกราฟ
export const GRAPH_GROUPS = [
  { key: 'persons', label: 'Persons' }, // จำนวนคน (ลงทะเบียน, มาทำงาน, ขาด/ลา)
  { key: 'hours', label: 'Hours' },     // ชั่วโมงการทำงาน (ชั่วโมงปกติ, OT, รวม, Target)
  { key: 'rate', label: 'Rate %' },     // อัตราส่วนเปอร์เซ็นต์ (OT วันทำงาน, OT วันหยุด)
];

// ตัวเลือกแกนข้อมูลของกราฟ (X-Axis)
export const GRAPH_AXIS_OPTIONS = [
  { key: 'date', label: 'Date' }, // แกนวันที่ 1-31
  { key: 'week', label: 'Week' }, // แกนสัปดาห์ W1-W5
  { key: 'line', label: 'Line' }, // แกนรายชื่อ Line การผลิต
];

// การแบ่งช่วงสัปดาห์ในเดือน (W1 - W5)
export const WEEK_RANGES = [
  { label: 'W1', days: [1, 2, 3, 4, 5, 6, 7] },
  { label: 'W2', days: [8, 9, 10, 11, 12, 13, 14] },
  { label: 'W3', days: [15, 16, 17, 18, 19, 20, 21] },
  { label: 'W4', days: [22, 23, 24, 25, 26, 27, 28] },
  { label: 'W5', days: [29, 30, 31] },
];

// รายการ Metric สำหรับพล็อตกราฟ พร้อมสีและหน่วยวัด
export const GRAPH_OPTIONS = [
  { key: 'register', group: 'persons', label: 'OP Register', rowKey: 'r1', color: '#2563eb', unit: 'Persons', chart: 'bar' },
  { key: 'workingHead', group: 'persons', label: 'Working', rowKey: 'r7', color: '#0ea5e9', unit: 'Persons', chart: 'bar' },
  { key: 'absent', group: 'persons', label: 'Leave', rowKey: 'r20', color: '#f43f5e', unit: 'Persons', chart: 'bar' },
  { key: 'normalHour', group: 'hours', label: 'Normal Man Hour', rowKey: 'r14', color: '#2563eb', unit: 'Hr.', chart: 'bar' },
  { key: 'otHour', group: 'hours', label: 'OT Man Hour', rowKey: 'r15', color: '#f59e0b', unit: 'Hr.', chart: 'bar' },
  { key: 'totalHour', group: 'hours', label: 'Total Man Hour', rowKey: 'r16', color: '#14b8a6', unit: 'Hr.', chart: 'bar' },
  { key: 'normalTargetHour', group: 'hours', label: 'Normal Target Hour', rowKey: 'r17', color: '#6366f1', unit: 'Hr.', chart: 'line' },
  { key: 'otWorkRate', group: 'rate', label: 'OT working day rate', rowKey: 'r22', color: '#f59e0b', unit: '%', chart: 'line' },
  { key: 'otHolidayRate', group: 'rate', label: 'OT Holiday day rate', rowKey: 'r23', color: '#10b981', unit: '%', chart: 'line' },
];

