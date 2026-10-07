// Shared color utility for process charts
// Extracted here so it can be imported by any component without
// breaking Vite Fast Refresh (which requires files to export only
// React components OR only non-component values, not both).

const CHART_COLORS = [
  "#2b5c8f", "#0d9488", "#4f46e5", "#0891b2", "#15803d",
  "#b91c1c", "#c2410c", "#7c3aed", "#b45309", "#a21caf",
  "#0284c7", "#059669", "#be123c", "#475569", "#6d28d9",
  "#701a75", "#ca8a04", "#854d0e", "#78350f", "#881337",
  "#1e3a8a", "#064e3b", "#4c1d95", "#115e59", "#be185d",
  "#a16207", "#4d7c0f", "#1d4ed8", "#5f9ea0", "#008b8b",
  "#cd5c5c", "#b8860b", "#a0522d", "#3cb371", "#9932cc",
  "#4682b4", "#6a5acd", "#334155", "#1e293b", "#6366f1",
];

export const getProcessColor = (processName: string): string => {
  if (processName === "Others" || processName === "Others (อื่นๆ)") return "#94a3b8";
  let hash = 0;
  for (let i = 0; i < processName.length; i++) {
    hash = processName.charCodeAt(i) + ((hash << 5) - hash);
  }
  return CHART_COLORS[Math.abs(hash) % CHART_COLORS.length];
};
