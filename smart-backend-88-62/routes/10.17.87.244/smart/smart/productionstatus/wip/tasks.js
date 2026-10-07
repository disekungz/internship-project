// ==========================================
// API Router สำหรับจัดการรายการงาน WIP Tasks (WIP Overview / Tasks Stream)
// - รองรับการส่งข้อมูลแบบ Real-time ผ่าน Server-Sent Events (SSE)
// - ตรวจจับการเปลี่ยนแปลงในฐานข้อมูล PostgreSQL แล้ว Push แจ้งเตือนไปยังหน้าจอ WIP
// ==========================================
const express = require("express");
const router = express.Router();

const { pool_smart } = require("../../../../config.js");
const query = (text, params) => pool_smart.query(text, params);
/**
 * แปลงวันที่เป็น Object พร้อมรูปแบบ ISO (YYYY-MM-DD) และรูปแบบภาษาไทย
 */
const safeGetDate = (value) => {
  const date = new Date(value);
  const valid = !Number.isNaN(date.getTime());
  return {
    date: valid ? date : null,
    iso: valid ? date.toISOString().slice(0, 10) : null,
    local: valid ? date.toLocaleDateString("th-TH") : "-",
  };
};
const taskEventClients = new Set();
let taskNotifyClient = null;
let taskNotifyRetryTimer = null;

let wipTasksCache = null;
let wipTasksLastFetched = 0;
let isWipTasksFetching = false;
const WIP_TASKS_STALE_MS = 15000; // 15 วินาที สำหรับ Realtime SWR

/**
 * GET /stream
 * Endpoint สำหรับ Server-Sent Events (SSE) ส่งสัญญาณอัปเดตงาน WIP แบบ Real-time
 */
router.get("/stream", (req, res) => {
  res.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.flushHeaders?.();
  taskEventClients.add(res);

  // ส่ง heartbeat ถี่ขึ้นทุกๆ 5 วินาที เพื่อป้องกัน ERR_CONNECTION_RESET จาก proxy/timeout
  const heartbeat = setInterval(() => {
    try {
      res.write(": heartbeat\n\n");
    } catch (e) {
      clearInterval(heartbeat);
    }
  }, 5000);

  req.on("close", () => {
    taskEventClients.delete(res);
    clearInterval(heartbeat);
  });
});

function retryTaskNotifier() {
  if (taskNotifyRetryTimer) return;
  taskNotifyRetryTimer = setTimeout(() => {
    taskNotifyRetryTimer = null;
    startTaskNotifier().catch((error) =>
      console.error("[tasks/events] reconnect failed:", error.message),
    );
  }, 5000);
}

async function startTaskNotifier() {
  if (taskNotifyClient) return;
  let client;
  try {
    client = await pool_smart.connect();
    await client.query(`
      CREATE OR REPLACE FUNCTION smart.notify_wip_tasks_change() RETURNS trigger AS $$
      BEGIN PERFORM pg_notify('wip_tasks_changed', 'changed'); RETURN COALESCE(NEW, OLD); END; $$ LANGUAGE plpgsql;
      DROP TRIGGER IF EXISTS wip_tasks_changed_trigger ON smart.smart_wip_napk;
      CREATE TRIGGER wip_tasks_changed_trigger AFTER INSERT OR UPDATE OR DELETE ON smart.smart_wip_napk
        FOR EACH ROW EXECUTE FUNCTION smart.notify_wip_tasks_change();
      LISTEN wip_tasks_changed;
    `);
    client.on("notification", async (notification) => {
      if (notification.channel !== "wip_tasks_changed") return;
      try {
        const freshTasks = await fetchWipTasksData();
        const msg = `event: wip-update\ndata: ${JSON.stringify(freshTasks)}\n\n`;
        taskEventClients.forEach((stream) => stream.write(msg));
      } catch (error) {
        console.error("[tasks/events] notification update failed:", error.message);
      }
    });
    client.on("error", (error) => {
      taskNotifyClient = null;
      console.error("[tasks/events] listener failed:", error.message);
      retryTaskNotifier();
    });
    client.on("end", () => {
      taskNotifyClient = null;
      retryTaskNotifier();
    });
    taskNotifyClient = client;
    console.log(
      "[tasks/events] Listening for PostgreSQL changes on smart_wip_napk.",
    );
  } catch (error) {
    client?.release?.(error);
    retryTaskNotifier();
  }
}
startTaskNotifier();

const customerMapping = {
  CAC: "ORTUSTECH",
  CAD: "CANON",
  CAE: "CANON",
  CAK: "CANON",
  CAO: "CANON",
  CAS: "CANON",
  CAU: "CANON",
  CAW: "CANON",
  CAY: "CANON",
  CAZ: "CANON",
  COP: "NIDEC COPAL",
  FJT: "FUJITSU",
  FNA: "FUNAI",
  HFT: "HITACHI",
  ICI: "ICHIKO",
  JDM: "JAPAN DISPLAY",
  JDT: "JAPAN DISPLAY",
  KEI: "SEIKO",
  KIT: "KOITO",
  KWD: "KENWOOD",
  MCI: "PANASONIC",
  MAD: "PANASONIC",
  MBL: "NMB",
  MBM: "MINEBEA",
  MBT: "MINEBEA",
  MID: "MITSUBISHI",
  MIL: "MITSUBISHI",
  MRT: "MURATA",
  NDB: "NIDEC",
  NDN: "NIDEC",
  NHD: "NEC",
  NKG: "NIKON",
  NKN: "NIKON",
  NKS: "NIKON",
  NSL: "NEST",
  OPR: "KYOCERA",
  PHL: "PHILIPS",
  PVC: "PIONEER",
  PVI: "PIONEER",
  QMM: "SONY",
  RGO: "Z",
  SEC: "SEKONIC",
  SES: "SOMC",
  SOA: "SONY",
  SOV: "SONY",
  SOY: "SONY",
  SPO: "EPSON",
  SPS: "EPSON",
  SYA: "HONDA",
  SYC: "SONY",
  SYD: "SONY",
  SYG: "SONY",
  SYL: "SONY",
  SYT: "SONY",
  TMR: "TAMRON",
  TOD: "TOSHIBA",
  TSO: "TOSHIBA",
  VLO: "VALEO",
  OLY: "OLYIMUPS",
  VTN: "VISTEON",
  VLM: "Valmet",
};

async function fetchWipTasksData() {
  const wipQuery = `
    SELECT 
      ROW_NUMBER() OVER() AS fake_id, wip.factory, wip.lot_prd_name, wip.lot, 
      wip.proc_id, wip.proc_disp, wip.lot_status, wip.input_qty, wip.pending_date,
      wip.pending_reason, wip.pending_remark, wip.update_date, hist.wip_scan_in,
      CASE 
        WHEN wip.update_date IS NOT NULL AND hist.wip_scan_in IS NOT NULL 
        THEN EXTRACT(EPOCH FROM (wip.update_date::timestamp - hist.wip_scan_in::timestamp)) / 86400
        ELSE 0
      END AS lead_time_days
    FROM smart.smart_wip_napk wip
    LEFT JOIN (
      SELECT lot, MAX(wip_scan_in) AS wip_scan_in
      FROM smart.smart_fpc_lot_wip_history
      WHERE lot IS NOT NULL AND lot != ''
      GROUP BY lot
    ) hist ON TRIM(wip.lot) = TRIM(hist.lot)
    WHERE wip.factory IN ('9', 'E')
  `;

  const wipResult = await query(wipQuery);
  let wipTasks = [];

  if (wipResult && wipResult.rows) {
    const uniqueLotProcessDateSet = new Set();
    wipTasks = wipResult.rows.map((row) => {
      const targetDate = row.update_date || row.pending_date;
      const dateObj = safeGetDate(targetDate);
      let formattedScanIn = "-";
      if (row.wip_scan_in) {
        const scanInDate = new Date(row.wip_scan_in);
        if (!isNaN(scanInDate.getTime())) {
          formattedScanIn = scanInDate.toLocaleDateString("th-TH");
        }
      }

      const procName = row.proc_disp || "General";
      let groupResult = "EFPC_GEN";
      if (procName.includes("AT-")) {
        groupResult = "EFPC_AUTO";
      } else if (procName.includes("M")) {
        groupResult = "SMT";
      }

      const currentLeadTime = Math.max(
        0,
        Math.floor(Number(row.lead_time_days || 0)),
      );
      let ltGroupResult = "Less 1 Day";
      if (currentLeadTime > 3) {
        ltGroupResult = "More 3 Days";
      }

      const scanInDate = dateObj.local;
      const lotKey = `${row.lot || "unknown"}_${procName}_${scanInDate}`;

      let countValue = 0;
      if (
        row.lot &&
        scanInDate !== "-" &&
        !uniqueLotProcessDateSet.has(lotKey)
      ) {
        uniqueLotProcessDateSet.add(lotKey);
        countValue = 1;
      }

      const prefix = row.lot_prd_name ? row.lot_prd_name.substring(0, 3) : "";
      const customerResult = customerMapping[prefix] || "Other";

      return {
        id: Number(row.fake_id) + 20000,
        text: row.lot_prd_name || "Unknown Product",
        process: row.proc_disp || "General",
        qty: Number(row.input_qty || 0),
        status: "wip",
        date: dateObj.local,
        db_date: dateObj.iso,
        factory: row.factory,
        lot: row.lot,
        proc_id: row.proc_id,
        proc_disp: row.proc_disp,
        lot_status: row.lot_status,
        input_qty: Number(row.input_qty || 0),
        pending_date: row.pending_date,
        pending_reason: row.pending_reason,
        pending_remark: row.pending_remark,
        update_date: dateObj.iso,
        Wip_Scan_In: formattedScanIn,
        lead_time: currentLeadTime,
        group: groupResult,
        lt_group: ltGroupResult,
        wip_by_date: scanInDate,
        lot_count: countValue,
        customer_group: customerResult,
      };
    });
  }

  wipTasksCache = wipTasks;
  wipTasksLastFetched = Date.now();
  return wipTasks;
}

router.get("/", async (req, res) => {
  const isRefresh = req.query.refresh === "1";

  if (isRefresh) {
    try {
      const data = await fetchWipTasksData();
      res.set("X-Data-Cache", "REFRESH");
      return res.status(200).json(data);
    } catch (err) {
      console.error("🚨 WIP fetch error:", err.message);
      return res.status(500).json({ error: "Cannot refresh WIP tasks" });
    }
  }

  // SWR: ถ้ามีข้อมูลใน RAM แคช
  if (wipTasksCache && Array.isArray(wipTasksCache)) {
    const isStale = Date.now() - wipTasksLastFetched > WIP_TASKS_STALE_MS;
    if (isStale && !isWipTasksFetching) {
      isWipTasksFetching = true;
      fetchWipTasksData()
        .catch((e) => console.warn("[wip_tasks] Background fetch failed:", e.message))
        .finally(() => { isWipTasksFetching = false; });
    }
    res.set("X-Data-Cache", isStale ? "STALE" : "HIT");
    return res.status(200).json(wipTasksCache);
  }

  // Cold start
  try {
    const data = await fetchWipTasksData();
    res.set("X-Data-Cache", "COLD_FETCH");
    return res.status(200).json(data);
  } catch (wipError) {
    console.error(
      "🚨 เกิดข้อผิดพลาดในการดึงข้อมูล WIP:",
      wipError.code || "",
      wipError.message,
    );
    return res.status(503).json({
      error: "WIP database is unavailable",
      errorMessage: wipError.message,
    });
  }
});

module.exports = router;
