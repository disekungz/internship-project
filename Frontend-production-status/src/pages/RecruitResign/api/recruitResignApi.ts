import { API_BASE_URL } from "@/pages/Manpower/constants";
import { RecruitResignResponse, SaveRecruitResignPayload } from "../types";

export const RECRUIT_RESIGN_ENDPOINT = `${API_BASE_URL}/mh/recruit_resign`;

export async function fetchRecruitResign(month: string, group: string): Promise<RecruitResignResponse> {
  const res = await fetch(`${RECRUIT_RESIGN_ENDPOINT}?month=${encodeURIComponent(month)}&group=${encodeURIComponent(group)}&refresh=1`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function saveRecruitResignEntries(payload: SaveRecruitResignPayload): Promise<{ ok: boolean; savedCount?: number; error?: string }> {
  const res = await fetch(`${RECRUIT_RESIGN_ENDPOINT}/save`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function saveSingleRecruitResignEntry(entry: {
  month: string;
  group: string;
  day: number;
  recruit: number;
  resign: number;
  accRecruit?: number;
}): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(`${RECRUIT_RESIGN_ENDPOINT}/single`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(entry),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
