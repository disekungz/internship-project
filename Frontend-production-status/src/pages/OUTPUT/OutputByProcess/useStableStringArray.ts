import { useMemo } from "react";

// คืน array เดิมถ้าสมาชิกเหมือนเดิมทุกตัวตามลำดับ — ข้อมูลโหลดใหม่ (auto refresh) หรือคำนวณซ้ำแต่รายการไม่เปลี่ยน
// effect ที่ผูกกับ array นี้ (เช่น กราฟรีเซ็ตตัวกรอง Search Process/Line ที่ผู้ใช้เลือกไว้) จึงไม่ทำงานซ้ำโดยไม่จำเป็น
export function useStableStringArray(value: string[]): string[] {
  const key = value.join("\u0000");
  // คำนวณใหม่เฉพาะเมื่อรายการเปลี่ยน (key) — value ของรอบนั้นคือรายการล่าสุดอยู่แล้ว
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => value, [key]);
}
