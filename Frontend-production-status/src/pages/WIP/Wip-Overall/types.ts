export interface WipTaskItem {
    id: number;
    text: string;
    process: string;
    qty: number;
    status: string;
    date: string;
    db_date: string;
    factory: string;
    lot_roll_no: string;
    lot: string;
    proc_id: string;
    proc_disp: string;
    lot_status: string;
    input_qty: number;
    wo_fg_qty: number;
    pending_date: string | null;
    pending_reason: string | null;
    pending_remark: string | null;
    update_date: string;
    wip_by_date?: string;
    Wip_Scan_In?: string;
    lead_time?: number;
    group?: string;
    lt_group?: string;
    lot_count?: number;
    customer_group?: string;
}

export interface SearchableSelectProps {
    label: string;
    icon: React.ReactNode;
    options: string[];
    selectedValue: string;
    onSelect: (value: string) => void;
}

export interface MultiSelectProps {
    label: string;
    icon: React.ReactNode;
    options: string[];
    selectedValues: string[];
    onChange: (values: string[]) => void;
}
