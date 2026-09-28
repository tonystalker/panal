# Personal Analytics — task tracker

Source of truth for **what to build**: `plan.md`.  
This file tracks **progress**. `context.md` tracks **how it was done** (changelog, errors, tradeoffs).

**Status legend:** `[ ]` not started · `[~]` in progress · `[x]` done · `[-]` deferred (out of V1 / after two-week test)

**Working rule:** after every completed feature, (1) mark tasks here, (2) append a changelog entry in `context.md`, (3) commit with a focused message. Do not batch unrelated features into one commit.

---

## Current focus

- [x] Project tracking files (`TASKS.md`, `context.md`) derived from `plan.md`
- [ ] Milestone 0 — product spec, schema, export format
- [ ] Milestone 1 — offline personal tracker (core PWA)

V2+ work (Milestones 4–7) stays deferred until the two-week personal-use test.

---

## Milestone 0 — product specification and durable local schema

- [x] Write a one-page product brief (promise, V1 success criterion, deferred list)
- [ ] Define personal success metrics (e.g. five logged days/week; dashboard loads offline)
- [ ] Wireframes (Figma or code) for Today, Dashboard, Connectors
- [ ] Dexie `version(1)` schema for all V1 entities + documented migration policy
- [ ] Decide encrypted export file format (version, envelope, schema validation)
- [ ] Sample backup fixture + import test plan

---

## Milestone 1 — offline personal tracker

### Scaffold and platform

- [ ] Scaffold Next.js 15+ App Router, TypeScript, Tailwind CSS
- [ ] Add shadcn/ui
- [ ] Configure PWA manifest + service worker (installable, offline after first load)
- [ ] Tooling: ESLint, Prettier, strict TypeScript, Zod, Vitest, Playwright
- [ ] App shell + five routes: Today, Dashboard, Calendar, Connectors, Settings
- [ ] Timezone-aware date helper (`YYYY-MM-DD` in user timezone; event timestamps separate)

### Local data layer

- [ ] Dexie database: UserProfile, DailyLog, TaskTemplate, TaskInstance, ManualMetric, ConnectorConnection, MetricEvent, DashboardWidget
- [ ] Client-generated UUIDs, immutable IDs, schema version from day one
- [ ] Indexes for idempotent connector imports `(connectionId, metricKey, date, sourceEventId)`
- [ ] Repositories + Zod validation at write/import boundaries
- [ ] Seeded demo data behind explicit “Load demo data” (not auto-injected)
- [ ] Soft-delete fields prepared for later sync (no cloud yet)

### Today page

- [ ] One DailyLog per date; note field
- [ ] Create, edit, reorder, complete, skip, delete daily tasks
- [ ] Binary and quantitative tasks (`title`, `targetValue`, `completedValue`, `unit`, `status`)
- [ ] Task completion = completed count / planned count (e.g. 3/6 → 50%)
- [ ] Target progress shown separately (e.g. 3 of 10 → 30%); incomplete quantitative ≠ failed
- [ ] Manual metrics: exercise, DSA problems, mobile usage minutes
- [ ] Live progress on Today

### Dashboard (manual metrics first)

- [ ] Date range selector (7 / 30 / 90 / custom)
- [ ] Task-completion-percent line (not raw count alone)
- [ ] Manual metric charts (exercise, DSA, mobile minutes) with sensible defaults
- [ ] Custom SVG calendar heatmap for streaks
- [ ] Explicit axes/units; empty vs zero per missing-data policy
- [ ] Loading / empty / error states; no combined productivity score
- [ ] Daily detail panel: planned vs completed vs connector records (connectors later)

### Calendar

- [ ] Day-by-day history
- [ ] Streaks and concise daily summary
- [ ] Navigate to a day’s Today/log view

### Settings (local privacy)

- [ ] Preferences: timezone and display options
- [ ] Privacy copy: local-first, no account, no server personal data
- [ ] Readable JSON + CSV export
- [ ] Encrypted JSON backup export/import (passphrase / recovery phrase)
- [ ] Validate backup schema/version before replace or merge
- [ ] Delete local data
- [ ] Web Crypto AES-GCM envelopes for backup; interfaces suitable for later sync
- [ ] No plaintext credentials in localStorage, URLs, logs, or error reports

### Milestone 1 tests and polish

- [ ] Unit: task percentages, target progress, date/timezone boundaries
- [ ] Unit: crypto envelope round trip
- [ ] E2E: complete tasks; reload retains data; offline after first load
- [ ] Polished empty states; restrained dashboard UI
- [ ] README: setup, Vercel, PWA/offline check, backup restore (example env only)

**Acceptance:** works fully without network after first load; reload retains data; 3 of 6 tasks shows 50% task completion.

---

## Milestone 2 — GitHub + two-week personal-use test

- [ ] Connector types + `MetricEvent` normalization (`lib/connectors`)
- [ ] Generic adapter interface; no marketplace / catalog UI
- [ ] Mocked GitHub provider for development
- [ ] GitHub settings panel: connect, configure, sync, reconnect, disconnect
- [ ] Last successful sync + actionable error state
- [ ] PAT (owner fine-grained token) in local encrypted vault — V1 private build
- [ ] Optional OAuth+PKCE path later; never store token in localStorage / query / logs
- [ ] User choice: include private-repo activity or not
- [ ] GraphQL contributions collection (not scraping the graph)
- [ ] Normalize: `github.contributions`, `github.commits`, `github.pull_requests`, `github.active`
- [ ] Source refs + fetched timestamp; merge/replace on re-sync
- [ ] 7–30 day preview + confirm before first persist
- [ ] Show provider latency (GitHub is not real-time)
- [ ] Encrypt credentials before persistence
- [ ] Disconnect: wipe credentials; user-selected policy for historical imports
- [ ] Default GitHub contribution bar widget
- [ ] Device-side fetch only (no server connector jobs)

**Acceptance:** GitHub metrics appear in dashboard widgets; disconnect follows chosen history policy.

**Personal-use gate (not code):** use daily for two weeks; log inconveniences, unused features, missing pieces in `context.md`.

---

## Milestone 3 — LeetCode and chart customization (after usage test)

- [ ] Username-based LeetCode adapter; mocked data in development
- [ ] Graceful failure; no HTML scraping
- [ ] Manual DSA fallback remains durable
- [ ] Normalize: `leetcode.accepted`, `leetcode.easy`, `leetcode.medium`, `leetcode.hard`, `leetcode.active`
- [ ] LeetCode panel: connect/configure/sync/reconnect/disconnect, last sync, errors
- [ ] Widget config: chart type, range, aggregation, goal line, reorder/hide, rolling average, color, title
- [ ] Chart types: line, bar, area, calendar heatmap — presentation only, not data mutation
- [ ] Charts from metric definitions (no `if connector === "github"` in dashboard)
- [ ] Keyboard-accessible charts + tabular alternative under each chart
- [ ] Default widgets: mobile line, GitHub bar, LeetCode/DSA bar, task-completion line
- [ ] E2E: change a widget chart type; connect mocked GitHub

**Acceptance:** GitHub as bar and LeetCode as line with no connector-specific dashboard code.

---

## Milestone 4 — decide whether V2 sync is worth building

Answer from real use, then record in `context.md`:

- [ ] Did you switch devices often enough that export/import is painful?
- [ ] At least two weeks of complete daily logs?
- [ ] GitHub/LeetCode panels reliable?
- [ ] Go / no-go for accounts, encrypted cloud backup, and sync

If no: keep improving V1 daily loop. Do not start Milestone 5.

---

## Milestone 5 — encrypted backup, sign-in, V2 sync (deferred)

- [-] Optional authentication (Supabase Auth or Clerk)
- [-] Client-side encryption, recovery key, encrypted backup upload/download
- [-] Restore onboarding on a new device
- [-] Security tests: wrong key fails, tamper fails, nonce uniqueness, migration restore
- [-] Account deletion + documented metadata policy
- [-] Ciphertext-only server storage; no passphrase or plaintext DEK uploaded
- [-] Explicit recovery choice: recovery key / secondary device / no recovery
- [-] Account password separate from vault passphrase

---

## Milestone 6 — multi-device sync and reliability (deferred)

- [-] Encrypted change envelopes (`SyncEnvelope`) instead of whole-vault-only
- [-] Pull/push cursor, idempotency, deletion/tombstones, compact later
- [-] Documented conflict rules (tasks, metrics, notes, widgets)
- [-] Sync on open, focus, after mutation, modest interval while active
- [-] Connection health + manual repair/re-sync
- [-] Error monitoring that redacts user data
- [-] `/api/health` (reachability only)
- [-] Rate limits, RLS, no plaintext in logs

---

## Milestone 7 — Android companion (optional, deferred)

- [-] Kotlin app, `PACKAGE_USAGE_STATS` with clear explanation
- [-] Local daily total screen time (not per-app trail by default)
- [-] Aggregates into encrypted vault; PWA works without companion
- [-] iOS usage stays manual entry

---

## Deployment, CI, reliability (as V1 ships)

- [ ] GitHub repo with branch protection and CI (lint, typecheck, unit, Playwright smoke)
- [ ] Vercel project on `main`; custom domain + HTTPS when ready
- [ ] GitHub OAuth app only if V1 uses OAuth; else local PAT
- [ ] Vercel secrets never committed (`GITHUB_*`, `SENTRY_DSN`; no Supabase until V2)
- [ ] Preview checks: PWA install/offline, backup import
- [ ] Post-deploy health for `/` and PWA assets
- [ ] CSP, timeouts, exponential backoff, user-facing retry for connectors
- [ ] Immutable release tags + Dexie migration records

---

## Explicit non-goals (do not schedule)

- Connector marketplace / generic plugin catalog / user JS on servers
- Accounts, Supabase, Postgres, server cron, Edge Functions before two-week test
- Combined productivity/consistency score
- Social feed, leaderboard, sharing on by default
- Automatic iOS Screen Time
- AI advice on private logs
- Windows desktop app or native Android app as the primary V1 client

---

## Completion log

| Date       | Feature / commit                  | Tasks closed  |
| ---------- | --------------------------------- | ------------- |
| 2026-09-22 | Tracking files + project git repo | tracker setup |
| 2026-09-29 | Product brief (`docs/product-brief.md`) | Milestone 0 — product brief |
