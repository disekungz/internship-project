export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "";

export const API_REFRESH_INTERVAL =
  10 * 1000;

export const API_TASKS_URL =
  `${API_BASE_URL}/wip/wip_tasks`;