# Runbook

Deployment, monitoring, common issues, and rollback for Pockode.

---

## 1. Deployment

### Prerequisites

- **Release build:** Go (see `server/.go-version`), Node.js (see `web/.node-version`), npm.
- **Docker:** Docker and Docker Compose.

### Option A: Docker (recommended for self-hosted)

1. Set required env: `AUTH_TOKEN`.
2. Optional: set `GIT_ENABLED`, `REPOSITORY_*`, `GIT_USER_*` for git init.
3. Run:

   ```bash
   export AUTH_TOKEN=your-secret-token
   docker compose up -d
   ```

4. App listens on `PORT` (default 80) → container 8080. Workspace: volume `workspace-data`; Claude config: `claude-config`.

### Option B: Binaries (GitHub Release)

1. Create a tag: `git tag v1.2.3` (and push).
2. GitHub Actions (`.github/workflows/release.yml`) runs on tag push:
   - Runs `VERSION=${GITHUB_REF_NAME} ./scripts/build.sh`.
   - Uploads `dist/*` to the GitHub Release.
3. Download the right binary from the release (e.g. `pockode-linux-arm64`).
4. Run manually:

   ```bash
   AUTH_TOKEN=your-token ./pockode-linux-arm64
   ```

### Option C: Local build

```bash
./scripts/build.sh
# Binaries in dist/ (or OUTPUT_DIR)
AUTH_TOKEN=your-token ./dist/pockode-<os>-<arch>
```

---

## 2. Monitoring and health

### Health check

- **Endpoint:** `GET /health` (no auth).
- **Expected:** 200 OK.
- **Docker:** HEALTHCHECK pings `/health` every 30s (start period 10s, 3 retries).

### Logs

- **Location:** `DATA_DIR/server.log` when not in dev (default `WORK_DIR/.pockode/server.log`).
- **Format:** `LOG_FORMAT=json` or `text`; level via `LOG_LEVEL` (`debug`, `info`, `warn`, `error`).
- **Docker:** `docker compose logs -f pockode`.

### Alerts

No built-in alerting. To monitor:

- HTTP: periodically request `http://<host>:<port>/health`.
- Process: ensure the server (or container) is running and restarts on failure (`restart: unless-stopped` in compose).

---

## 3. Common issues and fixes

| Issue | Cause | Fix |
|-------|--------|-----|
| 401 on API or WebSocket | Missing or wrong `AUTH_TOKEN` | Set `AUTH_TOKEN` in client (e.g. frontend env) and server to the same value. |
| Connection refused | Wrong port or server not running | Check `SERVER_PORT` (default 9870; dev often 8080). Ensure server is up and no firewall blocking. |
| Blank or wrong frontend | Dev: proxy target wrong | Set `SERVER_PORT` in web env to match backend (e.g. 8080 in dev). |
| Docker: permission / workspace | Volume owned by root | Run with correct user or chown `/workspace` in container. |
| Claude CLI errors in container | Claude not installed or not in PATH | Dockerfile installs Claude in image; ensure `PATH` includes `~/.local/bin`. |
| Git init fails (GIT_ENABLED=true) | Missing repo URL or token | Set `REPOSITORY_URL`, `REPOSITORY_TOKEN`, `GIT_USER_NAME`, `GIT_USER_EMAIL`. |

---

## 4. Rollback

### Docker

- Pin image tag: use `TAG=v1.2.0` (or another tag) in `docker-compose.yml` or `docker compose run`.
- Rollback: change `TAG` to previous version and `docker compose up -d`.

### Binaries (no Docker)

- Re-download previous release binary from GitHub Releases and replace the running binary; restart the process.

### Data

- Sessions and settings live in `DATA_DIR` (default `WORK_DIR/.pockode`). No automatic backup; back up that directory if you need to restore state.

---

*Source of truth: `docker-compose.yml`, `server/Dockerfile`, `.github/workflows/release.yml`, `scripts/build.sh`, `server/main.go`.*
