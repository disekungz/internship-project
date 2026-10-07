import { API_BASE_URL } from "../../Manpower/constants";

export const DAILY_MATRIX_ENDPOINT = `${API_BASE_URL}/mh/dept_summary/daily_matrix`;

export async function fetchDailyMatrix(date: string, signal?: AbortSignal) {
  const response = await fetch(`${DAILY_MATRIX_ENDPOINT}?date=${encodeURIComponent(date)}`, {
    signal,
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}
