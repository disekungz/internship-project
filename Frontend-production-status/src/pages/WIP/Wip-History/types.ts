export type ChartRow = {
    date: string;
    label: string;
    total: number;
    target?: number | null;
    [procKey: string]: any;
};
