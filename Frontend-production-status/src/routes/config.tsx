import React from "react";
import {
  LayoutDashboard,
  Cpu,
  Package,
  Activity,
  Factory,
  History,
  Layers,
  FileSpreadsheet,
  Users,
  Scale,
  BarChart3,
  ClipboardCheck,
  UserPlus,
} from "lucide-react";

// 🟧 Internal ICONS
import instruction from "@/assets/icon/menuDrawer/instruction/instruction.png";

// =========================================
// 🧭 PAGE IMPORTS (Lazy Loading)
// =========================================
const SmartDashboard = React.lazy(() => import('@/pages/OUTPUT/SmartDashboard/Page'));
const OutputByProcess = React.lazy(() => import("@/pages/OUTPUT/OutputByProcess/Page"));
const OutputByProductName = React.lazy(() => import("@/pages/OUTPUT/OutputByProductName/Page"));
const ProcessOutputDetail = React.lazy(() => import("@/pages/Productivity/ProcessOutputDetail/Page"));
const ProductivitySmartReport = React.lazy(() => import("@/pages/Productivity/ProductivitySmartReport/Page"));
const WipOverall = React.lazy(() => import("@/pages/WIP/Wip-Overall/gwip"));
const WipHistory = React.lazy(() => import("@/pages/WIP/Wip-History/hwip"));
const Manpower = React.lazy(() => import("@/pages/Manpower/Manpower"));
const ManpowerRatio = React.lazy(() => import("@/pages/ManpowerRatio/ManpowerRatio"));
const ManpowerRatioDaily = React.lazy(() => import("@/pages/ManpowerRatioDaily/ManpowerRatioDaily"));
const P1ManpowerStatus = React.lazy(() => import("@/pages/P1ManpowerStatus/P1ManpowerStatus"));
const RecruitResign = React.lazy(() => import("@/pages/RecruitResign/RecruitResign"));
// =========================================
// ⚙️ BASE CONFIG
// =========================================
export const BASE = "/production-status";

export type AppRoute = {
  path: string; // เส้นทางสำหรับหน้าที่จะไป
  element: React.ReactNode; // code หลักของหน้า
  label?: string; // สำหรับไว้สร้าง label
  Title?: string; // สำหรับไว้สร้าง Title
  isDefault?: boolean; // true กรณีต้องการให้เป็น page หลัก
  icon: any; // ไม่ต้องการแสดงส่ง null
  labelClassName?: string; // สำหรับปรับแต่ง class ของ label
};

// =========================================
// 🟦 DASHBOARD ROUTES
// =========================================
export const routes: AppRoute[] = [
  {
    path: `${BASE}/dashboard/output/smart-dashboard`,
    element: <SmartDashboard />,
    label: "SMART Dashboard",
    Title: "SMART Dashboard",
    isDefault: true,
    icon: LayoutDashboard,
  },
  {
    path: `${BASE}/dashboard/output/output-by-productname`,
    element: <OutputByProductName />,
    label: "OUTPUT BY PRODUCT",
    Title: "OUTPUT BY PRODUCT",
    icon: Package,
    labelClassName: "text-[10px]",
  },
  {
    path: `${BASE}/dashboard/output/output-by-process`,
    element: <OutputByProcess />,
    label: "OUTPUT BY PROCESS",
    Title: "OUTPUT BY PROCESS",
    icon: Cpu,
  },
];

export const routes_wip: AppRoute[] = [
  {
    path: `${BASE}/dashboard/wip/overall`,
    element: <WipOverall />,
    label: "WIP Overall",
    Title: "WIP Overall",
    icon: Factory,
  },
  {
    path: `${BASE}/dashboard/wip/history`,
    element: <WipHistory />,
    label: "WIP History",
    Title: "WIP History",
    icon: History,
  },
];

// =========================================
// 🟩 GENERAL ROUTES
// =========================================
export const routes_man: AppRoute[] = [
  {
    path: `${BASE}/dashboard/Manpower/Manpower`,
    element: <Manpower />,
    label: "Manpower",
    Title: "Manpower",
    icon: Users,
  },
  {
    path: `${BASE}/dashboard/Manpower/ManpowerRatio`,
    element: <ManpowerRatio />,
    label: "Manpower Ratio",
    Title: "Manpower Ratio",
    icon: Scale,
  },
  {
    path: `${BASE}/dashboard/Manpower/ManpowerRatioDaily`,
    element: <ManpowerRatioDaily />,
    label: "Manpower Ratio Daily",
    Title: "Manpower Ratio Daily",
    icon: BarChart3,
  },
  {
    path: `${BASE}/dashboard/Manpower/P1ManpowerStatus`,
    element: <P1ManpowerStatus />,
    label: "P1 Manpower Status",
    Title: "P1 Manpower Status",
    icon: ClipboardCheck,
  },
  {
    path: `${BASE}/dashboard/Manpower/RecruitResign`,
    element: <RecruitResign />,
    label: "Recruit & Resign",
    Title: "Recruit & Resign",
    icon: UserPlus,
  },
];

// =========================================
// 🟧 PRODUCTION ROUTES
// =========================================
export const routes_productivity: AppRoute[] = [
  {
    path: `${BASE}/productivity/productivity-smart-report`,
    element: <ProductivitySmartReport />,
    label: "Productivity Smart Report",
    Title: "Productivity Smart Report",
    icon: FileSpreadsheet,
  },
];

export const routes_productivity_hidden: AppRoute[] = [
  {
    path: `${BASE}/productivity/productivity-output`,
    element: <ProcessOutputDetail />,
    label: "Productivity Output",
    Title: "Productivity Output",
    icon: Layers,
  },
];

export const routes_prd: AppRoute[] = [];

export const routes_flat: AppRoute[] = [];

export const routes_External: AppRoute[] = [
  {
    path: `http://10.17.66.242/Smart-Upload/dashboardhub`,
    element: <></>,
    label: "Instruction",
    Title: "Instruction",
    icon: instruction,
  },
];

export const allRoutes: AppRoute[] = [
  ...routes,
  ...routes_wip,
  ...routes_man,
  ...routes_productivity,
  ...routes_productivity_hidden,
  ...routes_prd,
  ...routes_flat,
];
