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

## Routes

| Route | Purpose | Access model |
|-------|---------|--------------|
| `/` | Public landing page (Hero-8, Feature-3 story, CTA-4) | Public |
| `/today` | Plan tasks, log quantities, enter custom & manual metrics | Local app |
| `/dashboard` | Capitalio data-first overview strip & primary analysis charts | Local app |
| `/calendar` | Monthly grid, streaks, daily summaries, date navigation | Local app |
| `/connectors` | Integrations-2 provider panels (GitHub, LeetCode) | Local app |
| `/settings` | Preferences, workday cutoff, encrypted backup, data wipe | Local app |
| `/login` | Account login visual shell with prominent local bypass | Public / optional |
| `/signup` | Early-access sync registration with "Use locally" bypass | Public / optional |
| `/privacy` | Complete privacy promise & local-first architecture details | Public |
| `/app` | Convenient redirection to `/today` | Shortcut |
| `/*` (404) | Branded Swiss-style 404 recovery page (Error-3) | Public |

## Visual Architecture & Watermelon Components

The interface adapts composition references from Watermelon UI with pure Swiss editorial aesthetics:
- **Dashboard Composition**: Adapted from Watermelon Capitalio with a 4-metric overview strip, dominant primary analysis chart, and secondary widgets.
- **Landing Page Composition**: Adapted from Watermelon Landing 01:
  - `Hero-8` (`components/landing/LandingHero.tsx`) — 3D perspective dashboard staging, fine-pointer tilt parallax, and truthful trust strip.
  - `Feature-3` (`components/landing/LandingStory.tsx` & `LandingFeatures.tsx`) — 3-chapter sticky scroll story and 5 core benefits grid.
  - `CTA-4` (`components/landing/LandingCTA.tsx`) — high-contrast closing conversion container ("Start with one honest day").
  - `Auth-01` (`components/ui/auth-01.tsx`, `app/login`, `app/signup`) — split-panel authentication shells with local bypass.
  - `Error-3` (`components/ui/error-3.tsx`, `app/not-found.tsx`) — restrained recovery route.
  - Editorial photograph (`public/images/landing/editorial-desk.jpg`) — dark workspace with subtle film grain and edge fade.

## Local-First Auth Boundary

Personal Analytics operates without a central authentication server. The `lib/auth.tsx` module provides an `AuthAdapter` interface:
```ts
export interface AuthAdapter {
  signUp(email: string, password: string): Promise<AuthResponse>;
  login(email: string, password: string): Promise<AuthResponse>;
  logout(): Promise<void>;
  getSession(): Promise<UserSession | null>;
  requestPasswordReset(email: string): Promise<AuthResponse>;
}
```
All personal tracking logs remain exclusively in browser IndexedDB. No fake cloud authentication is claimed.

## Local data & Encryption

All data is stored in IndexedDB via Dexie v1 (`lib/db.ts`).
- **Encrypted backup**: Settings → **Export .panal-backup** (PBKDF2 + AES-GCM 256-bit encryption).
- **Connector credentials**: Stored locally in a Web Crypto AES-GCM vault with browser-direct API calls.

## Environment Variables

No mandatory environment variables are required for offline or local-first use.
Optional configuration for GitHub device flow OAuth proxy:
```bash
GITHUB_CLIENT_ID=your_github_oauth_client_id
```

## Privacy Promise

Version 1 stores personal data only on this device. No account required, no server personal data, no analytics trackers. See [`/privacy`](app/privacy/page.tsx) or [`docs/product-brief.md`](docs/product-brief.md) for the full architecture.
