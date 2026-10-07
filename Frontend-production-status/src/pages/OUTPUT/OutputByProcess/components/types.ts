export type UnitMode = "Piece" | "Sheet" | "Lot";

export interface ProcessSummary {
  process_name: string;
  sum_pcs: number;
  sum_sht: number;
  sum_lot: number;
  mcline_count: number;
  output_value?: number;
}

export interface Stats {
  total: number;
  activeCount: number;
  topProcess: ProcessSummary | null;
  sheets: number;
  pieces: number;
  lotsCount: number;
  activeProducts: number;
}

