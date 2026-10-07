/**
 * โมดูล Utility สำหรับระบบ Manpower
 * - ฟังก์ชันแปลงค่าวันที่และเวลาจากไฟล์ Excel เป็นฟอร์แมต ISO
 * - ฟังก์ชันตรวจสอบหัวตารางภาษาไทยของไฟล์ Excel การลงเวลา
 */
import * as XLSX from 'xlsx';

/**
 * แปลงค่าวันที่/เวลาจากเซลล์ Excel (รองรับ Date Object, Serial Number, หรือ String) เป็นรูปแบบ ISO String (YYYY-MM-DDTHH:mm:ss)
 */
export const excelValueToIso = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const pad = (n: number) => String(n).padStart(2, '0');
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}T${pad(value.getHours())}:${pad(value.getMinutes())}:${pad(value.getSeconds())}`;
  }
  if (typeof value === 'number') {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (!parsed) return null;
    return `${parsed.y}-${pad(parsed.m)}-${pad(parsed.d)}T${pad(parsed.H || 0)}:${pad(parsed.M || 0)}:${pad(Math.floor(parsed.S || 0))}`;
  }
  const str = String(value).trim();
  const match = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[T\s](\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (match) {
    const date = `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`;
    const time = match[4] ? `T${match[4].padStart(2, '0')}:${match[5]}:${match[6] || '00'}` : 'T00:00:00';
    return `${date}${time}`;
  }
  const parsed = new Date(str);
  if (Number.isNaN(parsed.getTime())) return null;
  return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}T${pad(parsed.getHours())}:${pad(parsed.getMinutes())}:${pad(parsed.getSeconds())}`;
};

/**
 * ดึงเฉพาะส่วนของวันที่ให้อยู่ในฟอร์แมต YYYY-MM-DD จากค่าใน Excel
 */
export const excelDateKey = (value) => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
  if (typeof value === 'number') {
    const parsed = XLSX.SSF.parse_date_code(value);
    return parsed ? `${parsed.y}-${String(parsed.m).padStart(2, '0')}-${String(parsed.d).padStart(2, '0')}` : null;
  }
  const match = String(value || '').trim().match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  return match ? `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}` : null;
};

/**
 * รวมค่าวันที่และเวลาที่แยกคอลัมน์กันใน Excel เข้าด้วยกันเป็น ISO DateTime String
 */
export const excelDateTime = (dateValue, timeValue) => {
  const date = excelDateKey(dateValue);
  if (!date) return null;
  const timeMatch = String(timeValue || '').trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  return timeMatch ? `${date}T${timeMatch[1].padStart(2, '0')}:${timeMatch[2]}:${timeMatch[3] || '00'}` : null;
};

/**
 * ตรวจสอบว่าแถวใน Excel เป็นไฟล์แม่แบบลงเวลาภาษาไทยหรือไม่
 */
export const isThaiAttendanceRow = (row) => 'รหัสพนักงาน*' in row && 'วันที่มีผล*' in row;
