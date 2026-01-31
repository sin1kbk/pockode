# Security Review Report

**Date:** 2026-01-31  
**Scope:** Pockode (Go server + React web, WebSocket JSON-RPC, local/self-hosted)

---

## Executive Summary

The codebase follows solid security practices for a local/self-hosted app: no hardcoded secrets, constant-time token comparison, path traversal checks, and no sensitive data in logs. A few items are worth tightening if the app is ever exposed to untrusted users or the internet.

**Verdict:** No CRITICAL or HIGH issues that block deployment for the current local-only use case. MEDIUM/LOW items are documented for future hardening.

---

## 1. Secrets Management

### ✅ Good

| Item | Location | Notes |
|------|----------|--------|
| Auth token | `server/main.go` | From `AUTH_TOKEN` env or `--auth-token`; never hardcoded. |
| Git credentials | `server/git/git.go`, `docker-compose.yml` | `REPOSITORY_TOKEN` from env; written to `.git/.git-credentials` with `0600`. |
| .env | `.gitignore` | `.env`, `.env.local`, `.env.*.local`, `.env.production` ignored. |

### ⚠️ MEDIUM – Token storage (frontend)

| Item | Location | Description |
|------|----------|-------------|
| Token in localStorage | `web/src/lib/authStore.ts` | Auth token is stored in `localStorage` (`TOKEN_KEY = "auth_token"`). If an XSS bug exists, the token can be read. |

**Suggested fix (if exposing to untrusted users):** Prefer httpOnly cookies set by the server (e.g. login endpoint that sets a cookie). For the current local/single-user model this is acceptable; document the risk and consider moving to cookies if the app is later multi-user or public.

---

## 2. Authentication & Authorization

### ✅ Good

| Item | Location | Notes |
|------|----------|--------|
| Token comparison | `server/middleware/auth.go:30`, `server/ws/rpc.go:293` | `crypto/subtle.ConstantTimeCompare` used for token comparison (timing-safe). |
| HTTP auth | `server/middleware/auth.go` | Bearer token required; `/health` and `/ws` bypass (WebSocket does its own auth). |
| WebSocket auth | `server/ws/rpc.go` | First RPC must be `auth` with token; same constant-time check. |
| Error message | `server/ws/rpc.go:295` | Client gets generic "invalid token"; no detail leak. |

---

## 3. Input Validation & Path Traversal

### ✅ Good

| Item | Location | Notes |
|------|----------|--------|
| File/contents path | `server/contents/contents.go` | `ValidatePath` rejects `..`, absolute paths; ensures resolved path stays under `workDir`. |
| Git path | `server/git/git.go` | `validatePath` rejects empty, absolute, and `..`; used for diff/read paths. |
| RPC file paths | `server/ws/rpc_file.go`, `server/ws/rpc_git.go` | Use `contents.ValidatePath` before using paths. |
| Worktree name | `server/worktree/registry.go:120-122` | `worktreePath` checked with `strings.HasPrefix(worktreePath, worktreesDir+separator)` to prevent path escape. |

---

## 4. Command / Exec Safety

### ✅ Good

| Item | Location | Notes |
|------|----------|--------|
| Git commands | `server/git/git.go`, `server/worktree/registry.go` | `exec.Command` with explicit args (no shell); paths and branch names passed as single arguments. |
| Agent CLI | `server/agent/claude/claude.go`, `server/agent/cursoragent/cursoragent.go` | CLI binary + fixed args; user/AI content sent via stdin (JSON), not as exec args. |

No user-controlled shell or `exec` string observed.

---

## 5. XSS & User-Provided Content

### ✅ Good

| Item | Location | Notes |
|------|----------|--------|
| Tool result (ANSI) | `web/src/components/Chat/ToolResultDisplay.tsx:130-136` | Uses `ansi_up.ansi_to_html(result)`; comment and biome-ignore state output is safe. |
| Markdown / code | React | Rendered via React / Markdown libs; no raw HTML from user without sanitization in reviewed paths. |

### ⚠️ MEDIUM – SVG from Mermaid

| Item | Location | Description |
|------|----------|-------------|
| Mermaid SVG | `web/src/components/Chat/MermaidBlock.tsx:73` | `dangerouslySetInnerHTML={{ __html: svg }}` with SVG from `mermaid.render(code)`. `code` comes from message content (AI/user). Theoretically SVG could contain scripts. |

**Suggested fix:** Sanitize SVG (e.g. strip `<script>`, event handlers, `javascript:` URLs) before setting `__html`, or use a safe subset / CSP. For local/single-user use risk is lower; still recommended if content is ever untrusted.

---

## 6. Sensitive Data in Logs & Errors

### ✅ Good

| Item | Location | Notes |
|------|----------|--------|
| Prompt content | `server/ws/rpc_chat.go:73`, agent code | Only length logged (`"length", len(params.Content)`); no prompt text. |
| Token | Not logged | Token never written to logs. |
| RPC errors | `server/ws/rpc.go` | Client gets generic messages ("invalid token", "invalid params"); no stack or internal detail. |
| Logger | `server/logger/logger.go` | Standard slog; no custom logic that logs secrets. |

---

## 7. Rate Limiting & CORS

### ⚠️ LOW

| Item | Description |
|------|-------------|
| Rate limiting | No rate limiting on HTTP or WebSocket. Acceptable for local/single-user; consider adding if the server is exposed to the internet or multiple untrusted clients. |
| CORS | Not explicitly configured in the reviewed Go server (default behavior). For local-only this is fine; if you add a separate frontend origin, configure CORS explicitly. |

---

## 8. Dependencies

### Action

| Item | Action |
|------|--------|
| npm audit | Run `cd web && npm audit` and fix reported vulnerabilities. |
| go mod | Run `cd server && go mod verify` and keep dependencies updated. |
| Lock files | `package-lock.json` and `go.sum` should remain committed. |

---

## 9. Pre-Deployment Checklist (Summary)

| Category | Status |
|----------|--------|
| Secrets in env only | ✅ |
| No secrets in logs | ✅ |
| Token comparison timing-safe | ✅ |
| Path traversal prevented | ✅ |
| Exec/command safety | ✅ |
| XSS (general) | ✅ (Mermaid SVG: ⚠️ MEDIUM) |
| Token in localStorage | ⚠️ MEDIUM (acceptable for local) |
| Rate limiting | ⚠️ LOW (optional for local) |
| Error messages generic | ✅ |
| .env in .gitignore | ✅ |

---

## 10. Recommendations

1. **Keep current posture** for local/self-hosted: no CRITICAL/HIGH issues; safe to deploy as-is for the intended use.
2. **If exposing to untrusted users or internet:**  
   - Move auth token to httpOnly cookies.  
   - Sanitize Mermaid SVG (or restrict diagram input).  
   - Add rate limiting and explicit CORS.
3. **Operational:** Run `npm audit` and `go mod verify` periodically; fix known vulnerabilities and keep dependencies up to date.

---

*Report generated per security-review skill and OWASP-oriented checklist.*
