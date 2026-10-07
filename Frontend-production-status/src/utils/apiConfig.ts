/**
 * Utility function to dynamically resolve Backend API Base URL.
 * Automatically adapts when shared across LAN via IP address (e.g. 10.17.x.x),
 * hosted under IIS subpath (/api_p1/production_status), or running locally via dev server.
 */
export const getApiBaseUrl = (): string => {
  // 1. If VITE_API_BASE_URL is provided (in DEV or PROD), use it with highest priority
  const envUrl = import.meta.env.VITE_API_BASE_URL;
  if (envUrl && typeof envUrl === "string" && envUrl.trim() !== "") {
    return envUrl.trim().replace(/\/$/, "");
  }

  // 2. If running in local Vite development server without VITE_API_BASE_URL, use local backend
  if (import.meta.env.DEV) {
    const protocol = typeof window !== "undefined" ? window.location.protocol : "http:";
    const hostname = typeof window !== "undefined" ? window.location.hostname : "localhost";
    const port = import.meta.env.VITE_API_PORT || "8080";
    return `${protocol}//${hostname}:${port}/api`;
  }

  const protocol = typeof window !== "undefined" ? window.location.protocol : "http:";
  const hostname = typeof window !== "undefined" ? window.location.hostname : "localhost";
  const port = import.meta.env.VITE_API_PORT || "8080";
  const pathname = typeof window !== "undefined" ? window.location.pathname : "";

  // 1. If running under IIS subpath in production deployment
  if (pathname.includes("/api_p1/production_status")) {
    return `${protocol}//${hostname}:${window.location.port || port}/api_p1/production_status`;
  }

  // 2. Dynamic resolution for local dev & LAN IP sharing
  return `${protocol}//${hostname}:${port}/api`;
};

export const API_BASE_URL = getApiBaseUrl();

export const fetchCustomLineNames = async (): Promise<Record<string, string>> => {
  try {
    const res = await fetch(`${getApiBaseUrl()}/productivity/settings/custom-line-names`);
    if (!res.ok) return {};
    const data = await res.json();
    return data.success && data.data ? data.data : {};
  } catch (e) {
    console.error("Failed to fetch custom line names:", e);
    return {};
  }
};

export const saveCustomLineNames = async (customNames: Record<string, string>): Promise<boolean> => {
  try {
    const res = await fetch(`${getApiBaseUrl()}/productivity/settings/custom-line-names`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customNames }),
    });
    const data = await res.json();
    return data.success === true;
  } catch (e) {
    console.error("Failed to save custom line names:", e);
    return false;
  }
};

export const fetchCustomLineOrder = async (): Promise<string[]> => {
  try {
    const res = await fetch(`${getApiBaseUrl()}/productivity/settings/custom-line-order`);
    if (!res.ok) {
      const saved = localStorage.getItem("productivity_custom_line_order");
      return saved ? JSON.parse(saved) : [];
    }
    const data = await res.json();
    if (data.success && Array.isArray(data.data) && data.data.length > 0) {
      return data.data;
    }
    const saved = localStorage.getItem("productivity_custom_line_order");
    return saved ? JSON.parse(saved) : [];
  } catch (e) {
    try {
      const saved = localStorage.getItem("productivity_custom_line_order");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  }
};

export const saveCustomLineOrder = async (order: string[]): Promise<boolean> => {
  try {
    try {
      localStorage.setItem("productivity_custom_line_order", JSON.stringify(order));
      window.dispatchEvent(new Event("line-order-updated"));
    } catch (e) {}

    const res = await fetch(`${getApiBaseUrl()}/productivity/settings/custom-line-order`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order }),
    });
    const data = await res.json();
    return data.success === true;
  } catch (e) {
    console.error("Failed to save custom line order:", e);
    return false;
  }
};

export const fetchTableVisibility = async (): Promise<string[]> => {
  try {
    const res = await fetch(`${getApiBaseUrl()}/productivity/settings/table-visibility`);
    if (!res.ok) {
      const saved = localStorage.getItem("pdt_hidden_tables");
      return saved ? JSON.parse(saved) : ["LINE S_IND"];
    }
    const data = await res.json();
    if (data.success && Array.isArray(data.data) && data.data.length > 0) {
      try {
        localStorage.setItem("pdt_hidden_tables", JSON.stringify(data.data));
      } catch (e) {}
      return data.data;
    }
    const saved = localStorage.getItem("pdt_hidden_tables");
    return saved ? JSON.parse(saved) : ["LINE S_IND"];
  } catch (e) {
    try {
      const saved = localStorage.getItem("pdt_hidden_tables");
      return saved ? JSON.parse(saved) : ["LINE S_IND"];
    } catch {
      return ["LINE S_IND"];
    }
  }
};

export const saveTableVisibility = async (hiddenTables: string[]): Promise<boolean> => {
  try {
    try {
      localStorage.setItem("pdt_hidden_tables", JSON.stringify(hiddenTables));
      window.dispatchEvent(new CustomEvent("table-visibility-updated", { detail: hiddenTables }));
    } catch (e) {}

    const res = await fetch(`${getApiBaseUrl()}/productivity/settings/table-visibility`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hiddenTables }),
    });
    const data = await res.json();
    return data.success === true;
  } catch (e) {
    console.error("Failed to save table visibility:", e);
    return false;
  }
};

export interface DynamicLineDefinition {
  id: string;
  line_name: string;
  display_name: string;
  factory: string;
  output_sources: string[];
  cost_center_sources: string[];
  sub_line_sources: string[];
  show_plan_row?: boolean;
  show_target_row?: boolean;
  show_ot_rows?: boolean;
  show_leave_rows?: boolean;
  units?: string[];
  display_order?: number;
  is_active?: boolean;
  updated_at?: string;
}

export const fetchDynamicLines = async (): Promise<DynamicLineDefinition[]> => {
  try {
    const res = await fetch(`${getApiBaseUrl()}/productivity/settings/dynamic-lines`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.success && Array.isArray(data.data) ? data.data : [];
  } catch (e) {
    console.error("Failed to fetch dynamic lines:", e);
    return [];
  }
};

export const saveDynamicLine = async (lineDef: Partial<DynamicLineDefinition>): Promise<DynamicLineDefinition | null> => {
  try {
    const res = await fetch(`${getApiBaseUrl()}/productivity/settings/dynamic-lines`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(lineDef),
    });
    const data = await res.json();
    return data.success && data.data ? data.data : null;
  } catch (e) {
    console.error("Failed to save dynamic line:", e);
    return null;
  }
};

export const deleteDynamicLine = async (id: string): Promise<boolean> => {
  try {
    const res = await fetch(`${getApiBaseUrl()}/productivity/settings/dynamic-lines/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    const data = await res.json();
    return data.success === true;
  } catch (e) {
    console.error("Failed to delete dynamic line:", e);
    return false;
  }
};

export interface MatrixTargetRecord {
  line: string;
  date: string;
  pcs_prod_target?: number;
  sht_prod_target?: number;
}

export const fetchMatrixTargets = async (startDate: string, endDate: string, line?: string): Promise<MatrixTargetRecord[]> => {
  try {
    const baseUrl = getApiBaseUrl();
    let url = `${baseUrl}/productivity/matrix-targets?startDate=${startDate}&endDate=${endDate}`;
    if (line) url += `&line=${encodeURIComponent(line)}`;
    const res = await fetch(url);
    if (!res.ok) return [];
    return await res.json();
  } catch (e) {
    console.error("Failed to fetch matrix targets:", e);
    return [];
  }
};

export const saveMatrixTargets = async (records: MatrixTargetRecord[], monthLabel?: string): Promise<{ success: boolean; count: number }> => {
  const baseUrl = getApiBaseUrl();
  const res = await fetch(`${baseUrl}/productivity/save-matrix-targets`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ records, monthLabel })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.details || err.error || "Failed to save matrix targets");
  }
  return await res.json();
};
