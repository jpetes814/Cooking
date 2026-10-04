@AGENTS.md

# Recipe Box

A personal recipe library and shopping planner, used mostly on a phone, often in a store with weak signal. Save recipe photos, screenshots, and video links; tag them (with sub-tags like `cuisine/thai`); find them by tag, season, or ingredient; and group recipes into one shopping trip so ingredients get shared and used up. Every Claude Code session on this repo (local, cloud, or the @claude GitHub Action) follows these rules.

## Commands

- `npm ci`: install
- `npm run dev`: local dev server at http://localhost:3000 (no service worker in dev)
- `npm run check`: lint, typecheck, unit tests, build. **Must pass before you open a PR.** The build must pass with no env vars set.
- `npm run test:rules`: Firestore and Storage security-rules tests against the local emulators. Run after any change to `firestore.rules` or `storage.rules`.
- `npm run test:e2e`: Playwright on a production build at phone size (Pixel 7), against local Firebase emulators (Auth, Firestore, Storage; seeded in `tests/e2e/global-setup.ts`). In Claude Code cloud sessions it uses the Chromium at `/opt/pw-browsers/chromium`; never run `playwright install` there.
- `node scripts/make-icons.mjs`: regenerate PNG icons after editing `public/icon.svg`

- `npm run emulators` plus `npm run dev:local` (second terminal): develop against local Firebase with no real project. Create test users with the helpers in `tests/e2e/firebase.ts`.
- The emulators need Java 21. In Claude Code cloud sessions, run `test:rules` and `test:e2e` with the HTTPS proxy unset (`env -u HTTPS_PROXY -u https_proxy -u GLOBAL_AGENT_HTTPS_PROXY ...`): otherwise the Storage emulator's allowlist lookup goes through the session proxy and gets blocked.

## Stack

Next.js 16 (App Router), React 19, TypeScript, Tailwind 4 (configured in `app/globals.css`; there is no tailwind.config). Firebase (Auth, Firestore, Storage for photos) for data, Claude API for reading captions, pages, and photos into recipe drafts, Vercel for hosting. Next 16 differs from older versions: read `node_modules/next/dist/docs/` before using an API you're unsure of.

## Structure

- `app/page.tsx`: the only page. The app is one client-rendered shell (`components/shell/AppShell.tsx`) so one cached page works offline. Add views as components, not routes.
- `app/api/`: the only place server secrets are read. Every route checks the signed-in user first (`lib/ai/guard.ts`).
- `lib/ai/`: every Claude call goes through `lib/ai/claude.ts` (structured output checked by a zod schema). Model IDs live in `lib/ai/models.ts`, prompts in `lib/ai/prompts/`, stand-in answers for tests in `lib/ai/mocks.ts`.
- `lib/data/`: every Firestore and Storage read and write. Components never call Firebase directly.
- Photos: shrunk on the phone (`lib/photos/shrink.ts`), kept in IndexedDB (`lib/photos/store.ts`) until uploaded by the queue in `lib/data/photos.ts`, then shown from their download address, which `public/sw.js` caches for offline. A recipe's photos are a map keyed by photo id (`lib/model/photos.ts`).
- `lib/import/`: "Fill from link" and "Read photos". Recipe pages are read from their schema.org JSON-LD with no AI; captions, plain pages, and photos go to Claude (`app/api/import`, `app/api/read-photos`), which also suggests tags the user taps to accept. Photos are sent as the phone's shrunk copy, or by download address only when it's the signed-in person's own (`lib/import/photos.ts`). All outside fetches go through `lib/import/sources.ts`, which blocks private addresses (`safe-url.ts`). Tests use the fake sites in `lib/ai/mocks.ts`.
- `lib/model/`, `lib/search/`, `lib/shop/`: pure logic (recipe validation, ingredient parsing, tag search, merging shopping lists). Keep it pure and unit tested.
- `public/sw.js`: the service worker. `tests/unit/` (Vitest), `tests/rules/` (security rules), `tests/e2e/` (Playwright).

## Data

Single user. Everything lives under `users/{uid}/` (recipes, trips, pantry) in Firestore, and photos under `users/{uid}/photos/` in Storage (`storage.rules` checks the same allowlist). An email allowlist (`config/allowlist`) keeps strangers out even if they make an account.

## Rules

- **Phone first.** Design for a 375px-wide screen, 44px minimum tap targets, thumb-reachable actions. Check iOS Safari and Android Chrome.
- **Offline safe.** Never block the screen waiting on the network. Firestore writes are fire-and-forget (they only resolve once the server confirms). No Firestore transactions; use batch writes. Show "waiting to sync" for unsynced changes. AI buttons say "needs signal" when offline instead of failing. The shopping list must work fully offline.
- **AI drafts, you decide.** Anything Claude reads from a photo or suggests (ingredients, tags, seasons) comes back as a draft the user reviews before it's saved. Never overwrite a saved recipe without a tap.
- **Security rules.** Every Firestore and Storage path must be covered by the rules files and a test in `tests/rules/`. If you change the rules, say so in the PR so the owner pastes them into both Firebase projects.
- **Secrets.** Only `NEXT_PUBLIC_*` values may reach the browser. Never commit `.env*` files or keys. New env vars go in `.env.example` and `docs/SETUP.md`.
- **No personal data in the repo.** No real names, emails, addresses, or private recipes in code, fixtures, issues, or PRs. Use made-up sample recipes in tests.
- **Small PRs.** One change per PR. Fill in the PR template, including how to test it on a phone. Add or update tests with every logic change.
- **Writing style** for docs and app text: plain, warm, short. No em-dashes.
- Don't edit `.github/workflows/` or delete user data unless the issue asks for it.
