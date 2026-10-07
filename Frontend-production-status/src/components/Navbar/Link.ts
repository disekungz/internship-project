// import รูปภาพ (ใช้การ import แบบที่ถูกต้องใน React/TypeScript)
import Iconsmain from "@/../public/icon/react.svg";
import { routes as routesDynamic, routes_prd } from "@/routes/config"
// การกำหนดประเภท (Type) สำหรับข้อมูล
interface SubPath {
  path: string;
  element: React.ReactNode;
  label?: string;
}

interface Link {
  Title: string;
  Iconsmain: string; // ใช้เป็น string สำหรับเส้นทางของภาพ
  SubPath: SubPath[]; // อ้างอิง SubPath
}

export const Link = () => {
  const Grp1: Link = {
    Title: "DASHBOARD",
    Iconsmain: Iconsmain, // ใช้การ import รูปภาพที่ถูกต้อง
    SubPath: routesDynamic
  };

  const Grp2: Link = {
    Title: "PRODUCTION",
    Iconsmain: Iconsmain,
    SubPath: routes_prd
  };

  return { Grp1, Grp2 };
};
