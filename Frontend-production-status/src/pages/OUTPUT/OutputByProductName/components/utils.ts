export const getCustomerGroup = (productName: string): string => {
  if (!productName) return "Other";
  const prefix = productName.substring(0, 3).toUpperCase();
  switch (prefix) {
    case "CAC": return "ORTUSTECH";
    case "CAD":
    case "CAE":
    case "CAK":
    case "CAO":
    case "CAS":
    case "CAU":
    case "CAW":
    case "CAY":
    case "CAZ": return "CANON";
    case "COP": return "NIDEC COPAL";
    case "FJT": return "FUJITSU";
    case "FNA": return "FUNAI";
    case "HFT": return "HITACHI";
    case "ICI": return "ICHIKO";
    case "JDM":
    case "JDT": return "JAPAN DISPLAY";
    case "KEI": return "SEIKO";
    case "KIT": return "KOITO";
    case "KWD": return "KENWOOD";
    case "MCI":
    case "MAD": return "PANASONIC";
    case "MBL": return "NMB";
    case "MBM":
    case "MBT": return "MINEBEA";
    case "MID":
    case "MIL": return "MITSUBISHI";
    case "MRT": return "MURATA";
    case "NDB":
    case "NDN": return "NIDEC";
    case "NHD": return "NEC";
    case "NKG":
    case "NKN":
    case "NKS": return "NIKON";
    case "NSL": return "NEST";
    case "OPR": return "KYOCERA";
    case "PHL": return "PHILIPS";
    case "PVC":
    case "PVI": return "PIONEER";
    case "QMM": return "SONY";
    case "RGO": return "Z";
    case "SEC": return "SEKONIC";
    case "SES": return "SOMC";
    case "SOA":
    case "SOV":
    case "SOY": return "SONY";
    case "SPO":
    case "SPS": return "EPSON";
    case "SYA": return "HONDA";
    case "SYC":
    case "SYD":
    case "SYG":
    case "SYL":
    case "SYT": return "SONY";
    case "TMR": return "TAMRON";
    case "TOD":
    case "TSO": return "TOSHIBA";
    case "VLO": return "VALEO";
    case "OLY": return "OLYMPUS";
    case "VTN": return "VISTEON";
    case "VLM": return "Valmet";
    default: return "Other";
  }
};

export const getProductProcessType = (productName: string): string => {
  if (!productName || productName.length < 4) return "FPC";
  return productName.charAt(3).toUpperCase() === 'Z' ? "SMT" : "FPC";
};

export const formatDate = (dateStr: string) => {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
};

export const getStartOfMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
};

export const getToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const CHART_COLORS = [
  "#2b5c8f", "#0d9488", "#4f46e5", "#0891b2", "#15803d", "#b91c1c", "#c2410c", "#7c3aed", "#b45309", "#a21caf",
  "#0284c7", "#059669", "#be123c", "#475569", "#6d28d9", "#701a75", "#ca8a04", "#854d0e", "#78350f", "#881337",
  "#1e3a8a", "#064e3b", "#4c1d95", "#115e59", "#be185d", "#a16207", "#4d7c0f", "#1d4ed8", "#5f9ea0", "#008b8b",
  "#cd5c5c", "#b8860b", "#a0522d", "#3cb371", "#9932cc", "#4682b4", "#6a5acd", "#334155", "#1e293b", "#6366f1"
];
