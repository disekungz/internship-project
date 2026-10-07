export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  (typeof window !== "undefined"
    ? `${window.location.protocol}//${window.location.hostname || "localhost"}:8085/api_p1/production_status`
    : "http://localhost:8085/api_p1/production_status");

// 📊 1. Endpoint หลักสำหรับดึงข้อมูลกำลังคน P1 (Daily Breakdown Matrix & Stacked EChart)
export const P1_STATUS_API_ENDPOINT =
  `${API_BASE_URL}/mh/p1_status`;

// 🎯 2. Endpoint สำหรับดึงและบันทึกเป้าหมายรายเดือน (Persistent Monthly Target)
export const P1_TARGET_API_ENDPOINT =
  `${P1_STATUS_API_ENDPOINT}/target`;

// 🔄 3. Endpoint สำรอง (Fallback: ข้อมูล Summary และปฏิทินวันทำงาน/วันหยุด)
export const P1_FALLBACK_SUMMARY_ENDPOINT =
  `${API_BASE_URL}/mh/manhour/summary`;

export const P1_FALLBACK_CALENDAR_ENDPOINT =
  `${API_BASE_URL}/mh/manhour/calendar`;
