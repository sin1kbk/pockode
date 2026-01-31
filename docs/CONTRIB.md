# Contributing / Development Guide

Development workflow, scripts, environment, and testing for Pockode.

---

## 1. Scripts Reference

Source of truth: `package.json` (root and `web/`).

### Root (monorepo)

| Script | Command | Description |
|--------|---------|-------------|
| `dev` | `npm run dev` | Start server and web dev servers concurrently (concurrently; kill-others). |
| `dev:server` | `cd server && go run .` | Run Go server only. |
| `dev:web` | `cd web && npm run dev` | Run Vite dev server only. |

### Web (`web/`)

| Script | Command | Description |
|--------|---------|-------------|
| `dev` | `vite` | Start Vite dev server. |
| `build` | `tsc -b && vite build` | Type-check and production build. |
| `lint` | `biome check .` | Lint with Biome. |
| `format` | `biome format --write .` | Format with Biome. |
| `preview` | `vite preview` | Preview production build locally. |
| `test` | `vitest run` | Run tests once. |
| `test:watch` | `vitest` | Run tests in watch mode. |

### Make

| Target | Purpose |
|--------|---------|
| `make dev` | Run `scripts/dev.sh` — dev env vars + server + web (hot reload). Optional: `make dev AGENT=cursor-agent` (default: `claude`). |

### Scripts (shell)

| Script | Purpose |
|--------|---------|
| `scripts/dev.sh` | Export dev env vars and run `npm run dev` (backend + frontend). |
| `scripts/build.sh` | Build frontend into `server/static`, then cross-compile server for darwin/linux amd64/arm64; outputs to `dist/` (or `OUTPUT_DIR`). |

---

## 2. Environment Variables

There is no `.env.example` in the repo. Below is extracted from server code, `scripts/dev.sh`, and `docker-compose.yml`.

### Server (required)

| Variable | Required | Default | Description |
|----------|:--------:|--------|-------------|
| `AUTH_TOKEN` | ✓ | — | API authentication token. Also via `-auth-token`. |

### Server (optional)

| Variable | Default | Description |
|----------|--------|-------------|
| `SERVER_PORT` | `9870` | Server port (see `server/main.go` defaultPort). |
| `WORK_DIR` | `.` (current dir) | Working directory (project root). |
| `DATA_DIR` | `WORK_DIR/.pockode` | Data directory (sessions, settings, etc.). |
| `DEV_MODE` | `false` | If `true`, do not serve embedded SPA (use external Vite). |
| `LOG_FORMAT` | `text` | `json` or `text`. |
| `LOG_LEVEL` | `info` | `debug`, `info`, `warn`, `error`. |
| `LOG_FILE` | (production) `DATA_DIR/server.log` | Log file path; dev often uses stdout. |
| `AGENT` | `claude` | AI CLI backend: `claude` or `cursor-agent`. Overridable by `-agent`. |
| `IDLE_TIMEOUT` | `10m` | Worktree idle timeout (e.g. `30m`). |
| `GIT_ENABLED` | `false` | If `true`, enable git init and require git env vars. |
| `REPOSITORY_URL` | — | Git repo URL (when GIT_ENABLED). |
| `REPOSITORY_TOKEN` | — | PAT for git (when GIT_ENABLED). |
| `GIT_USER_NAME` | — | Git commit user name (when GIT_ENABLED). |
| `GIT_USER_EMAIL` | — | Git commit email (when GIT_ENABLED). |

### Dev script (`scripts/dev.sh`)

| Variable | Default | Description |
|----------|--------|-------------|
| `AUTH_TOKEN` | `dev-token` | Dev auth token. |
| `AGENT` | `claude` | AI CLI backend: `claude` or `cursor-agent`. |
| `WORK_DIR` | Project root | Resolved to absolute path. |
| `SERVER_PORT` | `8080` | Backend port for dev. |
| `WEB_PORT` | `5173` | Frontend port for dev. |
| `DEV_MODE` | `true` | Dev mode. |
| `DEBUG` | `true` | Debug flag. |
| `LOG_LEVEL` | `debug` | Log level for dev. |

### Web (Vite)

| Variable | Default | Description |
|----------|--------|-------------|
| `SERVER_PORT` | `8080` | Proxy target port (vite.config). |
| `WEB_PORT` | `5173` | Vite dev server port. |

---

## 3. Development Workflow

1. **Prerequisites**
   - Go (see `server/.go-version`).
   - Node.js ≥ 22 (see `web/.node-version`).
   - npm (for root and web).

2. **Install**
   - Root: `npm install` (for concurrently).
   - Web: `cd web && npm ci`.
   - Server: no install step (Go).

3. **Run locally**
   - **Dev:** `make dev` or `./scripts/dev.sh` (sets env and runs `npm run dev`).
   - **Option B:** `AUTH_TOKEN=your-token DEV_MODE=true npm run dev` (server + web).
   - **Option C:** Terminal 1: `npm run dev:server` with `AUTH_TOKEN` and `DEV_MODE=true`; Terminal 2: `npm run dev:web`.

4. **Open**
   - Frontend: http://localhost:5173 (or `WEB_PORT`).
   - Backend: http://localhost:8080 (or `SERVER_PORT`; default port in main is 9870 when not overridden).
   - Use the auth token you set (e.g. `dev-token` when using `scripts/dev.sh`).

5. **Before commit**
   - Server: `cd server && gofmt -w . && go vet ./... && go test ./...`
   - Web: `cd web && npm run lint && npm run build && npm run test`

---

## 4. Testing

### Server

```bash
cd server
go test ./...
```

- Integration tests (Claude CLI, consumes API): `go test -tags=integration ./agent/claude -v`

### Web

```bash
cd web
npm run test
# or watch
npm run test:watch
```

### CI

- **Server:** `.github/workflows/server.yml` — gofmt, go vet, go test, go build on `server/**` changes.
- **Web:** `.github/workflows/web.yml` — npm ci, lint, test, build on `web/**` changes.

---

## 5. Project Layout

- `server/` — Go backend (API, WebSocket RPC, AI CLI integration). See `server/AGENTS.md`.
- `web/` — React frontend (Vite, Tailwind). See `web/AGENTS.md`.
- `scripts/` — `dev.sh`, `build.sh`.
- `docs/` — Design and runbooks (e.g. `websocket-rpc-design.md`, `RUNBOOK.md`).
- `site/` — Marketing site (Hugo).

---

*Single source of truth: `package.json` (root + web), `server/main.go` and `server/AGENTS.md`, `scripts/dev.sh`, `docker-compose.yml`.*
