/**
 * โมดูลฟังก์ชันช่วยเหลือ (Utility Functions) สำหรับหน้า WIP Overall
 */

/**
 * แปลงวันที่ในรูปแบบภาษาไทย (DD/MM/YYYY หรือ DD/MM/BE) เป็น JavaScript Date Object
 * - แปลงปี พ.ศ. เป็น ค.ศ. อัตโนมัติ (ลบ 543)
 * - คืนค่า null หากรูปแบบวันที่ไม่ถูกต้อง
 */
export const parseThaiDate = (thaiDateStr?: string): Date | null => {
    if (!thaiDateStr || thaiDateStr === '-') return null;
    const parts = thaiDateStr.split('/');
    if (parts.length !== 3) return null;
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    const buddhistYear = parseInt(parts[2], 10);
    if (isNaN(day) || isNaN(month) || isNaN(buddhistYear)) return null;
    const gregorianYear = buddhistYear - 543;
    const d = new Date(gregorianYear, month - 1, day);
    return isNaN(d.getTime()) ? null : d;
};

/**
 * ดึงค่าเวลาสแกนเข้า (Scan In) จาก Object ข้อมูล Task
 * - รองรับชื่อคีย์หลากหลายรูปแบบ เช่น 'Wip_Scan_In', 'wip_scan_in', 'scan_in'
 */
export const getScanInRaw = (task: any): string | undefined => {
    if (!task) return undefined;
    const candidateKeys = ['Wip_Scan_In', 'WIP_SCAN_IN', 'wip_scan_in', 'wipScanIn', 'scan_in', 'SCAN_IN'];
    for (const k of candidateKeys) {
        if (task[k] !== undefined && task[k] !== null && task[k] !== '' && task[k] !== 'null' && task[k] !== '-') {
            return task[k];
        }
    }
    return undefined;
};
