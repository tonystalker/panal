# Personal Analytics — Product Brief (V1)

_Last updated: 2026-09-29_

---

## The Promise

> **Version 1 stores personal data only on the current device.**
> Backup is a user-controlled encrypted export file.
> Cloud sync is a later opt-in feature, not a prerequisite.

Personal Analytics is a **local-first PWA** that acts as your private daily operating system. It combines:

- **Manual check-ins** — tasks you plan each morning, quantities you log each evening.
- **Connector metrics** — GitHub contributions and LeetCode problems pulled directly in your browser.

No accounts. No server personal data. No password required to open the app. Works fully offline after the first load.

---

## V1 Success Criterion

The product succeeds when you can answer **yes** to all three:

| # | Question | Measurable threshold |
|---|----------|----------------------|
| 1 | Did you reliably plan your day? | Logged ≥ 5 days/week for 2 consecutive weeks |
| 2 | Does the dashboard surface a useful pattern? | Identified ≥ 1 behaviour change from the charts |
| 3 | Does the app work without network? | Loads, logs, and displays offline after first visit |

Acceptance is **behavioural**, not infrastructural. Do not treat adding sync or encryption as a success criterion.

---

## Pages (V1)

| Page | Core job |
|------|----------|
| **Today** | Plan tasks, log quantities, enter manual metrics, see live completion % |
| **Dashboard** | Graphs over selectable date ranges; task-completion %, metric charts, streak heatmap |
| **Calendar** | Day-by-day history; streaks; tap a day to review/edit its log |
| **Connectors** | Connect, configure, sync, and disconnect GitHub and LeetCode |
| **Settings** | Timezone, encrypted backup export/import, readable CSV/JSON export, delete all data |

---

## Key Decisions

### Task math — two separate numbers

- **Task completion %** = completed task count ÷ planned task count.
- **Target progress %** = Σ completed quantity ÷ Σ target quantity for quantitative tasks.
- An incomplete quantitative task is **not** auto-failed. Show both numbers separately.

### Connector architecture

- V1 has exactly two panels: GitHub and LeetCode (hardcoded).
- All data is normalised to `MetricEvent`; the dashboard knows nothing about specific connectors.
- Connector fetch runs **device-side while the browser is open**. No unattended server jobs.
- Credentials live only in the local encrypted vault — never in `localStorage`, URLs, logs, or analytics.

### Data integrity

- One `DailyLog` per date (user-timezone `YYYY-MM-DD`).
- Imported connector values are **immutable observations**. Manual corrections are separate override events.
- Dexie `version(1)` schema from day one; every shape change = migration + fixture + upgrade test.

### No combined score

There is no blended "productivity score." Display raw metrics, targets, and completion. Formulas are always visible.

---

## Deferred Until the Two-Week Test

Do **not** build these before the two-week personal-use test proves the core loop is valuable:

- Accounts, sign-in, Supabase, Postgres, or any server personal-data storage
- Automatic multi-device sync
- Remote credential vaults or server-side connector jobs
- A generic connector catalog/marketplace
- Android phone-usage companion (requires native `UsageStats` permission)
- Any combined productivity/consistency score
- Social features, leaderboards, or sharing by default

---

## Stack (V1)

| Concern | Choice |
|---------|--------|
| Client framework | Next.js 15 App Router, TypeScript |
| Styling | Tailwind CSS + shadcn/ui |
| Local database | Dexie (IndexedDB) |
| State/query | TanStack Query + Zustand |
| Charts | Recharts |
| Validation | Zod |
| Backup | Local encrypted JSON (Web Crypto AES-GCM + PBKDF2) |
| Deployment | Vercel static/PWA (no personal-data backend in V1) |

---

## Go / No-Go Gate (end of Milestone 1)

Before starting Milestone 2 (GitHub connector), verify:

- [ ] App installs as PWA and loads offline after first visit
- [ ] `reload retains data` — IndexedDB survives browser restart
- [ ] Task math: 3 of 6 tasks shows 50 % completion; 3 of 10 problems shows 30 % target progress
- [ ] Encrypted backup round-trip: export → re-import → same data
- [ ] Zero plaintext personal data leaves the device
