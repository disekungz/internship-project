# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository layout

Two independent npm projects with no root `package.json`. Run commands from inside each folder.

- `Frontend-production-status/` is the "Production Status" dashboard for the factory (React 19 + TypeScript + Vite 7, MUI 7, Tailwind 4 + daisyUI, ECharts/Recharts). It ships as a PWA served under `/production-status/`.
- `smart-backend-88-62/` is an Express 4 (CommonJS) API backed by PostgreSQL (`pg`) and MariaDB. The frontend talks to it. Its README points at the upstream repo `gitlab.com/fujikura-k1/smart-backend-k1`.

Code comments and log messages are mostly in Thai.

`PROJECT-GUIDE.md` (Thai) is the detailed handbook: database tables, `.env` variable names, the admin-auth schemes, known security issues, and step-by-step checklists for adding pages and APIs. `productivity-formulas-report.pdf` documents the Productivity and Man-hour formulas. Check them before re-deriving those details from code.

Git: `origin` is `github.com/disekungz/internship-project`. Work happens on the `Yo` and `Tong` branches and is merged into `main` through pull requests. `.claude/settings.json` denies reading `.env` files, so take variable names from the code or `PROJECT-GUIDE.md`.

## Commands

Frontend (`Frontend-production-status/`):
- `npm run dev`: Vite dev server (`host: true`, so it is reachable on the LAN)
- `npm run build`: `tsc -b && vite build`. This is the only type check; there is no separate typecheck script.
- `npm run lint`: ESLint over the project
- `npm run dev:server` / `npm run start:server`: run a small standalone Express server (`server/server.js`, port 5001) with `--env-file=.env`. Note: it imports `./routes/*.js` files that are not in the repo, so it will not start as checked in.

Backend (`smart-backend-88-62/`):
- `npm start`: runs `node ./bin/www`. The port comes from `PORT` in `.env`; there is no default.
- Production runs in Docker through `smart-backend-88-62/Config-8080/docker-compose.yml`. `node:25-alpine` runs `node /app/bin/www` against the repo mounted at `/app` (there is no build step), and the compose file also mounts the image folder and the Excel folders `/file_Folder/OUTPUT_FOLDER` and `/file_Folder/FPC_PLAN_OUTPUT`. It sets `TZ`/`PGTZ=Asia/Bangkok` and joins the external `smart-reverse-proxy-network`.
- The nginx snippet `Config-8080/smart-backend-p1.location.conf` forwards `/api_p1/` to `smart-backend-p1:3000` with buffering off and day-long timeouts. SSE and WebSocket depend on both settings.

Neither project has a test suite.

## Backend architecture

**Two-layer routing.** `app.js` mounts "Main" routers from `Config/Main/**`. These are thin aggregators that only `app.use()` sub-routers. The actual handlers live under `routes/<db-host-ip>/...`, grouped by the database server they query:
- `routes/10.17.87.244/`: IoT/SMT SPC data plus the `smart` DB. Production-status features live in `smart/smart/productionstatus/{manpower,productivity,wip,outputoverall,outputbyprocess,outputbyproduct}`.
- `routes/10.17.88.61/`: fin_cer (training certificates), 3D requests, smt-reject.
- `routes/10.17.100.193/`: OT / HR, PostgreSQL database `smf`.

Each host folder has a `config.js` that exports its connection pools, and handlers `require` the pool from that file. The folder name does not always match the server a pool connects to. Production status uses the pools in `routes/10.17.87.244/config.js`:
- `pool_smart` (database `smart`): the factory's source data, such as output, WIP, and time attendance.
- `pool_test` (database `Test`): **this system's own production tables**, such as snapshots, settings, and admin users. Despite its name, `Test` is not a test database, so never treat writes to it as safe.
- `pool_ot`: MariaDB database `ot` on 10.17.87.50 (employees, calendar, staff loans). `routes/10.17.88.61/config.js` opens the same database as `pool_smartd`.
- The name `pool_iot` refers to two different databases: `iot` in the 87.244 folder and `smf` in the 100.193 folder.

The credentials come from `.env` variables named per host, such as `POSTGRES_HOST_NAME_10_17_87_244` and `MARIADB_HOST_NAME_10_17_87_50`.

To add an endpoint, write the handler under `routes/<ip>/...`, then wire it in the matching `Config/Main/.../*.js` aggregator. Example path: `/api_p1/production_status` → `Config/Main/production_status/production_status.js` → `manpower/mh.js` → `routes/10.17.87.244/.../manpower/manhour.js`. Several sub-routers are mounted under more than one prefix (`/manpower` = `/mh`, `/productivity` = `/attendance`, `/mh/p1_status` = `/mh/p1_manpower_status`, and some at `/` as well), so check the aggregator before renaming paths. `Config/Main/smart-ot/`, `smart-scan-in-out/` and `Smart_Eworking_User_Pasword/` exist but are not mounted in `app.js`.

**Admin auth.** Viewing data needs no login. A Manpower admin logs in at `.../mh/auth/login` and receives an HMAC-signed token that expires after 8 hours. The `requireAdmin` middleware in `manpower/auth.js` checks that token, but only `manhour.js` uses it. Productivity admin login (`.../productivity/admin-login`) only returns `success: true`, and its write routes do no server-side check. New write endpoints should use `requireAdmin`. Both logins read `register_admin_users` in the `Test` database.

**Product names differ across tables.** Some tables store `prd_name` with `-` and some without, so strip `-` before comparing or joining. `outputbyprocess/gateProcess.js` does this when it filters output to gate processes (`smart.smart_pln_product_routing_list` rows where `gate_proc = 'Y'`).

**Background work starts at process boot:**
- `app.js` schedules an hourly `node-cron` job, `runDailyCostProcess` (smt-reject cost sync), and also runs it once on startup.
- `services/productivity/snapshotScheduler.js` defines `initSnapshotScheduler()` (daily 09:00 Bangkok-time Excel folder sync, manpower/output snapshots, period summary rollup), but **nothing currently calls it**, so these jobs do not run automatically. The sync functions are only triggered through API routes such as `attendanceRoutes.js` and `productivitySettingRoutes.js`. A second, older `initSnapshotScheduler` also exists in `snapshotManager.js`.

**Realtime:**
- `websocket.js` attaches a `ws` server at `/ws` to the HTTP server. Call `broadcast()` to push to every client.
- The manhour feature uses Server-Sent Events instead: `GET .../manhour/events`. Writes call `broadcastManhourChange()`, and the frontend listens in `useManhourServerEvents.ts`.

**Caching:**
- `Utility/persistentCache.js` writes JSON to `.server-cache/` at the backend root (gitignored).
- `Utility/apiCache.js` and `cacheManager.js` hold in-memory caches.
- Manhour writes must call `clearManhourDataCache()`.

**Uploaded images** are served from `D:/img` on Windows and `/app/images` on Linux, at `/api/get-img`.

## Frontend architecture

- Routing lives in `src/routes/config.tsx`. It defines `BASE = "/production-status"` and an `allRoutes` array of lazily loaded pages, along with their menu label and icon metadata. `AppRoutes.tsx` renders every route inside `Layout/LayoutDrawer`. `allRoutes` is assembled from group arrays (`routes`, `routes_wip`, `routes_man`, `routes_productivity`, …). To add a page, add a `React.lazy` import and an entry in one of those groups. A new group must also be added to `allRoutes` and to `Layout/LayoutDrawer/Drawer.Config/DrawerMenu.tsx`.
- Pages live in `src/pages/<Feature>/`. Most have their own `api/`, `components/`, `hooks/`, and `utils/` subfolders. `OUTPUT/`, `Productivity/`, and `WIP/` instead group sub-pages, each with its own entry file (`Page.tsx`, `gwip.tsx`, `hwip.tsx`). The Manpower page offloads heavy aggregation to a Web Worker (`aggregation.worker.ts`).
- The `@` import alias maps to `src/`.
- API base URL: **always set `VITE_API_BASE_URL`, ending in `/api_p1/production_status`**, because pages append paths such as `/mh/manhour` to it.
  - `src/utils/apiConfig.ts` → `getApiBaseUrl()` falls back to `<current host>:<VITE_API_PORT or 8080>/api` (or to `/api_p1/production_status` when the current URL contains that path). The backend serves no production-status routes under `/api`, so this fallback does not work.
  - Some pages read `VITE_API_BASE_URL` directly in their own `api/config.ts`, with different fallbacks: `Manpower` has none (it builds `undefined/mh/...`), `WIP/*` falls back to `""`, and `P1ManpowerStatus` falls back to `<host>:8085/api_p1/production_status`.
- `dev-dist/` contains generated PWA service-worker output, because `devOptions.enabled` is on. Do not hand-edit it.

## Logic duplicated across both projects

Line-group / VDS-formula definitions exist in two places: `smart-backend-88-62/Utility/lineGroups.js` and `Frontend-production-status/src/pages/Manpower/config/lineGroups.ts`. Manpower aggregation logic is likewise duplicated, in `Utility/manpowerAggregation.js` and `pages/Manpower/aggregation.ts`. When you change line classification or aggregation, update both copies.
