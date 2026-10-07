# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository layout

Two independent npm projects with no root `package.json`. Run commands from inside each folder.

- `Frontend-production-status/` is the "Production Status" dashboard for the factory (React 19 + TypeScript + Vite 7, MUI 7, Tailwind 4 + daisyUI, ECharts/Recharts). It ships as a PWA served under `/production-status/`.
- `smart-backend-88-62/` is an Express 4 (CommonJS) API backed by PostgreSQL (`pg`) and MariaDB. The frontend talks to it. Its README points at the upstream repo `gitlab.com/fujikura-k1/smart-backend-k1`.

Code comments and log messages are mostly in Thai.

## Commands

Frontend (`Frontend-production-status/`):
- `npm run dev`: Vite dev server (`host: true`, so it is reachable on the LAN)
- `npm run build`: `tsc -b && vite build`. This is the only type check; there is no separate typecheck script.
- `npm run lint`: ESLint over the project
- `npm run dev:server` / `npm run start:server`: run a small standalone Express server (`server/server.js`, port 5001) with `--env-file=.env`. Note: it imports `./routes/*.js` files that are not in the repo, so it will not start as checked in.

Backend (`smart-backend-88-62/`):
- `npm start`: runs `node ./bin/www`. The port comes from `PORT` in `.env`; there is no default.
- Production runs in Docker through `Config-8080/docker-compose.yml` (`node:25-alpine`, the repo mounted at `/app`, on the external `smart-reverse-proxy-network`, `TZ=Asia/Bangkok`).

Neither project has a test suite.

## Backend architecture

**Two-layer routing.** `app.js` mounts "Main" routers from `Config/Main/**`. These are thin aggregators that only `app.use()` sub-routers. The actual handlers live under `routes/<db-host-ip>/...`, grouped by the database server they query:
- `routes/10.17.87.244/`: IoT/SMT SPC data plus the `smart` DB. Production-status features live in `smart/smart/productionstatus/{manpower,productivity,wip,outputoverall,outputbyprocess,outputbyproduct}`.
- `routes/10.17.88.61/`: fin_cer (training certificates), 3D requests, smt-reject.
- `routes/10.17.100.193/`: OT / HR / scan-in-out (MariaDB).

Each host folder has a `config.js` that exports the `pg`/`mariadb` connection pools (`pool_iot`, `pool_smart`, `pool_smart61`, `pool_ot`, `pool_test`, …). The credentials come from `.env` variables named per host, such as `POSTGRES_HOST_NAME_10_17_87_244`. Handlers `require` the pool from their host's `config.js`.

To add an endpoint, write the handler under `routes/<ip>/...`, then wire it in the matching `Config/Main/.../*.js` aggregator. Example path: `/api_p1/production_status` → `Config/Main/production_status/production_status.js` → `manpower/mh.js` → `routes/10.17.87.244/.../manpower/manhour.js`. Several sub-routers are mounted under more than one prefix (for example `/manpower` and `/mh`, `/productivity` and `/attendance`, and `/` for some), so check the aggregator before renaming paths.

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

- Routing lives in `src/routes/config.tsx`. It defines `BASE = "/production-status"` and an `allRoutes` array of lazily loaded pages, along with their menu label and icon metadata. `AppRoutes.tsx` renders every route inside `Layout/LayoutDrawer`. To add a page, add a `React.lazy` import and an entry in `allRoutes`.
- Pages live in `src/pages/<Feature>/`. Each one has its own `api/`, `components/`, `hooks/`, and `utils/` subfolders. The Manpower page offloads heavy aggregation to a Web Worker (`aggregation.worker.ts`).
- The `@` import alias maps to `src/`.
- API base URL:
  - `src/utils/apiConfig.ts` → `getApiBaseUrl()` resolves it in this order: `VITE_API_BASE_URL` first. Failing that, it uses `<current host>:<VITE_API_PORT or 8080>/api`, or the `/api_p1/production_status` path when the app is deployed under that path.
  - Some pages (for example `pages/Manpower/api/config.ts`) read `VITE_API_BASE_URL` directly.
- `dev-dist/` contains generated PWA service-worker output, because `devOptions.enabled` is on. Do not hand-edit it.

## Logic duplicated across both projects

Line-group / VDS-formula definitions exist in two places: `smart-backend-88-62/Utility/lineGroups.js` and `Frontend-production-status/src/pages/Manpower/config/lineGroups.ts`. Manpower aggregation logic is likewise duplicated, in `Utility/manpowerAggregation.js` and `pages/Manpower/aggregation.ts`. When you change line classification or aggregation, update both copies.
