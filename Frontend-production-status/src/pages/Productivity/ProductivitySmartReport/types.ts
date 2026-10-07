export const DEFAULT_LINE_GROUPS = [
  { name: "LINE A", processes: ["FIN", "AT-FIN"], mcLines: ["P-FIN-A1", "P-FIN-A2", "P-FIN-A3"] },
  { name: "LINE B_NON", processes: ["FIN"], mcLines: ["P-FIN-B1", "P-FIN-B2"], prefixes: ["NDN", "NDB", "MBM"] },
  { name: "LINE B_GEN", processes: ["FIN"], mcLines: ["P-FIN-B3", "P-FIN-B4", "P-FIN-B5", "P-FIN-B6", "P-FIN-B7", "P-FIN-B8"] },
  { name: "LINE C", processes: ["FIN"], mcLines: ["P-FIN-C1", "P-FIN-C2", "P-FIN-C3", "P-FIN-C4", "P-FIN-C5", "P-FIN-C6", "P-FIN-C7", "P-FIN-C8", "P-FIN-C9"] },
  { name: "LINE D", processes: ["FIN"], mcLines: ["P-FIN-D1", "P-FIN-D2", "P-FIN-D3", "P-FIN-D4", "P-FIN-D5", "P-FIN-AUTO"] },
  { name: "LINE LAM", processes: ["FADL", "FADL2", "FSTL", "FSTA", "FLAB", "FMDL"], mcLines: ["P-LAM-01", "P-LAM-02", "P-LAM-03", "P-LAM-04", "P-LAM-05", "P-LAM-06", "P-LAM-07"] },
  { name: "LINE VAC", processes: ["FVAC", "FVAC2", "FQCR"] },
  { name: "LINE HPS", processes: ["FSTH", "FSTH2", "FSTH3"], mcLines: ["P-STH-01", "P-STH-02", "P-STH-03", "P-STH-04", "P-STH-05", "P-STH-06", "P-STH-07", "P-STH-08"] },
  { name: "NPM_FPC", processes: ["FIN", "AT-FIN"], mcLines: ["P-FINFA-01"] },
  { name: "SUPPORT TF2", processes: ["FTPK"] },
  { name: "AVI/K2", processes: ["FINA", "FINA2"] },
  { name: "AT_VAC", processes: ["AT-FVAC", "AT-FQCR"] },
  { name: "AT_LAM", processes: ["AT-FADL", "AT-FADL2", "AT-FSTL", "AT-FSTA", "AT-FLAB"] },
  { name: "AT_Front", processes: ["QTPK"] },
  { name: "LINE BLK", processes: ["FPIC", "FPIC2", "FPIC3", "FPIC4", "FBLK"] },
  { name: "LINE OST", processes: ["FOST", "FOST2", "FOST3"] },
  { name: "MDS", processes: ["MDS"], mcLines: ["DFIN"] },
  { name: "OQI_F-AUTO", processes: ["QA"], prefixes: ["ICI", "ICIZ", "KIT", "KITZ", "VLO", "VLOZ"] },
  { name: "OQI_F-GEN", processes: ["QA"], excludePrefixes: ["ICI", "ICIZ", "KIT", "KITZ", "VLO", "VLOZ"] },
  { name: "OQI_S-AUTO", processes: ["MQA"], prefixes: ["KITZ", "VLOZ"] },
  { name: "OQI_S-GEN", processes: ["MQA"], excludePrefixes: ["KITZ", "VLOZ"] },
  { name: "OQI_M", processes: ["DQA"] },
] as const;

export const LINE_GROUP_DISPLAY_NAMES: Record<string, string> = {
  "NPM_FPC": "NPM_FPC",
  "LINE NPM": "NPM_FPC",
  "MPM_FPC": "NPM_FPC",
  "LINE A": "LINE A",
  "AT_FRONT": "AT_Front",
  "AT_Front": "AT_Front",
  "A_TF2": "AT_Front",
  "AT_VAC": "AT_VAC",
  "AT_LAM": "AT_LAM",
  "A_LAM": "AT_LAM",
  "LINE A_FINAL": "LINE A_FINAL",
  "LINE B": "LINE B",
  "LINE B_GEN": "LINE B_GEN",
  "LINE B_NON": "LINE B_NON",
  "LINE C": "LINE C",
  "LINE D": "LINE D",
  "LINE LAM": "LINE LAM",
  "LAM_FPC": "LINE LAM",
  "AVI/K2": "AVI/K2",
  "AVI_INS": "AVI/K2",
  "MDS": "MDS",
  "LINE MAT": "LINE MAT",
  "LINE VAC": "LINE VAC",
  "LINE HPS": "LINE HPS",
  "LINE BLK": "LINE BLK",
  "LINE OST": "LINE OST",
  "MOTA_A": "MOTA_A",
  "MOTA_AUTO": "MOTA_A",
  "LINE MOTA_A": "MOTA_A",
  "MOTA_G": "MOTA_G",
  "MOTA_GEN": "MOTA_G",
  "LINE MOTA_G": "MOTA_G",
  "MOTB": "MOTB",
  "LINE MOTB": "MOTB",
  "MOTD": "MOTD",
  "LINE MOTD": "MOTD",
  "AIX-MOT": "AIX-MOT",
  "ASTP_A": "ASTP_A",
  "LINE ASTP_A": "ASTP_A",
  "ASTP_G": "ASTP_G",
  "LINE ASTP_G": "ASTP_G",
  "MAS": "MAS",
  "LINE MAS": "MAS",
  "REW": "REW",
  "LINE REW": "REW",
  "XRAY": "XRAY",
  "LINE XRAY": "XRAY",
  "MAS & REW": "MAS & REW",
  "LINE MAS & REW": "MAS & REW",
  "AIX-BLK": "AIX-BLK",
  "BLK-2": "BLK-2",
  "LINE BLK-2": "BLK-2",
  "ASY1_A": "ASY1_A",
  "ASY1_AUTO": "ASY1_A",
  "LINE ASY1_A": "ASY1_A",
  "ASY1_G": "ASY1_G",
  "ASY1_GEN": "ASY1_G",
  "LINE ASY1_G": "ASY1_G",
  "ASY2": "ASY2",
  "LINE ASY2": "ASY2",
  "ASY3": "ASY3",
  "LINE ASY3": "ASY3",
  "AIX-ASY": "AIX-ASY",
  "LINE AIX-ASY": "AIX-ASY",
  "AELT": "AELT",
  "LINE AELT": "AELT",
  "SMT_LAM": "SMT_LAM",
  "LINE SMT_LAM": "SMT_LAM",
  "LINE SMT LAM": "SMT_LAM",
  "MD LAM": "MD LAM",
  "LINE MD LAM": "MD LAM",
  "MD_LAM": "MD LAM",
  "ASY SMT": "ASY SMT",
  "QA FPC": "QA FPC",
  "OQI_F-AUTO": "OQI_F-AUTO",
  "QA_FPC_AUTO": "OQI_F-AUTO",
  "OQI_F-GEN": "OQI_F-GEN",
  "QA_FPC_GEN": "OQI_F-GEN",
  "OQI_M": "OQI_M",
  "DQA": "OQI_M",
  "LINE DQA": "OQI_M",
  "QA SMT": "QA SMT",
  "MQA": "QA SMT",
  "OQI_S-AUTO": "OQI_S-AUTO",
  "QA_SMT_AUTO": "OQI_S-AUTO",
  "OQI_S-GEN": "OQI_S-GEN",
  "QA_SMT_GEN": "OQI_S-GEN",
  "MACRO SMT": "Macro SMT",
  "MACRO SMT_F": "Macro SMT_F",
  "MACRO SMT_B": "Macro SMT_B",
  "DIRECT SMT": "Direct SMT",
  "SMT FRONT_DIRECT": "SMT FRONT_DIRECT",
  "SMT BACK_DIRECT": "SMT BACK_DIRECT",
  "MACRO FPC": "Macro FPC",
  "DIRECT FPC": "Direct FPC",
  "MACRO PCN": "Macro PCN",
};

export const getLineGroupDisplayName = (name: string) => {
  return LINE_GROUP_DISPLAY_NAMES[name.toUpperCase()] ?? name;
};

export type LineGroup = {
  name: string;
  processes: string[];
  mcLines?: string[];
  prefixes?: string[];
  excludePrefixes?: string[];
  factory?: "SMT" | "FPC" | "QA" | "INDIRECT" | string;
};

export type LineGroupFilter = string[] | "ALL";
export type FactoryFilter = "ALL" | "SMT" | "FPC" | "QA" | "INDIRECT";
export type OutputUnit = "lot" | "sht" | "piece";

export interface OutputUnitMeta {
  key: OutputUnit;
  label: string;
  shortLabel: string;
}

export const OUTPUT_UNITS: OutputUnitMeta[] = [
  { key: "lot", label: "Lot Output", shortLabel: "Lot" },
  { key: "sht", label: "Sht Output", shortLabel: "Sht" },
  { key: "piece", label: "Piece Output", shortLabel: "Piece" },
];

export type ApiOutputRow = {
  output_date?: string;
  process_name?: string;
  line_group?: string;
  mc_line?: string;
  actual_lot_qty?: number | string;
  actual_sht_qty?: number | string;
  actual_piece_qty?: number | string;
  fac_unit_code?: string;
};

export type LineGroupRow = {
  date: string;
  process: string;
  lineGroup: string;
  mcLine: string;
  lotQty: number;
  shtQty: number;
  pieceQty: number;
  planQty?: number;
  facUnitCode?: string;
};

export type UnitTotals = {
  lotQty: number;
  shtQty: number;
  pieceQty: number;
};

export type Granularity = "yearly" | "quarterly" | "monthly" | "weekly" | "daily";

export type LoanExcludeRecord = {
  id: number;
  employee_id: string;
  employee_name: string;
  department: string;
  destination: string;
  start_date: string | null;
  end_date: string | null;
  is_active: boolean;
  created_at: string;
  created_by: string;
  updated_at?: string | null;
};
