# Production Status: สิ่งที่ควรรู้ทั้งหมดก่อนนำไปพัฒนาต่อ

เอกสารนี้สรุปจากการอ่านโค้ดจริงในโปรเจกต์ (ไม่ได้อ่านไฟล์ `.env` เพราะถูกบล็อกไว้) จุดที่เป็นการอนุมานจะเขียนกำกับไว้ว่า "อนุมาน"

---

## 1. ภาพรวม

ระบบเป็นเว็บ Dashboard ของโรงงาน แสดงยอดผลิต งานระหว่างผลิต (WIP) กำลังคน และ Productivity มี 3 ชั้น:

```
ผู้ใช้ (Browser)
   │
   ▼
Frontend  React + Vite          โฟลเดอร์ Frontend-production-status/
   │  เรียก HTTP ที่ /api_p1/production_status/...
   ▼
Gateway   nginx                 ส่งต่อ /api_p1/ ไปที่ container backend พอร์ต 3000
   ▼
Backend   Node.js + Express     โฟลเดอร์ smart-backend-88-62/
   ▼
Database  PostgreSQL (smart, iot, Test, smf) และ MariaDB (ot)
```

Backend ตัวนี้ไม่ได้รับใช้แค่ Production Status แต่รวม API ของระบบอื่นในโรงงานไว้ด้วย (SMT SPC, fin_cer, 3D request, smt-reject)

---

## 2. Repository และ Git

- Repo: `github.com/disekungz/internship-project`
- Branch: `main` (หลัก), `Yo`, `Tong` รวมงานเข้า `main` ด้วย Pull Request
- ไม่มี `package.json` ที่ root ต้องเข้าไปรันคำสั่งในแต่ละโฟลเดอร์
- `.gitignore` ที่ root กันไว้แล้ว: `node_modules`, `dist`, `.server-cache`, `.env*`
- `.claude/settings.json` บล็อกไม่ให้ Claude อ่าน `.env`
- **ไม่มี test ทั้งสองโปรเจกต์** การตรวจมีแค่ `npm run build` (type check) และ `npm run lint` ฝั่ง Frontend

---

## 3. วิธีรัน

| งาน | โฟลเดอร์ | คำสั่ง | หมายเหตุ |
|---|---|---|---|
| รัน Frontend ตอนพัฒนา | `Frontend-production-status/` | `npm run dev` | เปิดให้เครื่องอื่นใน LAN เข้าได้ (`host: true`) |
| ตรวจ type + build | `Frontend-production-status/` | `npm run build` | เป็นที่เดียวที่ตรวจ TypeScript (`strict` เปิดอยู่) |
| ตรวจ lint | `Frontend-production-status/` | `npm run lint` | |
| รัน Backend | `smart-backend-88-62/` | `npm start` | ต้องมี `PORT` ใน `.env` ไม่มีค่า default |

**Production ของ Backend** ใช้ Docker ตาม `smart-backend-88-62/Config-8080/docker-compose.yml`:
- image `node:25-alpine` รัน `node /app/bin/www` ตรงๆ ไม่มีขั้น build
- โค้ดถูก mount เข้า container ทั้งโฟลเดอร์ ดังนั้น `node_modules` ต้องติดตั้งไว้ในโฟลเดอร์นั้นก่อน (อนุมานจากการ mount)
- mount โฟลเดอร์รูป (`/app/images`) และโฟลเดอร์ Excel (`/file_Folder/OUTPUT_FOLDER`, `/file_Folder/FPC_PLAN_OUTPUT`)
- ตั้งเวลา `TZ=Asia/Bangkok` และ `PGTZ=Asia/Bangkok`
- nginx (`smart-backend-p1.location.conf`) ส่ง `/api_p1/` ไปที่ `smart-backend-p1:3000` ปิด buffering และตั้ง timeout ยาว ซึ่งจำเป็นต่อ SSE และ WebSocket

**Production ของ Frontend** ไม่มีไฟล์ deploy ใน repo คอมเมนต์ใน `apiConfig.ts` พูดถึง IIS แต่ยืนยันจากโค้ดไม่ได้

---

## 4. ตัวแปร `.env` ที่โค้ดเรียกใช้ (ชื่ออย่างเดียว)

**Frontend**
- `VITE_API_BASE_URL` ตัวหลัก ต้องลงท้ายด้วย `/api_p1/production_status` เพราะหน้าเรียกแบบ `${VITE_API_BASE_URL}/mh/manhour`
- `VITE_API_PORT` ใช้เฉพาะตอนไม่มีตัวบน (default 8080)
- `VITE_API_IP` ใช้ในตัวเรียก axios แบบเก่าเท่านั้น

**Backend**
- `PORT`
- `POSTGRES_HOST_NAME_<ip>`, `POSTGRES_PORTS_<ip>`, `POSTGRES_USER_NAME_<ip>`, `POSTGRES_PASSWORD_<ip>` สำหรับ `10_17_87_244`, `10_17_88_61`, `10_17_100_193`, `127_0_0_1`
- `MARIADB_HOST_NAME_10_17_87_50`, `MARIADB_PORTS_...`, `MARIADB_USER_NAME_...`, `MARIADB_PASSWORD_...`
- `MANHOUR_AUTH_SECRET` กุญแจเซ็น token ของ admin ถ้าไม่ตั้ง ทุก request ที่ต้องใช้สิทธิ์ admin จะถูกปฏิเสธ
- `SMT_OUTPUT_FOLDER`, `MAT_OUTPUT_FOLDER`, `FPC_PLAN_FOLDER`, `FPC_PLAN_LOCAL_FOLDER` โฟลเดอร์ Excel ที่ระบบ sync

---

## 5. Frontend

**เทคโนโลยี:** React 19, TypeScript, Vite 7, MUI 7, Tailwind 4 + daisyUI, ECharts, Recharts, react-router 7, next-themes, SweetAlert2, react-hot-toast, ExcelJS / xlsx, jsPDF + html2canvas, PWA

**โครงสร้าง**

| ที่อยู่ | หน้าที่ |
|---|---|
| `src/main.tsx`, `src/App.tsx` | จุดเริ่ม ตั้ง theme ของ MUI, Router, Toaster และลงทะเบียน Service Worker |
| `src/routes/config.tsx` | รายการหน้าทั้งหมด แบ่งเป็นกลุ่ม `routes`, `routes_wip`, `routes_man`, `routes_productivity` ฯลฯ |
| `src/routes/AppRoutes.tsx` | วาดทุก route ภายใน Layout หน้าแรกคือหน้าที่มี `isDefault: true` (SMART Dashboard) |
| `src/Layout/LayoutDrawer/` | โครงหน้าจอ เมนูข้างประกอบใน `Drawer.Config/DrawerMenu.tsx` |
| `src/pages/<Feature>/` | หน้าจอ แต่ละหน้ามี `api/`, `components/`, `hooks/`, `utils/` ของตัวเอง |
| `src/components/` | ของใช้ร่วม เช่น ตัวเลือกวันที่, `BaseEChart`, `ThemeSwitcher`, `ExportModal` |
| `src/utils/apiConfig.ts` | หา URL ของ API และฟังก์ชันตั้งค่า Productivity |
| `src/utility/` | SweetAlert, ส่งออก Excel, cache ฝั่ง browser, VirtualList |

**ขนาดของแต่ละหน้า (บรรทัดโค้ดโดยประมาณ)**

| หน้า | บรรทัด |
|---|---|
| Productivity | 37,500 |
| Manpower | 21,900 |
| OUTPUT | 12,800 |
| WIP | 8,300 |
| ManpowerRatio | 4,400 |
| ManpowerRatioDaily | 2,700 |
| P1ManpowerStatus | 1,300 |
| RecruitResign | 1,300 |

**หลักการที่ใช้ทั้งโปรเจกต์**
- ทุกหน้าโหลดแบบ `React.lazy` จึงโหลดเฉพาะหน้าที่เปิด
- เรียก API ด้วย `fetch` เป็นหลัก (36 ไฟล์) ส่วน `axios` มีแค่ 2 ไฟล์ ไม่มี library จัดการ state หรือ data fetching กลาง แต่ละหน้าจัดการเอง
- alias `@` ชี้ไปที่ `src/`
- แอปอยู่ใต้ path `/production-status/` (ตั้งทั้งใน `vite.config.ts` และ `BASE` ใน `config.tsx` ต้องแก้ทั้งสองที่ถ้าจะเปลี่ยน)
- **ธีม:** daisyUI ตั้งค่า `data-theme` บน `<html>` แล้ว `themeUtils.ts` อ่านสี `--color-*` แปลงเป็น hex ส่งให้ MUI กราฟที่ใช้สีคงที่จะไม่เปลี่ยนตามธีม ต้องเขียนให้อ่านสีจากธีมเอง
- **หน้า Manpower** ย้ายงานคำนวณหนักไปที่ Web Worker (`aggregation.worker.ts`) และรับการแจ้งเตือนข้อมูลเปลี่ยนผ่าน SSE (`useManhourServerEvents.ts`)
- บางหน้าดึงข้อมูลซ้ำเป็นระยะด้วย `setInterval` เช่น ManpowerRatio, WIP History, กระดิ่งแจ้งเตือนของ Productivity
- ค่าที่เก็บใน browser: `sessionStorage["manhour-admin-token"]` และ `localStorage` ที่ขึ้นต้นด้วย `pdt_`, `productivity_`, `manhour-`

---

## 6. Backend

**เทคโนโลยี:** Node.js, Express 4.16 (CommonJS), `pg`, `mariadb`, `node-cron`, `ws`, `multer`, `xlsx`, `dayjs`, `compression`, `morgan`

**การจัด route แบบ 2 ชั้น**

```
app.js
  └─ Config/Main/<ระบบ>/*.js          ชั้นรวมเส้นทาง มีแค่ app.use() ไม่มี logic
        └─ routes/<IP ของ DB>/...     โค้ดจริง query ฐานข้อมูล
```

แต่ละโฟลเดอร์ `routes/<IP>/` มี `config.js` ที่สร้าง connection pool และฟังก์ชันช่วย `queryWithRetry` (ลองใหม่ 2 ครั้งเมื่อ query ล้มเหลว)

**ระบบที่ `app.js` เปิดใช้อยู่**

| Prefix | ระบบ |
|---|---|
| `/api_p1/production_status` | Production Status (ระบบนี้) |
| `/api_p1/smart_smt_spc_spi`, `_spc_aoi`, `_elt_output`, `_aoi_output`, `_spi_output` | SMT SPC |
| `/api_p1/smt_reject` | SMT reject |
| `/api_p1/3D` | 3D request |
| `/api_p1/Fake` | FakeScan |
| `/api/fin_cer` | ใบรับรองการอบรม (สังเกตว่าใช้ `/api` ไม่ใช่ `/api_p1`) |
| `/api/get-img` | รูปที่อัปโหลด (`D:/img` บน Windows, `/app/images` บน Linux) |

**แผนที่ API ของ Production Status** (ต่อท้าย `/api_p1/production_status`)

| เส้นทาง | เนื้อหา | ไฟล์โค้ดจริง (ใต้ `productionstatus/`) |
|---|---|---|
| `/outputoverall/output` | ยอดผลิตรวม | `outputoverall/fpc-output.js` |
| `/outputbyproduct/...` | ยอดผลิตตามสินค้า | `outputbyproduct/output_by_product_api.js` |
| `/outputbyprocess/...` | ยอดผลิตตามกระบวนการ | `outputbyprocess/output_by_process_api.js` |
| `/wip/wip_tasks`, `/wip/daily-p1`, `/wip/target` | WIP | `wip/tasks.js`, `dailyP1.js`, `target.js` |
| `/manpower/...` และ `/mh/...` (ตัวเดียวกัน) | กำลังคนและ Man-hour | `manpower/manhour.js`, `deptSummary.js`, `p1ManpowerStatus.js`, `recruitResign.js`, `lineManager.js`, `help.js`, `auth.js` |
| `/productivity/...` และ `/attendance/...` (ตัวเดียวกัน) | Productivity และการตั้งค่า | `productivity/*.js` 7 ไฟล์ |

**งานเบื้องหลัง**
- `app.js` ตั้ง cron ทุกต้นชั่วโมงเรียก `runDailyCostProcess` (ของ smt-reject) และรัน 1 ครั้งตอน server เริ่ม
- `services/productivity/` มีงาน sync Excel, snapshot กำลังคน, snapshot ยอดผลิต และสรุปรายงวด รวมราว 7,300 บรรทัด

**Realtime**
- SSE: `GET .../mh/manhour/events` เมื่อมีการเขียนข้อมูล โค้ดเรียก `broadcastManhourChange()`
- WebSocket: `websocket.js` เปิดที่ path `/ws` มีฟังก์ชัน `broadcast()`

**Cache 3 แบบ**

| ไฟล์ | วิธีทำงาน | ใช้เมื่อ |
|---|---|---|
| `Utility/apiCache.js` | เก็บใน memory มีอายุ (เช่น 60 วินาที หรือ 5 นาที) | ข้อมูล dashboard และรายการ dropdown |
| `Utility/cacheManager.js` | memory + ไฟล์ เดือนที่ผ่านแล้วเก็บถาวร เดือนปัจจุบันคืนค่าเก่าทันทีแล้วดึงใหม่เบื้องหลังเมื่อเก่าเกิน 20 วินาที บังคับดึงใหม่ด้วย `?refresh=1` | ข้อมูลรายเดือนที่คำนวณหนัก |
| `Utility/persistentCache.js` | เขียน JSON ลง `.server-cache/` แบบเขียนไฟล์ชั่วคราวแล้วเปลี่ยนชื่อ | ให้ cache อยู่รอดหลัง restart |

---

## 7. Database

| Pool ในโค้ด | ชนิด | เครื่อง | ฐาน | ใช้เก็บอะไร |
|---|---|---|---|---|
| `pool_smart` | PostgreSQL | 10.17.87.244 | `smart` | ข้อมูลต้นทางของโรงงาน: output, WIP, การลงเวลา |
| `pool_test` | PostgreSQL | 10.17.87.244 | `Test` | **ตารางของระบบนี้เอง**: snapshot, การตั้งค่า, ผู้ใช้ admin |
| `pool_iot` | PostgreSQL | 10.17.87.244 | `iot` | ข้อมูล SMT SPC |
| `pool_ot` | MariaDB | 10.17.87.50 | `ot` | พนักงาน ปฏิทิน การยืมตัวคน |
| `pool_smart61` | PostgreSQL | 10.17.88.61 | `smart` | fin_cer, 3D, smt-reject |
| `pool_iot` (ใน 100.193) | PostgreSQL | 10.17.100.193 | `smf` | OT / HR |

**ตารางสำคัญ**
- ฐาน `smart` (schema `smart`): `smart_fpc_process_output_detail`, `smart_fpc_output_detail`, `smart_fpc_output_target`, `smart_pln_output_target`, `smart_fpc_lot_wip_history`, `smart_wip_daily_p1`, `smart_wip_napk`, `smart_man_time_attendance`, `smart_man_cc_master_mhr`
- ฐาน `Test` (schema `public`): `manpower_snapshot`, `output_daily_snapshot`, `productivity_attendance_daily_snapshot`, `productivity_period_summary`, `cost_centers`, `line_output_mapping`, `custom_macro_lines`, `manhour_line_mappings`, `manpower_loan_exclude`, `excel_import_history`, `mat_daily_output`, `fpc_daily_actual_plan`, `smt_daily_actual_plan`, `register_admin_users`
- ฐาน `ot` (MariaDB): `tbl_employee`, `tbl_employee_help`, `tbl_help`, `tbl_date`

---

## 8. สิทธิ์ผู้ใช้

ระบบไม่มีการ login สำหรับดูข้อมูล ทุกคนที่เข้าถึงเครือข่ายเปิดดูได้ มีสิทธิ์ admin สองแบบที่ทำงานต่างกัน:

| | Manpower | Productivity |
|---|---|---|
| Login ที่ | `POST .../mh/auth/login` | `POST .../productivity/admin-login` |
| ผลลัพธ์ | token อายุ 8 ชั่วโมง เซ็นด้วย HMAC-SHA256 | ตอบแค่ `success: true` ไม่มี token |
| Frontend เก็บ | `sessionStorage["manhour-admin-token"]` | `localStorage["pdt_is_admin"] = "true"` |
| Backend ตรวจตอนเขียนข้อมูล | ตรวจด้วย `requireAdmin` | **ไม่ตรวจ** |

ทั้งสองแบบใช้ตารางเดียวกันคือ `register_admin_users`

---

## 9. ปัญหาความปลอดภัยที่พบ

ระบบใช้ในเครือข่ายภายใน ความเสี่ยงจึงจำกัดอยู่ที่คนในเครือข่าย แต่ถ้าจะนำแบบนี้ไปทำระบบอื่น ควรแก้ก่อน

1. **API ส่งรหัสผ่านของ admin ทุกคนออกมาโดยไม่ต้อง login**
   `GET .../productivity/admin-users` คืนคอลัมน์ `password` ของทุกบัญชี (`productivitySettingRoutes.js` บรรทัด 78 ถึง 112)
2. **รหัสผ่านเก็บเป็นข้อความธรรมดา** เปรียบเทียบด้วย `===` ทั้งใน `auth.js` และ `productivitySettingRoutes.js`
3. **เส้นทางเขียนข้อมูลราว 60 เส้นทางไม่ตรวจสิทธิ์ที่ Backend** ได้แก่ทั้งหมดของ Productivity (5 ไฟล์), `deptSummary.js`, `lineManager.js`, `recruitResign.js`, `p1ManpowerStatus.js` มีแค่ `manhour.js` 4 เส้นทางที่ตรวจ สิทธิ์ admin ของ Productivity เป็นแค่การซ่อนปุ่มที่หน้าจอ
4. **`auth.js` พิมพ์ลง log ว่ารหัสผ่านตรงหรือไม่** พร้อมชื่อผู้ใช้
5. **`cors()` เปิดรับทุก origin**

SQL ในไฟล์ที่ตรวจใช้ parameter (`$1`, `$2`) ไม่ต่อ string จาก request ตรงๆ แต่ยังไม่ได้ตรวจ SQL ครบทุกไฟล์

---

## 10. จุดที่ต้องระวัง

1. **ตรรกะซ้ำสองฝั่ง** แก้ฝั่งหนึ่งต้องแก้อีกฝั่ง
   - `Utility/lineGroups.js` (1,960 บรรทัด) กับ `src/pages/Manpower/config/lineGroups.ts`
   - `Utility/manpowerAggregation.js` กับ `src/pages/Manpower/aggregation.ts`
2. **ตัวตั้งเวลา snapshot ไม่ทำงานเอง** `initSnapshotScheduler()` ไม่มีใครเรียก งาน 09:00 จึงไม่รัน ต้องสั่งผ่าน API เอง และมีฟังก์ชันชื่อเดียวกันอีกตัวใน `snapshotManager.js`
3. **ค่า default ของ URL API ใช้ไม่ได้จริง** ถ้าไม่ตั้ง `VITE_API_BASE_URL` โค้ดจะเรียก `<host>:8080/api/...` ซึ่ง Backend ไม่มีเส้นทางนั้น และ `pages/Manpower/api/config.ts` จะได้ `undefined` ต้องตั้งตัวแปรนี้เสมอ
4. **path ถูกเปิดไว้หลายชื่อ** เช่น `/manpower` = `/mh`, `/productivity` = `/attendance`, `/p1_status` = `/p1_manpower_status` และบาง router ถูกเปิดที่ `/` ด้วย ก่อนเปลี่ยนชื่อ path ต้องดูไฟล์ใน `Config/Main/` ก่อน
5. **เขียนข้อมูล Man-hour ต้องล้าง cache** เรียก `clearManhourDataCache()` และ `broadcastManhourChange()` ไม่อย่างนั้นหน้าจอจะเห็นข้อมูลเก่า
6. **ฐานชื่อ `Test` เป็นข้อมูลใช้งานจริง** ไม่ใช่ฐานทดสอบ
7. **มีโค้ดที่ไม่ได้ใช้งาน**
   - `Frontend-production-status/server/` import ไฟล์ `./routes/*.js` ที่ไม่มีใน repo จึงรันไม่ได้ และ dependency `express`, `pg`, `mysql2`, `oracledb` ใน `package.json` ฝั่ง Frontend มีไว้เพื่อโฟลเดอร์นี้
   - `Config/Main/smart-ot/`, `smart-scan-in-out/`, `Smart_Eworking_User_Pasword/` ไม่ถูก mount ใน `app.js`
   - `smart-backend-88-62/backup/` เป็นไฟล์เก่า
8. **`dev-dist/` เป็นไฟล์ที่ระบบสร้าง** เปลี่ยนทุกครั้งที่รัน dev อย่าแก้มือ และระวังติดไปกับ commit
9. **`app.js` เรียก `body-parser`** แต่ไม่ได้ประกาศใน `package.json` ทำงานได้เพราะ Express 4.16 พ่วงมา ถ้าอัปเกรด Express อาจพัง
10. **เวลาใช้ Asia/Bangkok** ทั้งใน Docker และในโค้ด cache ถ้ารันนอก Docker ต้องตรวจ timezone ของเครื่อง
11. **ชื่อ PWA ยังเป็นของ template** (`React-template-typescript` ใน `vite.config.ts`) และ `name` ใน `package.json` คือ `my-react-app`
12. **`CLAUDE.md` เขียนตำแหน่ง MariaDB ผิด** MariaDB อยู่ที่ 10.17.87.50 ส่วนโฟลเดอร์ `10.17.100.193` ต่อ PostgreSQL ฐาน `smf`

---

## 11. วิธีเพิ่มของใหม่

**เพิ่มหน้าใหม่**
1. สร้าง `src/pages/<ชื่อ>/` พร้อม `api/`, `components/`, `hooks/`
2. ใน `src/routes/config.tsx` เพิ่ม `React.lazy(() => import(...))` และเพิ่ม object ลงในกลุ่ม route ที่ต้องการ
3. ถ้าใส่ในกลุ่มที่มีอยู่แล้ว เมนูจะขึ้นเอง ถ้าสร้างกลุ่มใหม่ ต้องเพิ่มใน `allRoutes` และใน `Layout/LayoutDrawer/Drawer.Config/DrawerMenu.tsx`
4. ใช้ `getApiBaseUrl()` จาก `@/utils/apiConfig` เป็นฐาน URL
5. รัน `npm run build` เพื่อตรวจ type

**เพิ่ม API ใหม่**
1. เขียน router ใต้ `routes/<IP ของ DB ที่ใช้>/...` ดึง pool จาก `config.js` ของโฟลเดอร์นั้น
2. ใช้ parameter (`$1`) ใน SQL เสมอ และครอบด้วย `try/catch` ตอบ `500` พร้อมข้อความ
3. ถ้าข้อมูลอ่านบ่อย ใส่ `getCached` / `setCache` จาก `Utility/apiCache.js`
4. เปิดเส้นทางในไฟล์ `Config/Main/<ระบบ>/...`
5. ถ้าเป็นระบบใหม่ทั้งชุด เพิ่ม `app.use("/api_p1/<ชื่อ>", ...)` ใน `app.js`
6. ถ้าเป็นการเขียนข้อมูล ใส่ `requireAdmin` จาก `manpower/auth.js`

---

## 12. ถ้านำไปทำระบบอื่นต่อ

**เก็บไว้ใช้ได้เลย**
- การแบ่งหน้าเป็นโฟลเดอร์ที่มี `api/`, `components/`, `hooks/` ของตัวเอง
- route config ไฟล์เดียวที่คุมทั้งเส้นทางและเมนู
- routing 2 ชั้นของ Backend และการแยกโฟลเดอร์ตามเครื่อง DB
- cache แบบคืนค่าเก่าก่อนแล้วดึงใหม่เบื้องหลัง
- SSE สำหรับแจ้งว่าข้อมูลเปลี่ยน ง่ายกว่า WebSocket เมื่อส่งทางเดียว
- Web Worker สำหรับงานคำนวณหนัก

**ควรแก้ก่อนใช้เป็นแบบ**
- ทำระบบสิทธิ์ให้เป็นแบบเดียว ตรวจที่ Backend ทุกเส้นทางเขียนข้อมูล และ hash รหัสผ่าน
- ย้ายตรรกะที่ซ้ำสองฝั่งไปไว้ที่เดียว เช่นให้ Backend คำนวณแล้วส่งผลลัพธ์
- รวมการเรียก API ไว้ที่ตัวกลางตัวเดียว แทนการ `fetch` กระจายใน 36 ไฟล์
- แตกไฟล์ที่ยาวเกิน 2,000 บรรทัด (`manhour.js`, `deptSummary.js`, `productivitySettingRoutes.js`)
- เพิ่ม test อย่างน้อยกับสูตรคำนวณ
- สร้างไฟล์ `.env.example` บอกชื่อตัวแปรที่ต้องมี
- จำกัด `cors()` ให้รับเฉพาะ origin ของ Frontend

---

## 13. สิ่งที่ยังไม่ได้ตรวจ

- ค่าจริงใน `.env` ทั้งสองฝั่ง
- วิธี deploy Frontend และพอร์ตของ gateway (ชื่อโฟลเดอร์ `Config-8080` และค่า default ใน Frontend ชี้ว่าเป็น 8080 แต่เป็นการอนุมาน)
- สูตรคำนวณ Productivity และ Man-hour โดยละเอียด มีไฟล์ `productivity-formulas-report.pdf` ที่ root ซึ่งยังไม่ได้อ่าน
- SQL ทุกไฟล์ และโค้ดของระบบอื่นใน Backend (SMT SPC, fin_cer, 3D, smt-reject)
