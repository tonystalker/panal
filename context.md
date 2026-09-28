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
