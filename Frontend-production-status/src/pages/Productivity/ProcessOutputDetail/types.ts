export const DEFAULT_LINE_GROUPS = [
  {
    name: "LINE A",
    processes: ["FIN", "AT-FIN"],
    mcLines: ["P-FIN-A1", "P-FIN-A2", "P-FIN-A3"],
  },
  {
    name: "LINE B_NON",
    processes: ["FIN"],
    mcLines: ["P-FIN-B1", "P-FIN-B2"],
  },
  {
    name: "LINE B_GEN",
    processes: ["FIN"],
    mcLines: ["P-FIN-B3", "P-FIN-B4", "P-FIN-B5", "P-FIN-B6", "P-FIN-B7", "P-FIN-B8"],
  },
  {
    name: "LINE C",
    processes: ["FIN"],
    mcLines: ["P-FIN-C1", "P-FIN-C2", "P-FIN-C3", "P-FIN-C4", "P-FIN-C5", "P-FIN-C6", "P-FIN-C7", "P-FIN-C8", "P-FIN-C9"],
  },
  {
    name: "LINE D",
    processes: ["FIN"],
    mcLines: ["P-FIN-D1", "P-FIN-D2", "P-FIN-D3", "P-FIN-D4", "P-FIN-D5", "P-FIN-AUTO"],
  },
  {
    name: "LINE BLK",
    processes: ["FPIC", "FPIC2", "FPIC3", "FPIC4", "FBLK"],
  },
  {
    name: "LAM_FPC",
    processes: ["FADL", "FADL2", "FSTL", "FSTA", "FLAB", "FMDL"],
    mcLines: ["P-LAM-01", "P-LAM-02", "P-LAM-03", "P-LAM-04", "P-LAM-05", "P-LAM-06", "P-LAM-07"],
  },
  {
    name: "LAM_NIDEC",
    processes: ["FADL"],
    mcLines: ["P-LAM-08"],
  },
  {
    name: "LINE VAC",
    processes: ["FVAC", "FVAC2", "FQCR"],
  },
  {
    name: "LINE HPS",
    processes: ["FSTH", "FSTH2", "FSTH3"],
    mcLines: ["P-STH-01", "P-STH-02", "P-STH-03", "P-STH-04", "P-STH-05", "P-STH-06", "P-STH-07", "P-STH-08"],
  },
  {
    name: 'LINE NPM',
    processes: ['FIN', 'AT-FIN'],
    mcLines: ['P-FINFA-01'],
  },
  {
    name: "AVI_INS",
    processes: ["FINA", "FINA2"],
  },
  {
    name: "AT_VAC",
    processes: ["AT-FVAC", "AT-FQCR"],
  },
  {
    name: "A_LAM",
    processes: ["AT-FADL", "AT-FADL2", "AT-FSTL", "AT-FSTA", "AT-FLAB"],
  },
  {
    name: "A_TF2",
    processes: ["QTPK"],
  },
  {
    name: "MDS",
    processes: ["DFIN"],
  },
  {
    name: "LINE OST",
    processes: ["FOST", "FOST2", "FOST3"],
  },
  {
    name: "QA_FPC AUTO",
    processes: ["QA"],
    prefixes: ["ICI", "ICIZ", "KIT", "KITZ", "VLO", "VLOZ"],
    factory: "QA",
  },
  {
    name: "QA_FPC GEN",
    processes: ["QA"],
    excludePrefixes: ["ICI", "ICIZ", "KIT", "KITZ", "VLO", "VLOZ"],
    factory: "QA",
  },
  {
    name: "QA_SMT AUTO",
    processes: ["MQA"],
    prefixes: ["KITZ", "VLOZ"],
    factory: "QA",
  },
  {
    name: "QA_SMT GEN",
    processes: ["MQA"],
    excludePrefixes: ["KITZ", "VLOZ"],
    factory: "QA",
  },
] as const;

export type LineGroup = {
  name: string;
  processes: string[];
  mcLines?: string[];
  prefixes?: string[];
  excludePrefixes?: string[];
  factory?: "SMT" | "FPC" | "QA" | string;
};

export type LineGroupFilter = string[] | "ALL";
export type FactoryFilter = "ALL" | "SMT" | "FPC" | "QA" | string;
export type OutputUnit = "lot" | "sht" | "piece";

export const OUTPUT_UNITS: Array<{ key: OutputUnit; label: string; shortLabel: string }> = [
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
  facUnitCode?: string;
};

export type UnitTotals = {
  lotQty: number;
  shtQty: number;
  pieceQty: number;
};
