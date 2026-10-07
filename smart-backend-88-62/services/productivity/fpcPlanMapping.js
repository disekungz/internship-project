/**
 * Configuration mapping for FPC Plan Excel Parser
 * 100% Dynamic Label & Section-Based Matching (Zero Hardcoded Row Indices)
 * Supports all 16 items specified for EFPC Output Monitoring
 */

const os = require('os');
const path = require('path');

const isWindows = os.platform() === 'win32';

// กำหนด Base Path ของ FPC Plan ตาม OS
const FPC_PLAN_BASE_PATH = isWindows
  ? '\\\\10.17.86.37\\output'                  // สำหรับ Local Windows
  : '/app/file_Folder/FPC_PLAN_OUTPUT';      // สำหรับ Docker Container บน Linux

const FPC_PLAN_NETWORK_FOLDER = process.env.FPC_PLAN_FOLDER || FPC_PLAN_BASE_PATH;
const FPC_PLAN_LOCAL_FOLDER = process.env.FPC_PLAN_LOCAL_FOLDER || FPC_PLAN_NETWORK_FOLDER;
const FPC_PLAN_FOLDER = FPC_PLAN_NETWORK_FOLDER;

const FPC_MONTH_MAP = {
  january: '01', jan: '01',
  february: '02', feb: '02',
  march: '03', mar: '03',
  april: '04', apr: '04',
  may: '05',
  june: '06', jun: '06',
  july: '07', jul: '07',
  august: '08', aug: '08',
  september: '09', sept: '09', sep: '09',
  october: '10', oct: '10',
  november: '11', nov: '11',
  december: '12', dec: '12'
};

const isEfpcOutputSheet = (s) => {
  const u = (s || '').toLowerCase().replace(/[-_()]/g, ' ').replace(/\s+/g, ' ');
  return u.includes('e fpc output') || u.includes('efpc output') || u.includes('e fpc') || u.includes('efpc');
};

const isLineBGroupSheet = (s) => {
  const u = (s || '').toLowerCase().replace(/[-_()]/g, ' ').replace(/\s+/g, ' ');
  return u.includes('line b') && (u.includes('group') || u.includes('grp') || u.includes('g'));
};

const isFrontPlanASheet = (s) => {
  const u = (s || '').toLowerCase().replace(/[-_()]/g, ' ').replace(/\s+/g, ' ');
  return u.includes('front plan') && (u.includes('a') || u.includes('vac'));
};

const isMdsSheet = (s) => {
  const u = (s || '').toLowerCase().replace(/[-_()]/g, ' ').replace(/\s+/g, ' ');
  return u.startsWith('mds') || u.includes('mds');
};

const FPC_TARGET_SPECS = [
  {
    id: 1,
    line: "Macro FPC",
    sheetMatcher: isEfpcOutputSheet,
    sectionKeywords: ["overall e-fpc_total output monitoring", "total output monitoring", "overall e-fpc", "efpc_total"],
    sectionExclusions: ["line-a", "line a", "line-b", "line b", "line-c", "line-d", "line a/b/c/d"],
    label: "Overall E-FPC_TOTAL OUTPUT MONITORING"
  },
  {
    id: 2,
    line: "Direct FPC",
    sheetMatcher: isEfpcOutputSheet,
    sectionKeywords: ["overall e-fpc_total output monitoring", "total output monitoring", "overall e-fpc", "efpc_total"],
    sectionExclusions: ["line-a", "line a", "line-b", "line b", "line-c", "line-d", "line a/b/c/d"],
    label: "Overall E-FPC_TOTAL OUTPUT MONITORING"
  },
  {
    id: 3,
    line: "LINE A",
    sheetMatcher: isEfpcOutputSheet,
    sectionKeywords: ["output monitoring efpc _line-a", "output monitoring efpc_ line-a", "efpc _line-a", "line-a", "final_a"],
    sectionExclusions: ["line a/b", "line a/b/c/d", "a/b/c/d"],
    label: "OUTPUT MONITORING EFPC _LINE-A"
  },
  {
    id: 4,
    line: "AT_VAC",
    sheetMatcher: isFrontPlanASheet,
    sectionKeywords: ["vac (pcs)", "plan (pcs)", "at_vac", "vac"],
    sectionExclusions: [],
    label: "Plan (pcs)"
  },
  {
    id: 5,
    line: "LINE A_FINAL",
    sheetMatcher: isEfpcOutputSheet,
    sectionKeywords: ["output monitoring efpc _line-a", "output monitoring efpc_ line-a", "efpc _line-a", "line-a", "final_a"],
    sectionExclusions: ["line a/b", "line a/b/c/d", "a/b/c/d"],
    label: "OUTPUT MONITORING EFPC _LINE-A"
  },
  {
    id: 6,
    line: "LINE B",
    sheetMatcher: isEfpcOutputSheet,
    sectionKeywords: ["output monitoring efpc _line-b", "output monitoring efpc_ line-b", "efpc _line-b", "line-b", "final_b"],
    sectionExclusions: ["line a/b", "line a/b/c/d", "a/b/c/d"],
    label: "LINE B Overview"
  },
  {
    id: 7,
    line: "LINE B_GEN",
    sheetMatcher: isLineBGroupSheet,
    sectionKeywords: ["output monitoring efpc_ line- gen", "line- gen", "general", "gen"],
    sectionExclusions: ["non silicone", "non_silicone"],
    label: "LINE B General"
  },
  {
    id: 8,
    line: "LINE B_NON",
    sheetMatcher: isLineBGroupSheet,
    sectionKeywords: ["output monitoring efpc_ line non silicone", "non silicone", "non_silicone"],
    sectionExclusions: ["line- gen", "gen output"],
    label: "LINE B Non-Silicone"
  },
  {
    id: 9,
    line: "LINE C",
    sheetMatcher: isEfpcOutputSheet,
    sectionKeywords: ["output monitoring efpc _line-c", "output monitoring efpc_ line-c", "efpc _line-c", "line-c", "final_c"],
    sectionExclusions: ["line a/b", "line a/b/c/d", "a/b/c/d"],
    label: "OUTPUT MONITORING EFPC _LINE-C"
  },
  {
    id: 10,
    line: "LINE D",
    sheetMatcher: isEfpcOutputSheet,
    sectionKeywords: ["output monitoring efpc _line-d", "output monitoring efpc_ line-d", "efpc _line-d", "line-d", "final_d"],
    sectionExclusions: ["line a/b", "line a/b/c/d", "a/b/c/d"],
    label: "OUTPUT MONITORING EFPC _LINE-D"
  },
  {
    id: 11,
    line: "LINE LAM",
    sheetMatcher: isEfpcOutputSheet,
    sectionKeywords: ["output monitoring efpc_ line-lam", "efpc_ line-lam", "line-lam"],
    sectionExclusions: ["line a/b", "line a/b/c/d"],
    label: "OUTPUT MONITORING EFPC_ LINE-LAM"
  },
  {
    id: 12,
    line: "LINE VAC & HPS",
    sheetMatcher: isEfpcOutputSheet,
    sectionKeywords: ["output monitoring efpc_ line-vac", "efpc_ line-vac", "line-vac"],
    sectionExclusions: ["line a/b", "line a/b/c/d"],
    label: "OUTPUT MONITORING EFPC_ LINE-VAC"
  },
  {
    id: 13,
    line: "LINE VAC",
    sheetMatcher: isEfpcOutputSheet,
    sectionKeywords: ["output monitoring efpc_ line-vac", "efpc_ line-vac", "line-vac"],
    sectionExclusions: ["line a/b", "line a/b/c/d"],
    label: "OUTPUT MONITORING EFPC_ LINE-VAC"
  },
  {
    id: 14,
    line: "LINE BLK",
    sheetMatcher: isEfpcOutputSheet,
    sectionKeywords: ["output monitoring efpc_ blk", "blk process", "overall blk", "output monitoring efpc_ pic process", "pic process", "overall pic"],
    labelKeywords: ["actual plan blk (lot)", "plan output blk (lot)", "actual plan pic (lot)", "plan output pic (lot)", "total plan blk (lot)"],
    label: "Dynamic BLK + PIC Plan (LOT)"
  },
  {
    id: 15,
    line: "LINE OST",
    sheetMatcher: isEfpcOutputSheet,
    sectionKeywords: ["output monitoring efpc_ line-ost", "line-ost_tf2", "overall ost"],
    labelKeywords: ["actual plan ost (lot)", "plan output ost (lot)", "total plan ost (lot)"],
    label: "Dynamic OST Plan (LOT)"
  },
  {
    id: 16,
    line: "MDS",
    sheetMatcher: isMdsSheet,
    sectionKeywords: ["mds_plan", "mds plan", "daily master plan", "daily plan"],
    sectionExclusions: [],
    label: "Daily Master plan (pcs)"
  }
];

module.exports = {
  FPC_PLAN_NETWORK_FOLDER,
  FPC_PLAN_LOCAL_FOLDER,
  FPC_PLAN_FOLDER,
  FPC_MONTH_MAP,
  FPC_TARGET_SPECS
};
