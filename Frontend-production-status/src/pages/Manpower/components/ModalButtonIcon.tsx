/**
 * Component: ModalButtonIcon
 * รวบรวม Path ไอคอน SVG สำหรับปุ่มต่างๆ ภายใน Modal (Close, Save, Delete, Add, Filter, etc.)
 */
const paths = {
  close: "M18 6 6 18M6 6l12 12",
  load: "M12 3v12m0 0 4-4m-4 4-4-4M5 21h14a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2",
  save: "M5 3h12l2 2v16H5zM8 3v6h8V3M8 21v-7h8v7",
  delete: "M3 6h18M8 6V4h8v2m-9 0 1 15h8l1-15M10 11v5m4-5v5",
  add: "M12 5v14M5 12h14",
  apply: "m5 12 4 4L19 6",
  filter: "M4 5h16l-6 7v5l-4 2v-7z",
  reset: "M3 12a9 9 0 1 0 3-6.7M3 4v6h6",
  login: "M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4m-5-4 5-5-5m5 5H3",
  import:
    "M12 3v12m0 0 4-4m-4 4-4-4M5 21h14a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2",
  sortAsc: "M8 17V5m0 0-3 3m3-3 3 3m5-3v12m0 0-3-3m3 3 3-3",
  sortDesc: "M8 5v12m0 0-3-3m3 3 3-3m5 3V5m0 0-3 3m3-3 3 3",
  chevron: "m7 10 5 5 5-5",
};

export default function ModalButtonIcon({
  name,
}: {
  name: keyof typeof paths;
}) {
  return null;
}
