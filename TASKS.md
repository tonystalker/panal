# Personal Analytics — task tracker

Source of truth for **what to build**: `plan.md`.  
This file tracks **progress**. `context.md` tracks **how it was done** (changelog, errors, tradeoffs).

**Status legend:** `[ ]` not started · `[~]` in progress · `[x]` done · `[-]` deferred (out of V1 / after two-week test)

**Working rule:** after every completed feature, (1) mark tasks here, (2) append a changelog entry in `context.md`, (3) commit with a focused message. Do not batch unrelated features into one commit.

---

## Current focus

- [x] Project tracking files (`TASKS.md`, `context.md`) derived from `plan.md`
- [x] Milestone 0 — product spec, schema, export format
- [x] Milestone 1 — offline personal tracker (core PWA)
- [x] Milestone 2 — GitHub connector
- [x] Milestone 3 — LeetCode + chart customization
- [~] Milestone UI & Landing — Watermelon UI & Capitalio / Landing 01 Refactor (in progress)

---

## Milestone UI & Landing — Watermelon UI & Capitalio / Landing 01 Refactor

- [x] Import `capitalio-dashboard` registry item from Watermelon UI
- [x] Adapt app shell & sidebar navigation with typographic PA monogram
- [x] Refactor Dashboard with Capitalio data-first composition
- [x] Import and adapt `integrations-2` for Connectors
- [x] Refactor Today, Calendar, and Settings pages
- [ ] Import and adapt `landing-01` & `hero-8` (Landing hero & showcase)
- [ ] Import and adapt `feature-3` & scroll-driven product story
- [ ] Import and adapt `cta-4`, privacy section, and footer
- [ ] Import and adapt `auth-01` & `error-3` (Auth shell + error page)
- [ ] Responsive polish, accessibility, unit tests, and documentation


---

## Milestone 0 — product specification and durable local schema

- [x] Write a one-page product brief (promise, V1 success criterion, deferred list)
- [x] Define personal success metrics (e.g. five logged days/week; dashboard loads offline)
- [x] Wireframes (Figma or code) for Today, Dashboard, Connectors
- [x] Dexie `version(1)` schema for all V1 entities + documented migration policy
- [x] Decide encrypted export file format (version, envelope, schema validation)
- [x] Sample backup fixture + import test plan

---

## Milestone 1 — offline personal tracker

### Scaffold and platform

- [x] Scaffold Next.js 15+ App Router, TypeScript, Tailwind CSS
- [x] Add shadcn/ui
- [x] Configure PWA manifest + service worker (installable, offline after first load)
- [x] Tooling: ESLint, Prettier, strict TypeScript, Zod, Vitest, Playwright
- [x] App shell + five routes: Today, Dashboard, Calendar, Connectors, Settings
- [x] Timezone-aware date helper (`YYYY-MM-DD` in user timezone; event timestamps separate)

### Local data layer

- [x] Dexie database: UserProfile, DailyLog, TaskTemplate, TaskInstance, ManualMetric, ConnectorConnection, MetricEvent, DashboardWidget
- [x] Client-generated UUIDs, immutable IDs, schema version from day one
- [x] Indexes for idempotent connector imports `(connectionId, metricKey, date, sourceEventId)`
- [x] Repositories + Zod validation at write/import boundaries
- [x] Seeded demo data behind explicit “Load demo data” (not auto-injected)
- [x] Soft-delete fields prepared for later sync (no cloud yet)

### Today page

- [x] One DailyLog per date; note field
- [x] Create, edit, reorder, complete, skip, delete daily tasks
- [x] Binary and quantitative tasks (`title`, `targetValue`, `completedValue`, `unit`, `status`)
- [x] Task completion = completed count / planned count (e.g. 3/6 → 50%)
- [x] Target progress shown separately (e.g. 3 of 10 → 30%); incomplete quantitative ≠ failed
- [x] Manual metrics: exercise, DSA problems, mobile usage minutes
- [x] Live progress on Today

### Dashboard (manual metrics first)

- [x] Date range selector (7 / 30 / 90 / custom)
- [x] Task-completion-percent line (not raw count alone)
- [x] Manual metric charts (exercise, DSA, mobile minutes) with sensible defaults
- [x] Custom SVG calendar heatmap for streaks
- [x] Explicit axes/units; empty vs zero per missing-data policy
- [x] Loading / empty / error states; no combined productivity score
- [x] Daily detail panel: planned vs completed vs connector records (connectors later)

### Calendar

- [x] Day-by-day history
- [x] Streaks and concise daily summary
- [x] Navigate to a day’s Today/log view

### Settings (local privacy)

- [x] Preferences: timezone and display options
- [x] Privacy copy: local-first, no account, no server personal data
- [x] Readable JSON + CSV export
- [x] Encrypted JSON backup export/import (passphrase / recovery phrase)
- [x] Validate backup schema/version before replace or merge
- [x] Delete local data
- [x] Web Crypto AES-GCM envelopes for backup; interfaces suitable for later sync
- [x] No plaintext credentials in localStorage, URLs, logs, or error reports

### Milestone 1 tests and polish

- [x] Unit: task percentages, target progress, date/timezone boundaries
- [x] Unit: crypto envelope round trip
- [x] E2E: complete tasks; reload retains data; offline after first load
- [x] Polished empty states; restrained dashboard UI
- [x] README: setup, Vercel, PWA/offline check, backup restore (example env only)

**Acceptance:** works fully without network after first load; reload retains data; 3 of 6 tasks shows 50% task completion.

---

## Milestone 2 — GitHub + two-week personal-use test

- [x] Connector types + `MetricEvent` normalization (`lib/connectors`)
- [x] Generic adapter interface; no marketplace / catalog UI
- [x] Mocked GitHub provider for development
- [x] GitHub settings panel: connect, configure, sync, reconnect, disconnect
- [x] Last successful sync + actionable error state
- [x] PAT (owner fine-grained token) in local encrypted vault — V1 private build
- [x] Optional OAuth+PKCE path later; never store token in localStorage / query / logs
- [x] User choice: include private-repo activity or not
- [x] GraphQL contributions collection (not scraping the graph)
- [x] Normalize: `github.contributions`, `github.commits`, `github.pull_requests`, `github.active`
- [x] Source refs + fetched timestamp; merge/replace on re-sync
- [x] 7–30 day preview + confirm before first persist
- [x] Show provider latency (GitHub is not real-time)
- [x] Encrypt credentials before persistence
- [x] Disconnect: wipe credentials; user-selected policy for historical imports
- [x] Default GitHub contribution bar widget
- [x] Device-side fetch only (no server connector jobs)

**Acceptance:** GitHub metrics appear in dashboard widgets; disconnect follows chosen history policy.

**Personal-use gate (not code):** use daily for two weeks; log inconveniences, unused features, missing pieces in `context.md`.

---

## Milestone 3 — LeetCode and chart customization (after usage test)

- [x] Username-based LeetCode adapter; mocked data in development
- [x] Graceful failure; no HTML scraping
- [x] Manual DSA fallback remains durable
- [x] Normalize: `leetcode.accepted`, `leetcode.easy`, `leetcode.medium`, `leetcode.hard`, `leetcode.active`
- [x] LeetCode panel: connect/configure/sync/reconnect/disconnect, last sync, errors
- [x] Widget config: chart type, range, aggregation, goal line, reorder/hide, rolling average, color, title
- [x] Chart types: line, bar, area, calendar heatmap — presentation only, not data mutation
- [x] Charts from metric definitions (no `if connector === "github"` in dashboard)
- [x] Keyboard-accessible charts + tabular alternative under each chart
- [x] Default widgets: mobile line, GitHub bar, LeetCode/DSA bar, task-completion line
- [x] E2E: change a widget chart type; connect mocked LeetCode

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
| 2026-09-29 | Success metrics (`docs/success-metrics.md`) | Milestone 0 — success metrics |
| 2026-09-29 | Wireframes (`docs/wireframes.md` + images) | Milestone 0 — wireframes |
| 2026-09-29 | Dexie v1 schema (`lib/db.ts` + dexie + zod) | Milestone 0 — schema |
| 2026-09-29 | Export format + fixture + test plan | Milestone 0 — complete |
| 2026-09-29 | Offline tracker PWA + shadcn/ui + Dexie | Milestone 1 — complete |
| 2026-09-29 | GitHub connector: vault, GraphQL, sync engine, dashboard widget | Milestone 2 — complete |
| 2026-09-30 | LeetCode adapter + widget config system + data-driven dashboard | Milestone 3 — complete |
