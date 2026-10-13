# TASKS.md

Ordered phases for the checkout continuity prototype. Work top to bottom. Each phase has an acceptance check — do not advance until it holds.

The contract is in `rules/state-model.md`, `rules/api.md`, and `rules/resilience.md`. Read those before starting any phase that touches that layer.

---

## Phase 1 — Workspace scaffolding

Create the monorepo per `rules/monorepo.md`.

- Root `package.json` with `pnpm-workspace.yaml`
- `apps/web` (Astro 5, `output: 'server'`, `@astrojs/node` standalone, Tailwind v4 via `@tailwindcss/vite`)
- `apps/api` (Hono, Node adapter, Vitest)
- `packages/types` (TS-only, exports from `rules/state-model.md`)
- `packages/client` (TS-only, framework-agnostic)
- Root `dev` script runs both apps in parallel

**Done when**: `pnpm install` succeeds, `pnpm dev` launches both apps, and both resolve `@checkout/types` / `@checkout/client` without errors.

---

## Phase 2 — Shared types

Populate `packages/types/src/index.ts` with every type referenced in `rules/state-model.md` and `rules/api.md`:

- `SessionState` union
- `Session`, `Listing`, `ListingSnapshot`
- API request/response types for every endpoint (`CreateSessionRequest`, `AcceptPriceRequest`, `CompleteRequest`, `ApiError`, etc.)

**Done when**: `pnpm --filter @checkout/types build` (or `typecheck`) passes, and `apps/api` + `apps/web` can import from `@checkout/types`.

---

## Phase 3 — Stubs

Build the stub interfaces per `rules/stubs.md`:

- `apps/api/src/stubs/payment.ts` — `PaymentGateway` with a configurable decline rate
- `apps/api/src/stubs/inventory.ts` — `InventorySource`
- `apps/api/src/stubs/pricing.ts` — `PriceOracle` with a mutable in-memory price map (so the test harness can change prices)
- `apps/api/src/store.ts` — in-memory `Map`s for sessions, listings, idempotency

Seed at least one listing so the API is usable the moment it boots.

**Done when**: unit tests on each stub pass; the store resets cleanly between tests.

---

## Phase 4 — API routes

Implement every endpoint in `rules/api.md`. Order:

1. `POST /api/sessions` — create
2. `GET /api/sessions/:id` — resume (with on-read reconciliation for expiry and price change)
3. `POST /api/sessions/:id/accept-price`
4. `POST /api/sessions/:id/complete` — idempotent, token-gated, version-checked
5. `GET /api/listings/:id`
6. `POST /api/test/listings/:id/price` — dev-only harness

**Done when**: all endpoints return the shapes documented in `rules/api.md`; CORS allows the web dev origin; `curl` can drive a full session lifecycle manually.

---

## Phase 5 — Shared client

Build `packages/client` per `rules/resilience.md`:

- `sessionClient.ts` — thin typed wrappers around every endpoint
- `retry.ts` — exponential backoff, `Idempotency-Key` generation and reuse, `If-Match` plumbing
- `countdown.ts` — client-authoritative countdown with server reconciliation
- `poll.ts` — poll with backoff, pause on `visibilitychange: hidden`, degraded-connection banner trigger

**Done when**: the package has no DOM imports, builds, and its unit tests pass against a mocked `fetch`.

---

## Phase 6 — Web surface

Build `/checkout/:id` in `apps/web` per `rules/rendering.md`:

- Fetch the session in the page frontmatter (server-side). Pass to the page.
- Render price, expiry, and listing in static HTML. No client code required to see them.
- Hydrate only the countdown and the complete button as islands.
- Render the correct UI for every state in the table in `rules/resilience.md`.

**Done when**: `curl http://localhost:4321/checkout/:id` returns HTML containing the current price and expiry inside the body before any `<script>` tag. All non-happy states are reachable and visually distinct.

---

## Phase 7 — Mobile surface

Build `/m/checkout/:id` per `rules/mobile.md`. Shares all logic from `packages/client`; differs only in styling and copy.

- On `POST /api/sessions`, pass `surface: "mobile"` so the backend records the entry surface for continuity analytics.
- Render a deep-link entry on the web `/checkout/:id` page (QR + copyable URL) so the handoff is demonstrable in a screen recording.

**Done when**: creating a session on `/checkout/:id`, then opening `/m/checkout/:id` for the same id, resumes mid-flow with correct countdown and state.

---

## Phase 8 — Scripted scenarios

Add the mandatory scenario tests per `rules/testing.md`. These are the artifact the rubric asks for.

- Resume on second surface
- Price change mid-flow (test harness mutates price → GET returns `price_changed` → complete fails → accept-price → complete succeeds)
- Duplicate completion (two concurrent attempts; exactly one `completed`, the other 409)
- Idempotent retry (same `Idempotency-Key` twice → identical response, one order)
- Expiration (short TTL fixture → GET returns `expired` → complete returns 410)

**Done when**: `pnpm -r --parallel test` passes all five scenarios in CI-equivalent output.
