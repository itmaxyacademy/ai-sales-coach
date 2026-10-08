# Audit 001 follow-up

Date: 2026-09-29

## Anti-Slop findings

1. **R-32/R-26 — Resolved.** The briefing now uses dialog semantics, traps keyboard focus, restores focus, handles Escape, and provides an explicit cancel action.
2. **R-35 — Partially verified.** Backend TypeScript and the frontend production build pass. Runtime checks verified manager pages with an authenticated browser session; briefing and replay interactions were not exercised.
3. **R-04 — Resolved.** Replay event markers use descriptive Indonesian labels and selectable turns expose pressed state and accessible names.
4. **Orphan briefing sessions — Resolved.** Sessions begin with `hasStarted=false`; beginning resets `startedAt`, cancel/unload can abandon the empty session, and the periodic sweep abandons stale empty sessions while releasing their training assignment.
5. **Shared course language — Resolved.** The language endpoint updates only the owned session. New sessions reuse the user's most recent language for that course, falling back to the course default.
6. **Feature flags — Resolved.** Full duplex interruption, live filler alerts, and hands-free auto-send now read the exported feature flags. The documented default is enabled, with environment variables available to turn features off.
7. **Concurrent hint generation — Resolved.** A conditional database reservation precedes model work, uses an expiring lease, and is cleared after success or failure. Hint count and cooldown timestamps are committed atomically.
8. **Stuck-session pagination — Resolved.** The sweep queries due states in ordered batches of 100 using a cursor.

## Ponytail findings

- **Resolved:** manager renders the replay directly; the component handles empty timelines.
- **Resolved:** language ownership lookup selects only the session id.
- **Resolved:** unused `maxHints` response field removed.

## Other audit notes

- Performance dashboard latency already measures a health-endpoint round trip; no random latency expression was present, so no change was needed.
- An onboarding route already exists; no additional onboarding work was part of these findings.

## Verification

- Backend `npm run build`: passed.
- Frontend `npm run build`: passed.
- `git diff --check`: passed.
- Browser: login screen rendered; protected manager/session flows remain unverified without an authenticated session and running backend.

## Local runtime follow-up

- `prisma migrate status` reports both migrations above as pending on the configured nonlocal Supabase database.
- The API sweep fails with Prisma `P2022`: `sessions.has_started` does not exist. Admin course listing also reads the missing `courses.default_language`; admin session listing reads the new session columns.
- Manager course list still loads because it selects existing columns. Manager course detail fails, and manager session listing receives a server error. Session history and other implicit full-session queries are exposed to the same missing-column issue.
- Manager session listing now renders the API error instead of silently showing “No sessions found”.
- Both migrations were applied to the configured Supabase database after user approval; `prisma migrate status` confirms the schema is up to date.
- Browser verification after migration: manager course detail loads and the team session list returns rows without the previous internal server error.
