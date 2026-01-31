# Dead Code Analysis Report

**Generated:** 2026-01-31  
**Scope:** `web/` (TypeScript/React), `server/` (Go)

## Tools Used

| Tool       | Scope   | Result |
|-----------|---------|--------|
| **knip**  | web/    | Skipped (requires full `npm install` and vite config load; failed with module resolution in npx context) |
| **depcheck** | web/ | Run via `npx depcheck --json` |
| **ts-prune** | web/ | Run via `npx ts-prune --project tsconfig.app.json` |
| **Go**    | server/ | No dedicated dead-code tool run; `go build ./...` succeeds |

---

## 1. depcheck (web) – Unused / Missing Dependencies

### Unused dependencies (reported by depcheck)

| Package | Severity | Note |
|---------|----------|------|
| `tailwindcss` | **CAUTION** | Likely used by `@tailwindcss/vite` or Tailwind config; do not remove without verifying build. |
| (none else) | — | Other deps are in use. |

### Unused devDependencies (reported by depcheck)

| Package | Severity | Note |
|---------|----------|------|
| `@biomejs/biome` | **CAUTION** | Used by lint/format scripts; keep. |
| `@tailwindcss/typography` | **CAUTION** | May be used by Tailwind; verify before removing. |
| `jsdom` | **CAUTION** | Used by Vitest/jsdom environment; keep. |
| `typescript` | **DANGER** | Required for build; do not remove. |

**Recommendation:** Treat depcheck “unused” for these as false positives; no dependency removal proposed.

### Missing dependencies (reported by depcheck)

| Package | Files | Severity | Note |
|---------|--------|----------|------|
| `shiki` | `web/src/lib/shikiUtils.tsx` | **CAUTION** | Import from `"shiki"`; may be provided by `react-shiki` or peer. Verify with `npm ls shiki`. |
| `hast` | `web/src/components/Chat/MarkdownContent.tsx` | **CAUTION** | Type import `Element` from `"hast"`; often from `@types/hast` or bundled by `react-markdown`. Add type dependency if needed. |

**Recommendation:** Confirm with `npm ls shiki` and add `@types/hast` (or correct package) if type errors occur; no code deletion.

---

## 2. ts-prune (web) – Unused Exports

### SAFE – Proposed for removal

| Location | Export | Reason |
|----------|--------|--------|
| `web/src/hooks/useGitStatus.ts` | `resolveGitIndexPath` | Exported function; no references in codebase. Dead helper. |

### CAUTION – Do not remove without review

| Location | Export | Reason |
|----------|--------|--------|
| `web/src/lib/worktreeStore.ts` | `useIsGitRepo` | Exported hook; no current imports. May be intended public API. |
| `web/src/lib/worktreeStore.ts` | `resetWorktreeStore` | Exported function; no current imports. Could be used by tests or future code. |
| `web/src/types/message.ts` | `WorktreeDeletedNotification` | RPC/contract type; no TS references. Documents server contract. |
| `web/src/types/message.ts` | `SessionListUnsubscribeParams` | RPC/contract type; no TS references. Documents server contract. |
| `web/src/types/message.ts` | `ChatMessagesSubscribeParams` | RPC/contract type; no TS references. Documents server contract. |
| `web/src/types/message.ts` | `ServerMethod` | RPC type; duplicates literal union in `ServerNotification`. Could be used for narrowing; keep. |

### Informational – Barrel / “used in module”

- ts-prune reports many exports as “(used in module)” (types, options, or internal use). No action.
- Barrel files (`index.ts`) re-export for consumers; keep as-is.

---

## 3. Server (Go)

- **Build:** `go build ./...` succeeds.
- **Dead code:** No static analysis tool (e.g. staticcheck with unused rules) was run. No Go deletions proposed.

---

## 4. Proposed Safe Deletion (single change)

Only one change meets the “safe deletion” bar:

1. **Remove dead function `resolveGitIndexPath`** from `web/src/hooks/useGitStatus.ts`.
   - Exported, never imported or called.
   - Removing it cannot break callers.

**Verification:** Run after change:

- `cd web && npm run build && npm run test`
- `cd server && go build ./... && go test ./...`

---

## 5. Summary

| Category        | Count | Action |
|-----------------|-------|--------|
| SAFE (deletion) | 1     | Remove `resolveGitIndexPath` (see above). |
| CAUTION         | 6+    | Review only; do not delete without tests and product confirmation. |
| DANGER          | 0     | — |
| Dependency trim | 0     | No dependency removal recommended. |

**Applied:** The single SAFE deletion was applied: `resolveGitIndexPath` (and unused `GitStatus` import) removed from `web/src/hooks/useGitStatus.ts`.

**Verification:** Server `go build ./...` passes. Web `npm run build` was not run successfully in this environment (missing type definitions for vite/node). Please run locally: `cd web && npm run build && npm run test` and rollback the edit to `useGitStatus.ts` if anything fails.
