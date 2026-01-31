# Code Review: Agent type display in header

**Scope:** Uncommitted changes (agent type display feature)  
**Reviewed:** 12 modified files + 1 new file

---

## Summary

| Severity | Count |
|----------|--------|
| CRITICAL | 0 |
| HIGH     | 0 |
| MEDIUM   | 1 |
| LOW      | 2 |

**Verdict: APPROVED for commit.** No CRITICAL or HIGH issues. No security vulnerabilities identified.

---

## Security (CRITICAL)

### Checked items
- **Hardcoded credentials / API keys / tokens:** None. No new secrets.
- **SQL injection:** N/A (no DB or user-controlled SQL).
- **XSS:** Server sends `agent` in auth result; frontend renders it as `{agentType}` inside a `<span>`. React escapes text content, and the value is server-controlled and restricted to `claude` | `cursor-agent` (validated in `main.go` via `agentType.IsValid()`). **No XSS risk.**
- **Input validation:** Backend only passes validated agent type into `NewRPCHandler`. Frontend does not accept user input for `agentType`; it comes from auth response. **Adequate.**
- **Path traversal:** N/A.
- **Insecure dependencies:** No new dependencies.

**Result:** No security issues.

---

## Code quality (HIGH)

### Checked items
- **Functions > 50 lines:** No new or extended functions exceed 50 lines.
- **Files > 800 lines:** No modified file exceeds 800 lines.
- **Nesting depth > 4:** No new deep nesting.
- **Missing error handling:** Backend test unmarshals auth result with explicit error check (`if err := json.Unmarshal(...)`). Auth path and store updates are consistent. **OK.**
- **console.log:** None in changed code.
- **TODO/FIXME:** None in changed code.
- **JSDoc for public APIs:** `MainContainer` and `ChatPanel` props are not documented. Project style does not require JSDoc for every component; acceptable as-is.

**Result:** No HIGH issues.

---

## Best practices (MEDIUM)

| # | Severity | File:Line | Issue | Suggested fix |
|---|----------|-----------|--------|----------------|
| 1 | MEDIUM | `web/src/components/Layout/MainContainer.tsx` | `agentType` is rendered as raw text. If the API ever exposed user-controlled or unvalidated data here, it would be a risk. Currently the value is server-validated (`claude` / `cursor-agent`). | No change required. If future work allows more values, keep validation on the server or sanitize/allowlist on the client before rendering. |

**Result:** One MEDIUM note; no change required for current, validated-only usage.

---

## Low / housekeeping

| # | Severity | File:Line | Issue | Suggested fix |
|---|----------|-----------|--------|----------------|
| 1 | LOW | — | New test file `web/src/components/Layout/MainContainer.test.tsx` is untracked. | Run `git add web/src/components/Layout/MainContainer.test.tsx` before commit so the new tests are versioned. |
| 2 | LOW | `web/src/components/Layout/MainContainer.tsx` | Optional: the `(agentType)` span could be marked `aria-hidden="true"` if the product decision is to treat it as decorative. | Optional. Current behavior (part of the heading) is acceptable for a11y. |

---

## Positive notes

- **Tests:** Backend `TestAuthResultIncludesAgent`, frontend “stores agentType from auth result”, and `MainContainer.test.tsx` cover the new behavior.
- **Consistency:** Agent type is added to auth result and WS state in one place each; reset and initial state include `agentType`.
- **Types:** `AuthResult` and `WSState` updated on both server and client; optional `agent?: string` keeps backward compatibility.
- **Theme:** Uses `text-th-text-muted` for the label; no hardcoded colors.

---

## Checklist before commit

- [x] No CRITICAL or HIGH issues
- [x] No security vulnerabilities
- [ ] Add `web/src/components/Layout/MainContainer.test.tsx` to the commit
- [ ] Run `go test ./server/...` and frontend tests (e.g. `npm run test`) if not already done

**Reviewer:** Code review (agent display feature)  
**Date:** 2026-01-31
