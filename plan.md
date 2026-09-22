# Personal Analytics — local-first implementation plan

## Product decision

Build this as a **local-only Progressive Web App (PWA)** for one person first. The product is a private daily operating system: it combines manual check-ins and tasks with data pulled from GitHub and LeetCode. Use the MVP every day for at least two weeks before investing in accounts, server storage, encryption, or multi-device sync.

The important promise is precise:

> Version 1 stores personal data only on the current device. Backup is a user-controlled encrypted export file. Cloud sync is a later opt-in feature, not a prerequisite.

Vercel hosts the app, but V1 does not persist personal analytics data on a server. If V2 adds multi-device sync, it must store end-to-end encrypted data only. The backend must never be able to read a person's daily logs, task titles, mobile usage, or connector metrics.

### Scope gate: what is deliberately deferred

Do **not** build these before the two-week personal-use test proves the core loop valuable:

- accounts, sign-in, Supabase, Postgres, cloud storage, server cron jobs, and Edge Functions;
- automatic multi-device sync;
- remote credential vaults or server-side connector jobs;
- a generic connector catalog/marketplace;
- Android phone-usage companion;
- any combined productivity/consistency score.

The V1 success criterion is behavioral: can you reliably plan the day, log the day, and use the dashboard to notice a useful pattern? Infrastructure is not a substitute for that answer.

## Recommended platform and stack

| Concern               | Choice                                                  | Why                                                                                |
| --------------------- | ------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Client                | Next.js 15+ / React / TypeScript                        | Vercel-native, excellent PWA support, one codebase for desktop and mobile browsers |
| Styling               | Tailwind CSS + shadcn/ui                                | Fast, accessible, consistent UI components                                         |
| Local database        | IndexedDB through Dexie                                 | Works offline and can hold the complete encrypted local dataset                    |
| State/query           | TanStack Query + Zustand                                | Cached server connector calls and small local UI state                             |
| Charts                | Recharts                                                | Good responsive line, bar, area, and composed charts                               |
| Validation            | Zod                                                     | Protects import, connector, and API-boundary data                                  |
| Backup (V1)           | Local encrypted JSON export/import                      | No server or account; the user controls the backup file                            |
| Authentication (V2)   | Supabase Auth or Clerk                                  | Only when cross-device sync is justified                                           |
| Sync storage (V2)     | Supabase Postgres + Storage, containing ciphertext only | Introduce after daily-use validation                                               |
| Background jobs (V2)  | Vercel Cron + Supabase Edge Functions                   | Only for opt-in unattended connector refresh                                       |
| Encryption (V2 vault) | Web Crypto API (AES-GCM + PBKDF2/Argon2id)              | Encrypt before sync; use audited primitives, not custom cryptography               |
| Deployment            | Vercel static/PWA deployment                            | V1 has no personal-data backend; add Supabase only in V2                           |

### Why a PWA first

A PWA is usable on Windows, Android, and iPhone as an installed app. It is the right primary experience for daily tasks, dashboards, and integrations. Do **not** begin with a Windows app or native Android app.

One later exception is phone usage: a browser cannot accurately inspect Android screen-time usage. If that metric matters, create a small Android companion later. It reads Android `UsageStats` locally after explicit permission and writes daily aggregates into the same encrypted dataset. iOS does not generally permit a third-party app to collect device-wide Screen Time in this manner, so make iOS mobile usage a manual entry.

## Product principles

1. **Local before cloud.** First use does not require an account or network.
2. **Data minimization.** Save daily totals, not a surveillance trail. A mobile-usage connector should default to total minutes, not per-app history.
3. **Explicit consent.** Every connector explains what is read, how often, and how to disconnect/delete it.
4. **No black-box score.** Display the raw metric, target, completion, and formula. A combined consistency score is optional and always explainable.
5. **Portable data.** Export an encrypted backup and a readable CSV/JSON copy at any time.
6. **Failure is visible.** Connector status must show last successful sync and any action the user must take.

## Core user experience

### Navigation

- **Today** — plan tasks, enter manual check-ins, see live progress.
- **Dashboard** — selectable date range and graphs from tasks, habits, and connector metrics.
- **Calendar** — day-by-day history, streaks, and a concise daily summary.
- **Connectors** — discover, connect, configure, sync, and disconnect services.
- **Settings** — privacy, encryption/backup, data export, account, and preferences.

### Daily log

Every date has one `DailyLog`. It owns:

- manually entered measurements (exercise, mobile time, mood, etc.);
- daily task instances and their completion quantities;
- imported normalized connector metrics;
- calculated fields for UI only, never as the source of truth.

Use a date-only string in the user's selected timezone: `YYYY-MM-DD`. Keep the event timestamp separately when one exists. This avoids accidental attribution of late-night commits to the wrong local day.

### Tasks and targets

Support both binary and quantitative work. A task has `targetValue`, `completedValue`, and `unit`.

Example:

```text
Task: Solve DSA problems
Target: 10 problems
Completed: 3 problems
Progress: 30%
```

Keep the dashboard explicit:

- **Task completion:** completed task count / planned task count.
- **Target progress:** sum of completed quantity / sum of target quantity for comparable tasks.
- Do not silently treat an incomplete quantitative target as a failed task.

## Connector system

V1 has two straightforward integration panels: GitHub and LeetCode. Normalize their results through the same local metric-event format, but do not build a generic catalog UI until a third connector proves the pattern. In V2, this can become a first-class Connector system with curated and user-created integrations.

### Connector screen

In V2, show a catalog with cards:

- Icon, service name, short description, and category.
- Data types read, e.g. “daily contributions” or “solved problems.”
- Privacy note: “Data is normalized on your device; credentials are encrypted.”
- `Connect` / `Configure` / `Reconnect` state.

In V1, GitHub and LeetCode appear as hardcoded settings panels. Clicking **Connect** opens a clear authorization flow:

1. Explain exactly which data will be imported.
2. Ask the user to sign in and approve the provider's OAuth scope, or enter a username/API token if the provider has no OAuth.
3. Let the user choose which metrics to import and the sync frequency.
4. Fetch a small preview (last 7–30 days) and ask for confirmation.
5. Save the connection and show its first successful sync time.

Never put a third-party token in browser local storage, query strings, logs, or analytics events. For the first private build, GitHub can use a fine-grained token supplied by the owner, stored only in the local device vault. For a public product, prefer OAuth with PKCE and store refresh tokens only in the user's encrypted vault.

### Initial connector definitions

#### GitHub

Purpose: daily contribution count, commits, pull requests, issues, and optional “contributed today” boolean.

- Connect with OAuth/PAT only after the user selects whether private-repository activity should be included.
- Pull day-level contributions with the GitHub GraphQL contributions collection, not by scraping the contribution graph.
- Normalize to metrics such as `github.contributions`, `github.commits`, `github.pull_requests`, and `github.active`.
- Store source references and fetched timestamp so a later re-sync can replace/merge values correctly.
- Show provider latency clearly; GitHub events are not real-time.

#### LeetCode

Purpose: daily number of accepted problems plus optional easy/medium/hard breakdown.

- Start with a public username connector and read only public profile/submission information.
- Design the adapter behind an interface because LeetCode does not provide a stable, documented public developer API for every desired activity endpoint. Do not build the product around HTML scraping.
- Permit manual “DSA problems solved” entry as the durable fallback.
- Normalize to `leetcode.accepted`, `leetcode.easy`, `leetcode.medium`, `leetcode.hard`, and `leetcode.active`.

### Future connector types

Ship only reviewed built-in connectors initially. Later add:

- **Manual metric connector** — user-defined values such as reading minutes or water.
- **CSV import connector** — import date/value records with a mapping preview.
- **Webhook connector** — a secret URL accepts a small, validated event payload.
- **Custom API connector** — advanced users map an authenticated JSON endpoint to date/value fields. This should be a paid/advanced, sandboxed feature; never run arbitrary user JavaScript on your servers.

### Future plugin contract (V2+)

Represent each connector implementation with a typed manifest and adapter. Example:

```ts
type MetricDefinition = {
  key: string; // "github.contributions"
  label: string; // "GitHub contributions"
  unit: "count" | "minutes" | "boolean" | "percent";
  aggregation: "sum" | "last" | "max";
  defaultChart: "bar" | "line" | "area";
};

type ConnectorManifest = {
  id: string; // "github"
  name: string;
  auth: "oauth_pkce" | "personal_token" | "username" | "none";
  metrics: MetricDefinition[];
  supportsBackgroundSync: boolean;
};

interface ConnectorAdapter {
  manifest: ConnectorManifest;
  authorize(input: unknown): Promise<ConnectionDraft>;
  test(connection: ConnectionDraft): Promise<ConnectionPreview>;
  sync(
    connection: EncryptedConnection,
    range: DateRange,
  ): Promise<NormalizedMetricEvent[]>;
}
```

The client understands only normalized metric events. It must not have dashboard code such as `if connector === "github"`; charts derive from the selected metric definition.

## Graph and dashboard builder

Every metric has a default visualization but a user can choose a representation per dashboard widget.

### Widget configuration

Each chart widget stores:

- metric key(s);
- date range (7, 30, 90 days, custom);
- chart type (`line`, `bar`, `area`, or `calendar heatmap`);
- aggregation (daily, weekly, monthly);
- goal/target line, if relevant;
- visibility, title override, and color preference;
- optional rolling average.

Recommended defaults:

| Metric type                    | Default               | Good alternatives      |
| ------------------------------ | --------------------- | ---------------------- |
| Mobile minutes                 | Line                  | Area, bar              |
| Problems/contributions per day | Bar                   | Line, calendar heatmap |
| Daily yes/no habit             | Calendar heatmap      | Bar                    |
| Task completion percent        | Line with 100% target | Bar                    |
| Exercise minutes               | Bar                   | Line                   |

Avoid allowing visual customization to corrupt the data. Chart type changes only the presentation, never aggregation or source values. Keep the y-axis units visible, label empty days as zero or “no data” according to the metric's explicit missing-data policy, and make accessible table data available below each chart.

### Example dashboard

- A 30-day mobile-usage line with a 180-minute daily target line.
- A GitHub contributions bar chart with a contribution heatmap drill-down.
- A LeetCode accepted-problems bar chart grouped by difficulty.
- A task-completion line chart showing percentage, not raw task count alone.
- A daily detail panel that answers: “What was planned, what was completed, and what did connectors record?”

## Data model

Use client-generated UUIDs and immutable IDs. Data is locally stored in IndexedDB and encrypted before it is uploaded.

```text
UserProfile
  id, timezone, createdAt, preferences

DailyLog
  id, date, timezone, note, createdAt, updatedAt

TaskTemplate
  id, title, defaultTargetValue?, unit?, category?, active

TaskInstance
  id, dailyLogId, templateId?, title, targetValue?, completedValue,
  status (todo|done|skipped), createdAt, completedAt?

ManualMetric
  id, dailyLogId, metricKey, value, unit, source = manual

ConnectorConnection
  id, connectorId, displayName, status, settings,
  encryptedCredential, lastSyncedAt, lastError?

MetricEvent
  id, connectionId?, metricKey, date, value, unit,
  source (manual|connector), sourceEventId?, observedAt, importedAt

DashboardWidget
  id, metricKeys, chartType, range, aggregation, config, position

SyncEnvelope
  id, deviceId, version, ciphertext, nonce, updatedAt, deletedAt?
```

Rules:

- Unique index: `(connectionId, metricKey, date, sourceEventId)` where applicable, for idempotent sync.
- Imported values are immutable source observations. A manual correction must be a separate override event with a documented precedence rule.
- Soft-delete records so deletion can synchronize to other devices; periodically compact tombstones after all devices acknowledge them.
- Use a schema version and migrations from day one.

## Privacy, backup, authentication, and encryption

### Modes

1. **V1 local mode:** no login, IndexedDB only, encrypted export/import for backup.
2. **V2 synced private mode:** optional account and encrypted multi-device backup/sync.
3. **Public sharing:** opt-in static image or manually selected aggregate data only; it is a separate consent action.

### Encryption design

For V2, use one encrypted vault per user:

1. Generate a random data-encryption key (DEK) on the device.
2. Encrypt daily data, connector credentials, and sync changes with AES-GCM using a new nonce for every encryption.
3. Derive a key-encryption key from a user passphrase with Argon2id where supported (or a carefully configured Web Crypto KDF), then wrap the DEK.
4. Store wrapped DEK and ciphertext on the server; do not upload the passphrase or plaintext DEK.
5. A new device signs in, obtains ciphertext, and asks the user for their vault passphrase or uses a device-to-device transfer.

Do not claim “zero knowledge” until this has had a professional security review. Until then, use the accurate wording “end-to-end encrypted sync” and document exactly what account metadata exists.

### Recovery trade-off (required before V2 sync)

Password reset cannot decrypt the vault by itself. Offer users one of these explicit choices:

- recovery key download (recommended);
- approved secondary device recovery;
- no recovery, with clear warning that lost keys mean lost data.

Keep the ordinary account password separate from the vault passphrase. This prevents a server password reset from becoming an accidental decryption mechanism. In V1, recovery is simpler: the user must retain an encrypted export file and its passphrase/recovery phrase; losing both means the backup is intentionally unrecoverable.

## Sync strategy

V1 has no server sync. The encrypted export/import feature is its backup and migration mechanism. Add collaborative-style sync only when the two-week test demonstrates a real need to use multiple devices.

### Phase 1: encrypted backup (V1)

On demand, create an encrypted export file that contains a versioned snapshot of the local database. Import must validate the schema before replacing or merging local data. Restore requires the backup passphrase or recovery phrase. This solves migration/device-loss backup without a server.

### Phase 2: device sync (V2)

Use change records with `deviceId`, `sequence`, `updatedAt`, and a logical clock. The server returns ciphertext ordered by cursor; it does not interpret records.

State conflict rules before writing sync code:

- Every mutable record carries `updatedAt`, `deviceId`, and `revision` (a local logical counter).
- Task completion: field-level latest explicit value wins, preserving an audit event or conflict copy where possible.
- Metric events: merge by unique source event ID; manual overrides take priority over connector events in displayed totals.
- Daily notes: last-write-wins initially; move to a CRDT only if rich multi-device concurrent editing proves necessary.
- Widget layouts/settings: last-write-wins.

Run sync on app open, app focus, after a local mutation, and a modest periodic interval while the app is active. Never promise background syncing in a closed browser tab.

## Backend boundaries (V2 only)

The web frontend is public and deploys to Vercel. The backend needs only a few responsibilities:

- create/validate authenticated sessions;
- issue connector OAuth authorization state/callbacks where needed;
- store encrypted vault records and device metadata;
- run opt-in connector sync jobs if credentials are available in an encrypted vault workflow;
- enforce rate limits and abuse prevention;
- send no analytics containing daily-log content.

### Important connector-sync constraint

Pure end-to-end encryption and unattended server-side connector sync conflict: a server cannot use a credential it cannot decrypt. Pick one of these models per connector:

1. **Device sync (recommended first):** data is fetched directly in the user's open browser/app and encrypted locally. Maximum privacy; no unattended refresh.
2. **User-approved delegated token vault:** the user explicitly allows a narrowly scoped connector token to be stored server-side for scheduled pull. Easier automation; no longer fully zero-knowledge for that token.
3. **Mobile/desktop companion worker:** a user-owned companion decrypts locally and syncs on a schedule. Strong privacy but more engineering.

For GitHub and LeetCode in the personal MVP, choose device sync. Add server-side scheduling later only with a separate consent screen and clear explanation.

## API outline

Keep APIs narrow and avoid plaintext data payloads:

```text
POST /api/auth/*                 provider-managed authentication
POST /api/sync/push              upload encrypted change envelopes
GET  /api/sync/pull?cursor=...   download encrypted envelopes
POST /api/connectors/github/start
GET  /api/connectors/github/callback
POST /api/connectors/:id/test    validate configuration without persisting plaintext
POST /api/export                 client-side export trigger; no server data transform
```

Use row-level security in Supabase as defense in depth: an authenticated account can access only records addressed to its own account ID. The resulting rows remain ciphertext.

## Project structure

```text
app/
  (app)/today/page.tsx
  (app)/dashboard/page.tsx
  (app)/calendar/page.tsx
  (app)/connectors/page.tsx
  (app)/settings/page.tsx
  api/sync/push/route.ts
  api/sync/pull/route.ts
  api/connectors/github/start/route.ts
  api/connectors/github/callback/route.ts
components/
  daily-log/ task-list.tsx metric-checkin.tsx
  dashboard/ chart-widget.tsx widget-config-dialog.tsx
  connectors/ connector-card.tsx connect-dialog.tsx sync-status.tsx
lib/
  db/ dexie.ts schema.ts migrations.ts repositories.ts
  crypto/ vault.ts key-derivation.ts envelopes.ts
  connectors/ registry.ts github.ts leetcode.ts types.ts normalize.ts
  sync/ queue.ts merge.ts transport.ts
  metrics/ aggregation.ts goals.ts missing-data.ts
  validation/ schemas.ts
tests/
  unit/ crypto.test.ts aggregation.test.ts connectors.test.ts
  e2e/ onboarding.spec.ts daily-log.spec.ts connector-flow.spec.ts
```

## Implementation milestones

### Milestone 0 — product specification and durable local schema (1–2 days)

- Write a one-page product brief and the first daily-log fields.
- Define your own success metrics: e.g. “I record at least five days per week” and “dashboard loads offline.”
- Create Figma or code wireframes for Today, Dashboard, and Connectors.
- Set the initial Dexie schema to `version(1)` and document migrations as a mandatory release step. Every future shape change must add a migration, fixture, and upgrade test.
- Decide the encrypted export file format and test import with a sample backup.

### Milestone 1 — offline personal tracker (1–2 weeks)

- Scaffold Next.js TypeScript app and configure PWA manifest/service worker.
- Add Dexie schema/migrations and seeded sample data.
- Build Today: create tasks, check/uncheck tasks, quantitative targets, daily exercise/DSA/mobile fields.
- Build Dashboard: 7/30-day task completion and manual metric charts, plus a small custom SVG calendar heatmap for streaks.
- Build Calendar/history and readable JSON/CSV export plus encrypted JSON backup/export/import.
- Write unit tests for percentage/target calculations and date/timezone handling.

**Acceptance:** works fully without network after the first load; reload retains data; a day with 3 of 6 tasks shows 50% task completion.

### Milestone 2 — GitHub, then a two-week personal-use test (1 week + 2 weeks of use)

- Create a small GitHub integration adapter and normalized metric-event pipeline. Keep it generic enough to reuse but do not build a marketplace/registry screen.
- Implement a GitHub settings panel: connection, sync, reconnect, disconnect, last successful sync, and error state.
- Add GitHub PAT/OAuth configuration, contribution sync, and 30-day preview.
- Add GitHub widgets with line/bar/heatmap choices.
- Encrypt connector credentials locally before persistence.

**Acceptance:** GitHub metrics appear in dashboard widgets; disconnecting removes local access credentials and follows a user-selected policy for historical imports. Use the app daily for two weeks and record what is inconvenient, missing, or unused.

### Milestone 3 — LeetCode and chart customization (3–5 days, only after the usage test)

- Implement a username-based LeetCode adapter with graceful failure and a manual DSA fallback.
- Add widget configuration: chart type, range, aggregation, goal line, and reorder/hide.
- Make all charts keyboard-accessible and provide a tabular data alternative.

**Acceptance:** a user can make GitHub a bar chart and LeetCode a line chart without any custom connector-specific dashboard code.

### Milestone 4 — decide whether V2 sync is worth building

Before creating a cloud account or backend, answer with observed use: Did you switch devices often enough that export/import is painful? Did you retain at least two weeks of complete daily logs? Did the GitHub/LeetCode panels work reliably? If the answer is no, keep improving V1's daily loop.

### Milestone 5 — encrypted backup, sign-in, and V2 sync (1–2 weeks)

- Add optional authentication.
- Implement client-side encryption, recovery key, encrypted backup upload/download, and restore onboarding.
- Implement security-focused tests: decrypt only with correct key, tamper failure, nonce uniqueness, and migration restore.
- Add account deletion and a clearly documented metadata policy.

**Acceptance:** inspecting the backend database reveals ciphertext only; a new browser can restore a vault using the user-held key.

### Milestone 6 — multi-device sync and reliability (1–2 weeks)

- Replace whole-vault-only backup with encrypted change envelopes.
- Implement pull/push cursor, idempotency, deletion handling, and conflict tests.
- Add connection health and manual repair/re-sync options.
- Add error monitoring that redacts user data.

**Acceptance:** changes made offline on two devices converge after both reconnect; no plaintext log values appear in server logs.

### Milestone 7 — Android companion (optional)

- Kotlin app requests `PACKAGE_USAGE_STATS` with an understandable explanation.
- Compute local daily total screen time and optional user-selected categories.
- Sync aggregate data only through the encrypted vault protocol.
- Ensure the PWA remains useful if no companion is installed.

## Vercel deployment and continuous availability

### Before deployment

- Create GitHub repository with branch protection and CI.
- Create Vercel project connected to `main`.
- Register a GitHub OAuth application with production and preview callback URLs only if OAuth is used in V1; otherwise use a local personal token workflow.
- Configure a custom domain and HTTPS.

### Vercel environment variables

Keep these only in Vercel secrets, never in the repository:

```text
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
GITHUB_OAUTH_REDIRECT_URI=
SENTRY_DSN=
```

Add `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SYNC_SIGNING_SECRET` only in V2. `NEXT_PUBLIC_*` values may be embedded in the browser by design; do not put any private secret in them. Use separate development, preview, and production credentials.

### Release pipeline

1. Pull request: lint, TypeScript typecheck, unit tests, Playwright smoke tests, dependency/security scan.
2. Vercel preview: verify the PWA install/offline path, backup import, and OAuth callback if enabled.
3. Merge to `main`: production deploy.
4. Run a post-deploy synthetic health check for `/` and PWA assets; add authentication and encrypted-sync checks in V2.
5. Roll back via Vercel if the health check fails.

### Reliability checklist

- Use Vercel's managed uptime and CDN for the PWA; use an external uptime monitor for the public health endpoint.
- Add an `/api/health` endpoint that checks only service reachability, never user data.
- Test encrypted local export/import monthly and store one backup somewhere you control.
- Set connector timeouts, retry with exponential backoff, and show user-facing retry state.
- Add auth/sync rate limits and Supabase backup testing in V2.
- Keep immutable release tags and Dexie migration records.
- Configure CSP, secure cookies, CSRF protection for OAuth, and strict redirect-URI allowlists.

“24/7” means managed availability, monitoring, backups, and graceful offline behavior—not a guarantee that every third-party connector or user device is available at every moment. The app should queue local work and recover when dependencies return.

## Testing strategy

- **Unit:** aggregation, task percentages, date boundaries, normalization, encryption envelope round trips, merge conflicts.
- **Integration:** Dexie migrations, GitHub mocked responses, sync transport/RLS behavior.
- **End-to-end:** onboarding, offline update/reload, task completion, connector authorization failure/retry, export/import, encrypted restore.
- **Security:** verify no plaintext values or credentials enter logs, telemetry, query strings, or error reports; test token revocation/disconnect.
- **Performance:** 1,000 daily logs and 10,000 metric events should render a 90-day dashboard quickly on a mid-range phone.

## Non-goals for version 1

- A public marketplace for arbitrary third-party connector code.
- Social feed, comparison leaderboard, or sharing enabled by default.
- Automatic iOS screen-time collection.
- AI advice based on private logs.
- A universal single “productivity score.”

## Build prompt for a coding agent

Copy this prompt into a new implementation task after creating an empty repository:

```text
Build a production-quality, local-only personal analytics PWA named “Personal Analytics.” Use Next.js (App Router), TypeScript, Tailwind CSS, shadcn/ui, Dexie/IndexedDB, Zod, Recharts, and Vitest + Playwright. Deploy it to Vercel as a PWA, but do not introduce any database, authentication service, or server-side data storage in this milestone.

The app must work offline after first load and must not require sign-in for the initial local-only experience. It has five pages: Today, Dashboard, Calendar, Connectors, and Settings.

Today page requirements:
- Create, edit, reorder, complete, skip, and delete daily tasks.
- Tasks support binary completion and quantitative targets: title, target value, completed value, unit, and status.
- Show task completion as completed task count / planned task count. Show target progress separately. Example: 3 complete out of 6 tasks must display 50%; a task with target 10 and completed 3 displays 30%.
- Include manual metrics for exercise, DSA problems, and mobile usage minutes.
- Use a date-only DailyLog in the user-selected timezone.

Connector requirements:
- Implement two simple settings panels: GitHub and LeetCode. Do not build a connector catalog, marketplace, or remote sync in this milestone.
- Implement GitHub first. Its metrics are daily contributions, commits, pull requests, and an active-today boolean. Use a mocked provider in development and a clean local adapter boundary suitable for GitHub OAuth/PAT later.
- Implement LeetCode as a username-based adapter with mocked data in development and a robust manual DSA fallback. Do not scrape HTML.
- Normalize all imported records into a reusable local MetricEvent shape with id, connection id, metric key, date, value, unit, source event id, observedAt, and importedAt. This preserves a future connector abstraction without building its UI early.
- Each panel must show connect/configure, manual sync, reconnect/disconnect, last successful sync, and an actionable error state.

Dashboard requirements:
- Show dashboard widgets derived from metric definitions.
- Users configure chart type (line, bar, area, calendar heatmap), date range (7/30/90/custom), aggregation (daily/weekly/monthly), target line, and visibility.
- Default widgets: mobile usage line, GitHub contribution bar, LeetCode/DSA bar, task-completion-percent line.
- Charts need explicit axes/units, keyboard-accessible summary, a tabular alternative, responsive layout, loading/empty/error states, and no invented combined productivity score.

Data and privacy requirements:
- Use Dexie from `version(1)` with explicit migrations, UUIDs, indexes for idempotent connector imports, and an export/import feature for readable JSON and CSV.
- Add encrypted local JSON backup export/import. The user provides the backup passphrase or recovery phrase; losing both is intentionally unrecoverable. Validate backup schema/version before import.
- Create a small crypto abstraction using Web Crypto, with AES-GCM encryption envelopes for the backup file and locally stored connector credentials. Keep its interfaces suitable for later encrypted remote sync, but do not implement remote sync now.
- No plaintext credential in localStorage, URL, analytics, logs, or error reports.
- Include a Settings privacy page explaining local-first behavior and showing export/delete-local-data actions.

Engineering requirements:
- Make the PWA installable, offline-capable, and accessible.
- Use strict TypeScript, Zod validation at boundaries, ESLint, Prettier, Vitest, and Playwright.
- Write unit tests for task percentage calculations, date handling, metric aggregation, connector normalization, and crypto round trips.
- Write E2E tests for completing tasks, changing a widget chart type, and connecting a mocked GitHub connector.
- Provide README setup/deployment instructions for Vercel, including PWA/offline verification and encrypted backup restore. Use environment variable examples only—never real keys.
- Build a polished restrained dashboard; use realistic empty states and seeded demo data behind an explicit “Load demo data” action.

Work in small commits. Before declaring completion, run lint, typecheck, unit tests, and E2E tests, then summarize the files created and any integration steps that still require user credentials.
```

## Final decision summary

Start with a local-only PWA that makes daily use delightful. Ship manual tracking, GitHub, a simple LeetCode panel, chart configuration, and encrypted local export/import. Keep imports normalized and chart widgets configurable, but defer the connector catalog and generic plugin machinery until a third real connector requires it. After two weeks of real use, decide whether multiple-device access is painful enough to justify accounts, encrypted cloud backup, key recovery, and explicit sync conflict resolution.
