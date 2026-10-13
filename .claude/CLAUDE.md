# CLAUDE.md

## Project

Checkout continuity prototype for Gametime. A fan starts checkout on one surface (web or mobile), their hold expires or the price changes, and they resume on the other surface without creating a duplicate order. The backend is the source of truth for the session; web and mobile are pure clients.

## Stack

- **Monorepo**: pnpm workspaces
- **Web**: Astro 5 (`output: 'server'`, `@astrojs/node` standalone) + Tailwind v4 via `@tailwindcss/vite`. Every page is server-rendered; opt a page into static with `export const prerender = true` — none should in this app.
- **API**: Hono (Node adapter)
- **Mobile**: Simulated as a second Astro route (`/m/checkout/:id`) with mobile viewport and platform-appropriate copy. Native React Native is a stretch goal — the shared `@checkout/client` package exists specifically so a future RN screen imports it unchanged.
- **Shared code**: `@checkout/types` (TypeScript interfaces), `@checkout/client` (framework-agnostic session client)
- **Language**: TypeScript strict across every package
- **Package manager**: pnpm

## Structure

```
apps/
├── web/                       # Astro — /checkout/:id and /m/checkout/:id
└── api/                       # Hono — source of truth for sessions
packages/
├── types/                     # Session, Listing, SessionState, API request/response types
└── client/                    # Framework-agnostic session client: fetch, retry, idempotency, countdown
```

## Rules

Read the relevant rule file before writing code in that area:

- `rules/state-model.md` — session states, transitions, expiration, duplicate prevention. **Start here.**
- `rules/api.md` — API surface, headers, error shape, storage
- `rules/resilience.md` — client-side retry, polling, countdown reconciliation, required state UI
- `rules/rendering.md` — SSR vs hydration, what appears before JS runs
- `rules/typescript.md` — shared types and code quality
- `rules/monorepo.md` — workspace layout, package names, imports, dev-server orchestration
- `rules/mobile.md` — deep-link route shape, platform styling, what's shared vs. forked
- `rules/ui.md` — design-language tokens, decorative-input rule, per-state visual specs, countdown + QR placement
- `rules/stubs.md` — payment, inventory, pricing stub interfaces
- `rules/testing.md` — test runner, fixture conventions, mandatory scenarios

## Skills

Use `/astro` for Astro-specific decisions (routing, rendering, config, adapters).

## Commands

Run from repo root unless noted.

```bash
pnpm install                                 # install all workspaces
pnpm dev                                     # launch api + web in parallel
pnpm -r --parallel --if-present typecheck    # typecheck every package
pnpm -r --parallel --if-present lint         # lint every package
pnpm -r --parallel --if-present test         # run scripted scenarios + unit tests
pnpm --filter @checkout/api dev              # api only (port 3000)
pnpm --filter @checkout/web dev              # web only (port 4321)
```

## Definition of Done

- `pnpm -r --parallel --if-present typecheck` passes with zero errors
- `pnpm -r --parallel --if-present test` passes — includes scripted scenarios for: resume on second surface, price change mid-flow, duplicate completion attempt, expiration, idempotent retry
- `pnpm dev` launches both apps; `POST /api/sessions` creates a session; `GET /api/sessions/:id` returns it
- Visiting `/checkout/:id` server-renders the session with price, listing, and expiry present in the first HTML byte (verify with `curl` — the values must appear in the body before any `<script>` tag)
- `/m/checkout/:id` renders the same session with mobile styling and copy
- README documents the state model, resume flow, duplicate-order prevention, tradeoffs, and what you'd do with more time
