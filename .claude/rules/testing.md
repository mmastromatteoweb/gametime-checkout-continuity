# Testing Rules

The rubric explicitly rewards "tests or scripted scenarios for the important state transitions." These are the single highest-leverage artifact in the submission after the state model itself. Build them.

## Runner

- **Vitest** in every workspace that has code (`@checkout/api`, `@checkout/web`, `@checkout/client`, `@checkout/types` only if it has runtime assertions).
- Co-located unit tests: `foo.ts` ↔ `foo.test.ts` next to it.
- Scenario tests: `apps/api/tests/scenarios/*.test.ts`. These hit the live Hono app via `app.request()` (Hono's in-process test helper), not over the network — no port binding, no flakes.

## Store reset

Every test gets a fresh in-memory store. Export a `resetStore()` from `apps/api/src/store.ts` and call it in `beforeEach`. Scenario tests that need a seeded listing call a `seedListing(listing)` helper.

## Clock control

Expiration tests must not use `setTimeout` with real time. Inject a `now()` function into the store module (default `Date.now`) and let tests override it. Alternatively, use `vi.useFakeTimers()`.

## Mandatory scenarios

Each is a single `*.test.ts` file in `apps/api/tests/scenarios/`. All five must pass before the submission ships.

### 1. `resume-on-second-surface.test.ts`

- Create a session with `surface: "web"`.
- GET the session (simulating the mobile route loading).
- Assert: state is `active`, the mobile GET returns the same `sessionId`, `reservedPrice`, `expiresAt`, and `version`.
- Fires `session_created` with `surface: "web"` and `session_resumed` with a different surface (if your `track()` stub records calls, assert them).

### 2. `price-change.test.ts`

- Create a session.
- Call `POST /api/test/listings/:id/price` with a higher value.
- GET the session. Assert state is `price_changed`, `reservedPrice` unchanged, `currentPrice` updated.
- Attempt `POST /complete`. Assert 409 with `reason: "price_changed"` and `current` populated.
- `POST /accept-price` with the correct `If-Match`. Assert state transitions back to `active` with the new `reservedPrice`.
- `POST /complete`. Assert state is `completed`.

### 3. `duplicate-completion.test.ts`

- Create a session.
- Fire two `POST /complete` calls concurrently, each with a **different** `Idempotency-Key`.
- Assert exactly one returns 200 with `completed`. The other returns 409 with `reason: "already_completed"` and `current` populated with the completed session.
- Assert the payment stub was invoked exactly once.

### 4. `idempotent-retry.test.ts`

- Create a session.
- Fire `POST /complete` with `Idempotency-Key: X`. Assert 200, `completed`.
- Fire `POST /complete` **again** with the same `Idempotency-Key: X`. Assert the response body is byte-identical to the first.
- Assert the payment stub was invoked exactly once total.

### 5. `expiration.test.ts`

- Create a session with a TTL short enough for the test (10 seconds is fine with fake timers; or override `now()` to jump past `expiresAt`).
- Advance time past `expiresAt`.
- GET the session. Assert state is `expired`.
- Attempt `POST /complete`. Assert 410 with `current` populated.

## Unit tests worth having

Not mandatory but low-cost and high-value:

- `packages/client/retry.test.ts` — backoff schedule, idempotency key reuse across retries, no retry on 4xx.
- `packages/client/countdown.test.ts` — reconciliation on new `expiresAt`, local tick continues without network, crosses zero → fires `expired`.
- `apps/api/src/stubs/payment.test.ts` — decline rate honors config, deterministic with seeded RNG.

## What not to test

- Astro page HTML snapshots. The server-rendered content is tested implicitly by scenario tests that exercise the API — not worth the maintenance.
- Styling, layout, visual regression. Out of scope for this submission.
- The CORS middleware. The scenario tests use in-process `app.request()`, which bypasses CORS entirely.
