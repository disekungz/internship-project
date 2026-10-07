export interface ProductOutput {
  product_name: string;
  process_name?: string;
  mc_line?: string;
  output_date?: string;
  actual_pcs_qty: number;
  actual_sht_qty: number;
  actual_lot_qty: number;
  output_value?: number;
}

export type UnitMode = "Piece" | "Sheet" | "Lot";

export interface Stats {
  total: number;
  activeProducts: number;
  topProduct: ProductOutput | null;
  customerGroupsCount: number;
}

export interface CustomerGroupStat {
  name: string;
  current: { pcs: number; sht: number; lot: number };
  prev: { pcs: number; sht: number; lot: number };
  changePcs: number;
  changeSht: number;
  changeLot: number;
}
