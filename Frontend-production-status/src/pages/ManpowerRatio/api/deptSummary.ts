import { API_BASE_URL } from '../../Manpower/constants';
export const DEPT_SUMMARY_ENDPOINT = `${API_BASE_URL}/mh/dept_summary`;
export async function fetchDeptSummary(month: string, signal?: AbortSignal, refresh: boolean = false) {
  const refreshParam = refresh ? '&refresh=1' : '';
  const response = await fetch(`${DEPT_SUMMARY_ENDPOINT}?month=${encodeURIComponent(month)}${refreshParam}`, { signal, cache: 'no-store' });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

export async function updateSharedTargets(targets: { view?: string; month?: string; leave?: number; ot?: number; otDaily?: number }) {
  try {
    await fetch(`${DEPT_SUMMARY_ENDPOINT}/targets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(targets),
    });
  } catch {
    /* ละเว้นข้อผิดพลาดทางเครือข่าย */
  }
}

export interface CustomTargetRecord {
  id?: number;
  month: string;
  date_from: string;
  date_to: string;
  target_type: 'leave' | 'ot_acc' | 'ot_daily';
  chart_key?: string;
  target_value: number;
  note?: string;
}

export async function fetchCustomTargets(month: string): Promise<CustomTargetRecord[]> {
  try {
    const res = await fetch(`${DEPT_SUMMARY_ENDPOINT}/targets/custom?month=${encodeURIComponent(month)}`);
    if (!res.ok) return [];
    const json = await res.json();
    return json.data || [];
  } catch {
    return [];
  }
}

export async function saveCustomTarget(target: CustomTargetRecord): Promise<{ success: boolean; data?: any }> {
  try {
    const res = await fetch(`${DEPT_SUMMARY_ENDPOINT}/targets/custom`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(target),
    });
    if (!res.ok) return { success: false };
    const json = await res.json();
    return { success: Boolean(json.success), data: json.data };
  } catch {
    return { success: false };
  }
}

export async function deleteCustomTarget(id: number): Promise<{ success: boolean }> {
  try {
    const res = await fetch(`${DEPT_SUMMARY_ENDPOINT}/targets/custom/${id}`, {
      method: 'DELETE',
    });
    return { success: res.ok };
  } catch {
    return { success: false };
  }
}


