/**
 * Hook: useManhourServerEvents
 * จัดการเชื่อมต่อกับ Server-Sent Events (SSE) สำหรับรับการแจ้งเตือน Real-time เมื่อมีข้อมูลการลงเวลาเปลี่ยนแปลง
 * - บันทึกวันที่ที่เปลี่ยนแปลงลง pendingDatesRef เพื่อดึงข้อมูลเฉพาะวันที่เปลี่ยน
 * - ทริกเกอร์ให้ Component ทำการรีเฟรชข้อมูลผ่าน requestRefresh
 */
import { useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';

type Options = {
  endpoint: string;
  pendingDatesRef: MutableRefObject<string[]>;
  requestRefresh: Dispatch<SetStateAction<number>>;
};

export default function useManhourServerEvents({ endpoint, pendingDatesRef, requestRefresh }: Options) {
  useEffect(() => {
    // เชื่อมต่อ EventSource กับ Endpoint /events ของ Backend
    const events = new EventSource(`${endpoint}/events`);
    
    // จัดการ Event 'change' เมื่อเซิร์ฟเวอร์ส่งการอัปเดตข้อมูลมา
    const refreshFromServer = (event: MessageEvent) => {
      try {
        const payload = JSON.parse(event.data || '{}');
        const dates = Array.isArray(payload?.dates)
          ? payload.dates.filter((date: unknown) => /^\d{4}-\d{2}-\d{2}$/.test(String(date)))
          : [];
        pendingDatesRef.current = [...new Set([...pendingDatesRef.current, ...dates])];
      } finally {
        requestRefresh(token => token + 1);
      }
    };
    
    events.addEventListener('change', refreshFromServer);
    return () => events.close();
  }, [endpoint, pendingDatesRef, requestRefresh]);
}
