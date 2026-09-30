# Personal Analytics — agent context

Read this file **before changing the repo**. It is the running memory for humans and other agents: what exists, how it was built, mistakes, open issues, and tradeoffs.

Companion files:

| File | Role |
| ---- | ---- |
| `plan.md` | Product and architecture specification (do not drift from it without updating this changelog) |
| `TASKS.md` | Checklist of remaining vs done work |
| `context.md` | This file: decisions, how-to, errors, changelog |

## How to work in this repo

1. Pick the next `[ ]` item in `TASKS.md` that is in the current milestone (do not jump to V2).
2. Implement one feature (or a small, coherent slice).
3. Update `TASKS.md` checkboxes and the completion log.
4. Append a **Changelog** entry here: what, how, errors, tradeoffs.
5. **Commit that feature immediately.** One feature ≈ one commit. Do not wait until the whole milestone is finished.

Commit message style: imperative, why-focused, e.g. `Add Dexie v1 schema for daily logs and tasks`.

Do not commit secrets, PATs, `.env` with real keys, or personal analytics data.

---

## Product snapshot

**Name:** Personal Analytics  
**V1 shape:** Local-only PWA for one person. Manual check-ins + tasks + GitHub/LeetCode metrics. No accounts, no server personal data.

**Promise:** Version 1 stores personal data only on the current device. Backup is a user-controlled encrypted export. Cloud sync is later opt-in, not a prerequisite.

**Stack (V1):** Next.js 15+ App Router, React, TypeScript, Tailwind, shadcn/ui, Dexie/IndexedDB, TanStack Query, Zustand, Recharts, Zod, Web Crypto (AES-GCM), Vitest + Playwright, Vercel static/PWA.

**Pages:** Today, Dashboard, Calendar, Connectors, Settings.

**V1 connectors:** hardcoded GitHub and LeetCode panels. Normalized `MetricEvent`s. No catalog/marketplace.

**Deferred until two-week daily use proves the loop:** auth, Supabase, Postgres, server cron, Edge Functions, multi-device sync, remote credential vaults, Android companion, combined productivity score.

---

## Repo layout (target)

Implementation should follow `plan.md` “Project structure”. Until the app is scaffolded, this repo only contains planning and tracking files.

```text
plan.md
TASKS.md
context.md
app/            # not created yet
components/     # not created yet
lib/            # not created yet
tests/          # not created yet
```

---

## Standing decisions (do not silently reverse)

- Local before cloud. First use needs no account or network (after first load).
- Date keys are `YYYY-MM-DD` in the **user timezone**; keep event timestamps separate.
- Task completion % and target progress % are **different numbers**. Incomplete quantitative work is not auto-failed.
- Charts come from metric definitions, not `if (connector === "github")`.
- Chart type changes presentation only, never stored values.
- No combined black-box score in V1.
- Imported connector values are immutable observations; manual corrections are separate override events.
- Dexie `version(1)` plus a migration on every shape change (migration + fixture + upgrade test).
- Credentials live in an encrypted local vault, never localStorage, query strings, logs, or analytics.
- GitHub: GraphQL contributions collection, not HTML scrape. LeetCode: no HTML scrape; username + manual DSA fallback.
- V1 connector fetch is **device-side** while the app is open. No unattended server jobs.
- Encrypted backup: losing passphrase **and** recovery phrase is intentionally unrecoverable.
- Do not claim “zero knowledge” without a professional security review; V2 wording is “end-to-end encrypted sync”.

---

## Known issues / open questions

| Item | Status | Notes |
| ---- | ------ | ----- |
| Git repo was accidentally the user home directory | Resolved | Initialized a dedicated git repo in `panal/` so commits cannot scoop up unrelated files |
| App not scaffolded | Open | Next work is Milestone 0 then Next.js scaffold |
| GitHub auth for private V1 | Open | Fine-grained PAT in local vault; OAuth+PKCE if the product is public |
| LeetCode API instability | Open | Adapter interface + mocks + manual DSA; never scrape |
| Export merge vs replace | Open | Import must validate schema; choose replace vs merge UX in Milestone 1 |
| Widget missing-data policy | Open | Per-metric: zero vs “no data”; document when implementing aggregation |

---

## Errors faced

None in application code yet. Process note: running `git` from `panal` initially used `C:/Users/707ay` as the repository root. Committing there would have been unsafe. Fix: `git init` inside this project folder.

---

## Tradeoffs log

| Decision | Chose | Rejected | Why |
| -------- | ----- | -------- | --- |
| Client form | PWA first | Windows app / native Android first | Daily tasks and dashboards work in browsers; UsageStats needs a later companion |
| Persistence V1 | IndexedDB/Dexie on device | Supabase from day one | Plan requires two weeks of personal use before accounts |
| Backup V1 | Encrypted local JSON file | Server backup | User-controlled; no personal-data backend |
| Connectors V1 | Two hardcoded panels | Generic catalog | Third connector should prove the pattern first |
| GitHub in MVP | Device sync + PAT/OAuth | Server cron pulling tokens | Server cannot both be zero-knowledge and decrypt tokens for unattended sync |
| Tracking in repo | `TASKS.md` + `context.md` | Issues-only or chat-only memory | Other agents can reconstruct state from git |

---

## Changelog

### 2026-09-22 — Tracking files and project git repository

**What:** Added `TASKS.md` (full breakdown of `plan.md` into checkable work, including deferred V2 items) and `context.md` (this file). Initialized git in `c:\Users\707ay\Desktop\projects\panal` because a parent home-directory repo existed.

**How:** Tasks grouped by plan milestones 0–7 plus CI/deploy and explicit non-goals. Working rule: update both files and commit after each feature.

**Errors:** Home-directory `.git` would have made `git add`/commit dangerous; avoided by creating a nested project repo.

**Issues:** None remaining for this slice.

**Tradeoffs:** Two markdown files instead of GitHub Issues so the plan travels with the code and works offline. Nested git repo under a home-level repo is slightly unusual; project isolation is worth it.

**Follow-up:** Start Milestone 0 (brief, Dexie schema, export format) then scaffold the Next.js PWA (Milestone 1).

---

### 2026-09-29 — Product brief (`docs/product-brief.md`)

**What:** Created a one-page product brief at `docs/product-brief.md`. Covers the precise V1 promise (local-only, no accounts), the three behavioural success criteria, page list, four key decisions (task math, connector architecture, data integrity, no combined score), the deferred feature list, tech stack table, and the go/no-go gate checklist for Milestone 1.

**How:** Distilled from `plan.md` and `context.md`. The brief is the canonical human-readable summary; `plan.md` remains the authoritative technical spec.

**Errors:** None.

**Issues:** None remaining for this slice.

**Tradeoffs:** Kept as a separate `docs/` file rather than inlining into `context.md` so it reads cleanly on its own and can be shared without the rest of the changelog.

**Follow-up:** Next tasks in Milestone 0 — define personal success metrics, wireframes, Dexie schema, export format.

---

### 2026-09-29 — Personal success metrics (`docs/success-metrics.md`)

**What:** Created `docs/success-metrics.md` defining the go/no-go gate for Milestone 2. Contains five primary gate metrics (G1–G5: days logged/week, consecutive weeks, offline load, data persistence, task math), five secondary quality metrics (Q1–Q5), four hard blockers that auto-block Milestone 2, and a template for recording two-week test results in `context.md`.

**How:** Gate metrics are concrete and measurable (counts, timed tasks, manual checks). Secondary metrics are observational and inform V2 decisions without blocking. Deliberately excluded speed benchmarks and feature counts as non-metrics.

**Errors:** None.

**Issues:** None.

**Tradeoffs:** Primary / secondary split keeps the gate strict (all 5 must pass) while still capturing useful signal that doesn't warrant blocking progress.

**Follow-up:** Next task in Milestone 0 — wireframes for Today, Dashboard, Connectors.

---

### 2026-09-29 — Wireframes (`docs/wireframes.md`)

**What:** Created `docs/wireframes.md` with generated images and annotated layout notes for Today, Dashboard, and Connectors. Calendar and Settings covered in notes only (straightforward layouts). Images committed at `docs/wireframes/{today,dashboard,connectors}.jpg`.

**How:** Images generated programmatically from design prompts. Layout notes specify every zone: navigation, task rows (binary vs quantitative), manual metric inputs, progress footer, chart widget layout, date range selector, connector card states (not-connected / connected / error), and the disconnect confirmation flow.

**Errors:** None.

**Tradeoffs:** Code-based wireframes (images + annotated markdown) preferred over Figma — travels with the repo, works offline, and is sufficient for a solo V1.

**Follow-up:** Dexie schema.

---

### 2026-09-29 — Dexie `version(1)` schema (`lib/db.ts`)

**What:** Created `lib/db.ts` with the full Dexie schema for all 8 V1 entities: UserProfile, DailyLog, TaskTemplate, TaskInstance, ManualMetric, ConnectorConnection, MetricEvent, DashboardWidget. Every entity has a Zod schema for write/import validation and a derived TypeScript type. Compound unique index `[connectionId+metricKey+date+sourceEventId]` on MetricEvent for idempotent connector imports. Singleton `db` export. Installed `dexie` and `zod`.

**How:** Used `Dexie.EntityTable` for type-safe table access. Migration policy documented in code comments: every schema change requires a new `version(N)` block + migration callback + updated fixture + upgrade test.

**Errors:** None.

**Tradeoffs:** All schema types derived from Zod to avoid duplication between validation and TypeScript types. `encryptedCredential` on ConnectorConnection is present in the DB but explicitly stripped on export — noted in the Zod schema comment.

**Follow-up:** Export format spec.

---

### 2026-09-29 — Export format, backup fixture, import test plan

**What:** Three deliverables:
- `docs/export-format.md` — full V1 encrypted backup envelope spec: AES-GCM, PBKDF2-SHA-256 at 600k iterations, base64url payload, `additionalData` binding, 8-step import validation sequence, readable export format, migration policy table.
- `tests/fixtures/backup-v1.json` — sample backup fixture with a `_plaintext_for_tests` field for unit test assertions without real KDF cost.
- `docs/import-test-plan.md` — 10 unit test cases (TC-01 to TC-10) covering happy path, wrong passphrase, tampered ciphertext, wrong app, unknown version, schema mismatch, Zod failure, empty backup, credential stripping, and idempotent import. Plus a 5-step manual E2E checklist.

**How:** Spec derived from plan.md encryption design. Test cases cover every rejection path in the 8-step import sequence.

**Errors:** None.

**Tradeoffs:** `_plaintext_for_tests` key in the fixture is non-standard but saves test complexity — the real `payload` field will be generated by `lib/crypto.ts` in Milestone 1.

**Follow-up:** ✅ Milestone 0 complete. Next: Milestone 1 scaffold — Next.js App Router, shadcn/ui, PWA manifest, ESLint/Prettier/Vitest/Playwright.

---

### 2026-09-29 — Milestone 1: Offline personal tracker (Core PWA)

**What:** Completed Milestone 1 offline personal tracker PWA:
- Scaffolding: Next.js 15 App Router, TypeScript (strict), Tailwind CSS v4, shadcn/ui integration (`components/ui/{button,card,input,badge,progress,dialog,tabs}.tsx`, `components.json`, `lib/utils.ts`).
- PWA & Offline: `public/manifest.json` and `public/sw.js` for standalone installation and offline cache.
- Local Data: Dexie v1 DB (`lib/db.ts`), UUID v4 client IDs, Zod validation at write boundaries, repository layer (`lib/repositories.ts`), demo seed (`lib/demo-data.ts`).
- Pages: 5 primary routes implemented:
  - `/today`: Daily log, note, full task CRUD, binary & quantitative progress tracking, manual metrics.
  - `/dashboard`: Date range filters (7d/30d/90d), Recharts charts, task completion line, streak heatmap, daily inspection drawer.
  - `/calendar`: Monthly interactive grid, streak calculator, day routing.
  - `/connectors`: Prepared UI for GitHub & LeetCode (Milestone 2).
  - `/settings`: Timezone settings, plaintext JSON/CSV export, AES-GCM Web Crypto encrypted backup export/import with passphrase, wipe local data.
- Quality & Verification: All 24 Vitest unit tests passing (`crypto.test.ts`, `task-math.test.ts`, `date.test.ts`), `tsc --noEmit` clean (0 errors), ESLint clean (0 errors, 0 warnings).

**How:** Configured shadcn/ui with Radix UI primitives and custom CSS tokens; fixed Zod v4 and React 19 type definitions; resolved npm peer dependency constraints with `.npmrc`.

**Errors:** ERESOLVE conflict between `@types/node` and `vitest@5.0.2` during shadcn installation resolved by aligning `@types/node` to `^22` and adding `.npmrc`.

**Tradeoffs:** Retained pure CSS variables matching existing design tokens for maximum speed and zero flash during offline loads.

**Follow-up:** ✅ Milestone 1 complete. Next: Milestone 2 — GitHub connector and two-week personal-use test.

---

### 2026-09-30 — Milestone 3: LeetCode + chart customization

**What:**
- `lib/connectors/leetcode.ts` — LeetCode connector adapter. Username-based (no OAuth), mocked in dev (`token === "mock"`), graceful failure with clear error messages, no HTML scraping. Normalizes to 5 metric keys per day: `leetcode.accepted`, `leetcode.easy`, `leetcode.medium`, `leetcode.hard`, `leetcode.active`.
- `lib/metrics/definitions.ts` — Central `MetricDefinition` registry. Every metric key (computed, manual, connector) has a canonical definition with label, unit, aggregation, default chart, color, goal line, and missing-data policy. Dashboard reads from this registry — no `if connector === "github"` anywhere.
- `lib/metrics/resolver.ts` — Universal data resolver called by all dashboard widgets. Dispatches by `def.source` (computed, manual, connector) internally. Also exports `applyRollingAverage`.
- `app/dashboard/page.tsx` — Fully rewritten as a data-driven widget system. Widgets loaded from `DashboardWidget` table, rendered via `MetricDefinition`. Features: configure chart type (line/bar/area/heatmap), date range, goal line, rolling average, color, title; reorder (up/down); hide/show; add new widget; reset to defaults; collapsible tabular data alternative (keyboard accessible with `role="gridcell"` on heatmap, `<table>` under each chart).
- `app/connectors/page.tsx` — Added full `LeetCodePanel` (connect by username, sync, reconnect, disconnect, last-sync time, error state, history-delete option).
- `lib/repositories.ts` — Added `deleteWidget`, `reorderWidgets`, `seedDefaultWidgets` (idempotent, seeds 6 default widgets on first load).
- `app/globals.css` — Added `.sr-only` utility class for accessible table captions.
- Tests: `tests/unit/connectors.test.ts` extended with LeetCode unit tests; `tests/unit/metrics.test.ts` added (definitions registry + rolling average); `tests/e2e/milestone3.spec.ts` added (widget config flow, LeetCode connect/disconnect).

**How:**
- Dashboard architecture: `DashboardWidget` rows drive the UI; `MetricDefinition` provides display config; `resolveMetricData()` fetches data. Adding a new connector requires only: (1) a new adapter in `lib/connectors/`, (2) entries in `lib/metrics/definitions.ts`. Zero dashboard code changes needed.
- LeetCode: Uses LeetCode's public GraphQL endpoint (not HTML scraping). In dev mode, `token === "mock"` triggers `buildMockedLeetCodeResult`. Production mode fetches real data via POST to `https://leetcode.com/graphql` with `Referer: https://leetcode.com`.
- Widget config dialog: bottom-sheet modal pattern. `seedDefaultWidgets()` is called on dashboard load, guarded by `count > 0` check (idempotent).

**Errors:** 5 TypeScript errors fixed — tooltip formatter types (Recharts `Formatter` generic), null vs undefined for StatusBadge, MetricDefinition type annotation, range setState cast.

**Tradeoffs:**
- LeetCode's `recentSubmissionList` doesn't include difficulty — all accepted submissions counted under `leetcode.easy` as an approximation. The plan.md notes LeetCode has no stable public API for every desired activity endpoint; the manual DSA fallback remains the reliable path.
- Rolling average uses non-null values only in the window, which is more honest than zero-filling nulls before averaging.
- Widget config uses a bottom-sheet dialog (no shadcn/ui Dialog dependency) to keep the component self-contained.

**Follow-up:** ✅ Milestone 3 complete. Next: Milestone 4 — personal-use evaluation (go/no-go for V2 sync).

---

### 2026-10-01 — Configurable Workday Cutoff and Previous Day Task Shortcut

**What:**
- `lib/db.ts`: Added `workdayCutoff: z.string().regex(/^\d{2}:\d{2}$/).default("00:00")` to `UserProfileSchema.preferences`. Defaulting to `"00:00"` (12:00 AM midnight) preserves full backwards compatibility for existing profiles and fixtures without requiring migration.
- `lib/date.ts`: Implemented `operationalDate(now, timezone, cutoffTime)`. For example, with a 6:00 AM cutoff (`"06:00"`), 2026-10-01 01:00 resolves to 2026-09-30, and 2026-10-01 06:00 resolves to 2026-10-01. DST-safe via calendar day subtraction (`subDays`). Updated `todayKey` and `dateLabel` to use `operationalDate`.
- `lib/repositories.ts`: Initialized `workdayCutoff: "00:00"` on new profiles; added `getDailyLogByDate(dateKey)` query helper; ensured `UserProfileSchema.parse` hydrates missing cutoff on existing DB records.
- `app/settings/page.tsx`: Added Workday Cutoff selection under Preferences with options from 12:00 AM to 12:00 PM (e.g. 6:00 AM for night shift workers).
- `app/today/page.tsx`:
  - Added URL date parameter support (`?date=YYYY-MM-DD`) and full date navigation controls: Prev Day, Next Day, Today jump button, and date picker input.
  - Resolved `dateKey` via `operationalDate(new Date(), tz, cutoff)` when no query param is provided.
  - Added visible shortcut banner on Today when the previous operational day has unfinished tasks: “Previous workday · X unfinished tasks” with actions to “Open that day” and “Mark items complete” directly inline.
  - Completing tasks from the shortcut updates the original `TaskInstance`, preserves its original `DailyLog` date, and sets `completedAt` to the real timestamp.
  - Added historical workday badge and editing notice when viewing/adjusting past days.
  - Wrapped `TodayPage` in `<Suspense>` for clean Next.js 15 App Router client search param hydration.
- `app/dashboard/page.tsx` & `app/calendar/page.tsx`: Replaced calendar midnight date resolution with `operationalDate(new Date(), tz, cutoff)`.
- `tests/unit/date.test.ts`: Added 14 unit test cases for `operationalDate`, default midnight cutoff, 6:00 AM cutoff, before/after cutoff boundaries, timezone offsets, DST transitions, and month/year boundaries. All 84 tests pass.

**How:**
- Day boundary logic: checks if local wall-clock minutes `(hour * 60 + min) < cutoffMinutes`. If so, decrements calendar day via `subDays(zoned, 1)`.
- Existing daily logs and tasks are never moved or auto-failed when cutoff passes.
- Direct date navigation and calendar links (`/today?date=...`) allow editing tasks, check-in metrics, and reflections on any past workday.
- UI.md alignment: integrated the date navigator directly into the quiet `PageHeader` action slot, eliminated floating card chrome, used hairline-bordered surfaces with subtle warning dot indicator for previous workday shortcut, and styled task completion buttons with standard `.checkbox` and monospace tabular figures.

---

### 2026-10-01 — Custom Metric Tracking and Dashboard Widget Removal

**What:**
- `lib/db.ts`: Added `CustomMetricSchema` (`key`, `label`, `unit`, `defaultGoalLine`, `defaultChart`, `createdAt`) and added `customMetrics: z.array(CustomMetricSchema).default([])` to `UserProfileSchema.preferences`.
- `lib/repositories.ts`: Added `addCustomMetric(data)` (with `addToDashboard?: boolean` option to create a linked `DashboardWidget`) and `deleteCustomMetric(key)` (cleans up metric and associated widgets).
- `lib/metrics/definitions.ts`: Added `customMetricToDefinition(cm)`, `getAllMetricDefinitions(customMetrics)`, and enhanced `metricLabel` to format and resolve custom metrics.
- `lib/metrics/resolver.ts`: Added dynamic fallback in `resolveMetricData` for any metric starting with `manual.` via `resolveManualMetric` from `db.manualMetrics`.
- `components/ChartWidget.tsx`: Exposed `onDelete?: () => void` and added `#widget-delete-${id}` trash icon button to widget controls header.
- `app/dashboard/page.tsx`:
  - Connected `onDelete` to `removeWidget.mutate(w.id)` on visible widgets.
  - Added delete button with `Trash2Icon` on hidden widgets to permanently remove them.
  - Added "Remove" button with `Trash2Icon` in `WidgetConfigDialog` for existing widgets.
  - Populated `<select id="widget-metric-select">` with `getAllMetricDefinitions(customMetrics)` so custom metrics appear in the widget picker.
- `app/today/page.tsx`:
  - Added `+ Add` button (`#add-custom-metric-btn`) to `SectionHeading` under Manual Check-ins.
  - Added inline form to create custom metrics (Name, Unit, Goal, "Add to Dashboard widgets" checkbox).
  - Rendered custom metrics in check-in list with numeric input, and trash icon button to remove custom metrics.
- `tests/unit/metrics.test.ts`: Added unit tests for `customMetricToDefinition`, `getAllMetricDefinitions`, and `metricLabel`. All 87 unit tests pass.

**How:**
- Reuses `db.manualMetrics` store with dynamic metric keys, avoiding complex database schema migrations while giving full custom tracking capabilities.
- Custom metrics immediately integrate with Recharts visualizations and are selectable in dashboard widget creation and configuration dialogs.
- Adheres strictly to `UI.md`: hairline borders, near-black dark surfaces, acid-lime accent, tabular numbers, and clean micro-interactions.

---

### 2026-10-01 — Import Watermelon Capitalio Dashboard Registry Item

**What:**
- Installed `https://registry.watermelon.sh/r/capitalio-dashboard.json` via shadcn CLI.
- Added dependencies: `@base-ui/react`, adjusted `recharts` compatibility.
- Added Shadcn UI primitives: `avatar.tsx`, `dropdown-menu.tsx`, `separator.tsx`, `sheet.tsx`, `sidebar.tsx`, `skeleton.tsx`, `tooltip.tsx`, and `hooks/use-mobile.ts`.
- Imported reference dashboard component suite into `components/watermelon/capitalio-dashboard/` for compositional reference (sidebar, topbar, navigation, data, dashboard layout).
- Updated `.gitignore` to strictly exclude prompt specification files.

**How:**
- Imported in a dedicated, isolated commit prior to adaptation per `personal-ui-refactor.md`.
- Verified compilation and types with `npm run typecheck`.

---

### 2026-10-01 — Adapt App Shell, Collapsible Navigation & Design Tokens

**What:**
- `components/AppShell.tsx`: Configured route-aware shell rendering that isolates public routes (`/`, `/login`, `/signup`, `/privacy`) from the internal application sidebar.
- `app/layout.tsx`: Integrated `TooltipProvider` for accessible navigation tooltips and dark theme tokens.
- `app/app/page.tsx`: Created `/app` redirect to `/today` to support both `/app` and `/today` entry points.
- `components/Sidebar.tsx` & `components/ui/AppMonogram.tsx`: Preserved collapsible desktop navigation (64px to 248px), typographic `PA` monogram, accessible mobile drawer with keyboard escape trap, active route indicators, and offline privacy indicator.

**How:**
- Reuses semantic dark tokens (`#09090b` canvas, `#111113` surface, `#a3ff12` acid-lime signal color).
- Tested typecheck and layout rendering.

---

### 2026-10-01 — Refactor Dashboard with Capitalio Data-First Composition

**What:**
- `app/dashboard/page.tsx`:
  - Replaced floating KPI cards with a unified Capitalio-inspired overview strip: 4 key metrics (Active Streak, Active Charts, Logged Workdays, Local & Private Storage Mode) in a single hairline-bordered container (`divide-x divide-border/60 bg-surface/50`).
  - Added primary analysis emphasis: the first widget in the grid spans full width (`lg:col-span-2`) as the dominant analytical hero chart, followed by secondary charts in a responsive two-column grid.
  - Maintained all existing Dexie queries, widget reordering, metric source selection, date detail inspector, and custom metric visualizations.

**How:**
- Translated Watermelon Capitalio composition into truthful personal analytics workspace (no fabricated financial terms).
- Tested responsive behavior and ran vitest suite (87 tests passed).

---

### 2026-10-01 — Import and Adapt Watermelon Integrations-2 Registry Item

**What:**
- Installed `https://registry.watermelon.sh/r/integrations-2.json` via shadcn CLI.
- Inspected the imported component diff: verified that marketplace placeholders (Slack, Notion, Stripe, Cloudflare, etc.) are kept isolated from the real app.
- Preserved focused GitHub and LeetCode integration panels in `app/connectors/page.tsx` and `components/ConnectorPanel.tsx` without marketing fluff or unsupported provider connections.
- Retained calm status indicators, on-device AES-GCM credential vault storage, direct API queries, and clear disconnect/delete-history flows.

**How:**
- Imported in a dedicated commit per `personal-ui-refactor.md`.
- Verified type safety with `npm run typecheck`.

---

### 2026-10-01 — Refactor Today, Calendar, and Settings Pages for Swiss Editorial Consistency

**What:**
- `app/today/page.tsx`: Polished day-progress summary, integrated date navigator into `PageHeader`, responsive two-column layout on desktop, clean task rows with monospace tabular numbers, unified check-in inputs with custom metrics, and quiet reflection area.
- `app/calendar/page.tsx`: Restrained grayscale month grid with acid-lime accent reserved for active/selected day and completion, compact month navigation, and desktop side panel for day inspection.
- `app/settings/page.tsx`: Grouped settings rows (Timezone, Workday Cutoff), AES-GCM encrypted backup export/import, readable JSON/CSV export, and confirmation-protected data wipe.

**How:**
- Adheres strictly to `UI.md` and `personal-ui-refactor.md` design principles: deep near-black canvas, hairline borders, no floating card clutter, and high contrast typography.
- Verified test suite and type checking.

---

### 2026-10-01 — Import Watermelon Hero-8 and Adapt Landing Hero Showcase

**What:**
- Installed `https://registry.watermelon.sh/r/hero-8.json` via shadcn CLI.
- Created `components/landing/LandingNav.tsx`: Sticky blurred glass navigation, `PA` monogram, anchor links (`#product`, `#story`, `#features`, `#privacy`), "Log in" action, "Start locally" primary button, and mobile menu.
- Created `components/landing/LandingHero.tsx`:
  - Truthful product headline: "Make your days visible."
  - Layered 3D perspective dashboard showcase with pointer parallax tilt (reduced-motion safe).
  - Floating planes for GitHub connector activity and AES-GCM local storage encryption badge.
  - Three-point factual trust strip: Local-first by default, No account required, Connector-ready by design.
- `app/page.tsx`: Set up public landing page at `/`.

**How:**
- Imported in a dedicated commit per `personal-landing-auth.md`.
- Verified type safety and clean responsive styling.

---

### 2026-10-01 — Import Watermelon Feature-3 and Adapt Scroll Story & Feature Grid

**What:**
- Installed `https://registry.watermelon.sh/r/feature-3.json` via shadcn CLI.
- Created `components/landing/LandingStory.tsx`:
  - 3-chapter sticky scroll-driven product story: (1) Plan the day with honest progress, (2) Turn activity into inspectable daily metrics, (3) See the pattern through calm analytics.
  - Transforming visual frame responding to scroll checkpoints via IntersectionObserver (stacked on mobile/reduced-motion).
- Created `components/landing/LandingEditorial.tsx`:
  - Added high-resolution dark editorial visual (`public/images/landing/editorial-desk.jpg`) with soft edge fade and vignette.
  - Emotional message: "A record of your days, for you."
- Created `components/landing/LandingFeatures.tsx`:
  - 5 truthful capabilities: Configurable workday cutoff past midnight, Dual task/target progress, Connector integrations, Controllable charts, and Local data export with AES-GCM encryption.

**How:**
- Replaced all template placeholders with real Personal Analytics concepts and data models.
- Verified compilation and types with `npm run typecheck`.

---

### 2026-10-01 — Import Watermelon CTA-4 and Adapt Privacy, Final CTA & Footer

**What:**
- Installed `https://registry.watermelon.sh/r/cta-4.json` via shadcn CLI.
- Created `components/landing/LandingPrivacy.tsx`:
  - Concrete local data diagram: `Your browser -> IndexedDB on your device -> Encrypted export`.
  - Plain-language explanation of local-only storage and link to full privacy promise.
- Created `components/landing/LandingCTA.tsx`:
  - Adapted high-contrast CTA container from Watermelon CTA-4.
  - Headline: "Start with one honest day."
  - Action buttons: "Open Personal Analytics" and "Read the privacy promise".
- Created `components/landing/LandingFooter.tsx`:
  - Monogram, dynamic copyright year, local-first note, and clean app navigation links.
- Created `app/privacy/page.tsx`:
  - Detailed, truthful privacy page documenting client-side IndexedDB, Web Crypto AES-GCM backup encryption, direct connector API communication, and zero telemetry.

---

### 2026-10-01 — Import Watermelon Auth-01 & Error-3, Add Local-First Auth Boundary & 404 Route

**What:**
- Installed Watermelon Auth 01 (`https://registry.watermelon.sh/r/auth-01.json`) -> `components/ui/auth-01.tsx`.
- Installed Watermelon Error 3 (`https://registry.watermelon.sh/r/error-3.json`) -> `components/ui/error-3.tsx`.
- Created `lib/auth.tsx`:
  - `AuthAdapter` interface supporting `signUp`, `login`, `logout`, `getSession`, and `requestPasswordReset`.
  - `AuthProvider` and `useAuth` hook wrapped in `app/providers.tsx`.
  - Truthful local-first handling: registers early access for sync without claiming false remote authentication or uploading private local logs.
- Created `app/login/page.tsx`:
  - Focused auth layout with prominent "Continue locally without an account" bypass button.
  - Email/password validation, password reveal toggle, loading state, and informational feedback.
  - Wide-screen split layout featuring dark editorial workspace visual and local privacy badges.
- Created `app/signup/page.tsx`:
  - Mirrored split layout with "Use locally" bypass, password confirmation, and link to privacy promise.
  - Honest "Join sync early access" action.
- Created `app/not-found.tsx`:
  - Restrained Swiss-style 404 route adapted from Watermelon Error-3.
  - Truthful explanation: unmapped route, notes that local data is safe, and provides recovery routes to `/today` and `/`.
- Updated `components/AppShell.tsx`:
  - Isolated dashboard sidebar strictly to internal app routes (`/today`, `/calendar`, `/dashboard`, `/connectors`, `/settings`).
  - Landing, auth, legal, and error routes render cleanly full-screen.

**How:**
- Replaced all template social login placeholders and generic claims with honest local-first copy.
- Validated types with `npm run typecheck`.
