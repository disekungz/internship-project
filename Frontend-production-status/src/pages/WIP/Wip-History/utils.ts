
/**
 * โมดูลฟังก์ชันช่วยเหลือ (Utility Functions) สำหรับหน้า WIP History
 */

/**
 * สุ่มสร้างชุดสี HSL ที่มีความแตกต่างกันอย่างชัดเจนตามจำนวนรายการ
 * @param index ลำดับที่ของไอเทม
 * @param total จำนวนไอเทมทั้งหมด
 */
export function generateDistinctColor(index: number, total: number) {
    const hue = (index / Math.max(1, total)) * 360;
    const lightness = index % 2 === 0 ? 52 : 62;
    const saturation = 78;
    return `hsl(${hue.toFixed(1)}, ${saturation}%, ${lightness}%)`;
}

/**
 * ปรับแต่งและตัดรูปแบบวันที่ให้เหลือเฉพาะส่วน YYYY-MM-DD
 */
export function cleanAndNormalizeDate(dateInput: any): string {
    if (!dateInput) return "";
    const str = String(dateInput).trim();
    if (!str) return "";
    if (str.includes("T")) {
        return str.split("T")[0];
    }
    return str;
}

/**
 * จัดรูปแบบวันที่ ISO (YYYY-MM-DD) ให้อยู่ในรูปแบบวันที่ DD/MM/YYYY
 */
export function formatThaiDate(isoDate: string) {
    const d = new Date(isoDate);
    if (isNaN(d.getTime())) return isoDate;
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    return `${dd}/${mm}/${d.getFullYear()}`;
}

/**
 * คำนวณจำแนกกลุ่มกระบวนการผลิตหลัก (SMT หรือ E-FPC)
 * - หากตัวอักษรที่ 4 ของชื่อ Product เป็น 'Z' และชื่อ Process ขึ้นต้นด้วย 'M' -> SMT
 * - กรณีอื่นๆ -> E-FPC
 */
export function getProcessGroup(procName: string, prodName?: string): string {
    if (!procName) return "E-FPC";
    
    const upperProc = procName.toUpperCase().trim();
    const upperProd = (prodName || "").toUpperCase().trim();
    const processStart = upperProc.charAt(0);
    const productChar4 = upperProd.length >= 4 ? upperProd.charAt(3) : "";

    if (productChar4 === "Z" && processStart === "M") {
        return "SMT";
    }
    return "E-FPC";
}

/**
 * คำนวณจำแนกกลุ่มประเภท WIP (WIP Storage หรือ WIP Production)
 * - ถ้าเป็นกระบวนการ FFPC หรือ MFPC -> WIP Storage
 * - กรณีอื่นๆ -> WIP Production
 */
export function getWipGroup(procName: string): string {
    if (!procName) return "WIP Production";
    const upperProc = procName.toUpperCase().trim();
    if (upperProc === "FFPC" || upperProc === "MFPC") {
        return "WIP Storage";
    }
    
    return "WIP Production";
}

