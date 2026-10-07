/**
 * ค่าคงที่สำหรับระบบ Manpower (Constants)
 * - ส่งออก Endpoint URL ทั้งหมดที่เกี่ยวข้องกับการดึงข้อมูลและการคำนวณ Man-Hour
 * - กำหนดคอลัมน์มาตรฐานสำหรับนำเข้าข้อมูลการลงเวลาทำงาน (Import Columns)
 */
export {
  API_BASE_URL,
  MANHOUR_API_ENDPOINT,
  MANHOUR_VERSION_ENDPOINT,
  MANHOUR_MONTHS_ENDPOINT,
  MANHOUR_SUMMARY_ENDPOINT,
  MANHOUR_CALENDAR_ENDPOINT,
  MANHOUR_HELP_SUMMARY_ENDPOINT,
  MANHOUR_IMPORT_ENDPOINT,
  MANHOUR_VDS_FORMULA_ENDPOINT,
  MANHOUR_COST_CENTER_OPTIONS_ENDPOINT,
  MANHOUR_EMPLOYEES_SEARCH_ENDPOINT,
  MANHOUR_CUSTOM_MAPPINGS_ENDPOINT,
} from "./api/config";

// รายชื่อคอลัมน์มาตรฐานที่จำเป็นสำหรับการนำเข้าข้อมูลการลงเวลา (Excel Import)
export const MANHOUR_IMPORT_COLUMNS = [
  "dlh_employee_id",
  "dlh_effective_date_time",
  "work_day_status",
  "work_status",
  "scan_time_in",
  "scan_time_out",
];
