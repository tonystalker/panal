# Personal Analytics

A local-first personal productivity PWA. Track daily tasks, manual metrics (exercise, DSA, mobile usage), and — in Milestone 2 — GitHub and LeetCode data. No account needed. Works fully offline after first load.

## Quick start

```bash
npm install
npm run dev        # http://localhost:3000
```

## Tech stack

| Concern | Package |
|---------|---------|
| Framework | Next.js 15 App Router, TypeScript |
| Styling | Tailwind CSS + custom design system |
| Local DB | Dexie (IndexedDB) |
| State/query | TanStack Query + Zustand |
| Charts | Recharts |
| Validation | Zod |
| Tests | Vitest + Playwright |
| Backup | Web Crypto AES-GCM + PBKDF2 |

## Development

```bash
npm run dev          # Dev server (Turbopack)
npm run typecheck    # TypeScript strict check
npm run lint         # ESLint
npm run test         # Unit tests (Vitest)
npm run test:e2e     # E2E tests (Playwright)
npm run format       # Prettier
```

## Pages

| Route | Purpose |
|-------|---------|
| `/today` | Plan tasks, log quantities, enter manual metrics |
| `/dashboard` | Charts over selectable date ranges |
| `/calendar` | Monthly grid, streaks, daily summaries |
| `/connectors` | Connect GitHub and LeetCode (Milestone 2) |
| `/settings` | Timezone, export, encrypted backup, delete data |

## Local data

All data is stored in IndexedDB via Dexie. Schema is in [`lib/db.ts`](lib/db.ts). Repositories are in [`lib/repositories.ts`](lib/repositories.ts).

## Encrypted backup

Settings → **Export .panal-backup** — creates an AES-GCM encrypted file.  
Settings → **Import backup** — validates schema, confirms before overwriting.

The passphrase never leaves your device. Losing both the file and the passphrase is intentionally unrecoverable.

## PWA / offline

The app registers a service worker on first load. After that it loads fully offline. Install as a PWA from the browser's address bar.

## Vercel deployment

Push to `main` → auto-deploys on Vercel. No environment variables needed for V1 (no server personal data).

```bash
vercel --prod
```

## Privacy

Version 1 stores personal data only on this device. No account, no server personal data. See [docs/product-brief.md](docs/product-brief.md) for the full promise.
