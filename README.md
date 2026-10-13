# Checkout Continuity

A prototype that lets a fan start checkout on one device, get interrupted, and resume on another. No duplicate orders, no stale inventory holds, no silent price bumps.

## What's in the box

- `apps/api` — Hono + Node. Source of truth for the checkout session.
- `apps/web` — Astro 5 (SSR, Node adapter) + Tailwind v4. Serves both `/checkout/:id` and `/m/checkout/:id`.
- `packages/types` — the TypeScript contract shared across the project.
- `packages/client` — framework-agnostic session client. Typed fetch wrappers, retry, idempotency, countdown, poller. The same code powers both routes and would power a React Native screen unchanged.

pnpm workspace, strict TypeScript everywhere.

## Running it

```bash
pnpm install
pnpm dev
```

- API: http://localhost:3000
- Web: http://localhost:4321

A listing is seeded at `listing-123` on boot. Create a session:

```bash
curl -X POST http://localhost:3000/api/sessions \
  -H 'Content-Type: application/json' \
  -d '{"listingId":"listing-123","surface":"web"}'
```

Visit `http://localhost:4321/checkout/<id>` and click **Open mobile view** to open the mobile surface in a second tab against the same session.

Force a price change to see the recovery flow:

```bash
curl -X POST http://localhost:3000/api/test/listings/listing-123/price \
  -H 'Content-Type: application/json' -d '{"price":699.00}'
```

Both tabs flip to `price_changed` within one poll cycle. The reserved price stays frozen; the fan has to **Accept new price** before completing.

### Tests

```bash
pnpm -r --parallel test
```

40 tests. Includes the five mandatory scenarios (resume on second surface, price change mid-flow, duplicate completion, idempotent retry, expiration), driven in-process against the Hono app via `app.request()`.

## Session state model

Six states, one TTL, two mechanisms for duplicate-order prevention.

| State             | Meaning                                                   | Terminal |
| ----------------- | --------------------------------------------------------- | -------- |
| `active`          | Hold valid, reserved price unchanged                      | No       |
| `price_changed`   | Live price diverged from the reserved price               | No       |
| `payment_pending` | A `/complete` request is in flight                        | No       |
| `completed`       | Order placed                                              | Yes      |
| `expired`         | TTL elapsed; hold released                                | Yes      |
| `failed`          | Payment or completion error; fan can retry → `active`     | No       |

```
create ──────────────► active
active ──price delta──► price_changed
price_changed ─accept─► active
active ──POST complete► payment_pending
payment_pending ──ok──► completed      (terminal)
payment_pending ─fail─► failed
failed ────retry─────► active
<any non-terminal> ─TTL► expired       (terminal)
```

TTL is 10 minutes from `createdAt` and never extended. `expiresAt` is the single source of truth — the client renders the countdown from it and reconciles on every successful poll. The server treats any session where `now > expiresAt` as `expired` on read, regardless of stored state.

Every transition increments a `version` field. Mutating requests must include `If-Match: <version>`. A stale version returns 409 with the current session so the client can reconcile without a second round trip.

## Resuming across surfaces

Both routes fetch the session **server-side** in the Astro frontmatter via `@checkout/client`, then pass the snapshot to islands as props. Hydration adds only three things: the countdown ticker, the complete button handler, and the session poller.

On a bad connection: `curl http://localhost:4321/checkout/:id` returns the event, seats, reserved price, and `expiresAt` in the HTML body before the first `<script>` tag. A fan standing outside the venue sees what they're buying before any JS downloads.

Both surfaces import the same logic from `packages/client`:

- `SessionClient` — typed endpoint wrappers; retry + idempotency live inside `complete`.
- `Poller` — 5s default interval, exponential backoff on failure (2s → 4s → 8s → 16s → 30s), pauses on `visibilitychange: hidden`, fires a degraded banner after 15s of sustained failure.
- `Countdown` — client-authoritative between polls. Overwrites the local anchor against the server's `expiresAt` on every response, and latches `onExpired` so it fires exactly once per anchor.

The mobile surface is a second Astro route (`/m/checkout/:id`), not a React Native app. The time budget didn't justify spinning up Expo. `packages/client` has no DOM dependencies: timers, `fetch`, `now()`, and `crypto` are all injectable or pulled from `globalThis`, so a native screen could use it unchanged.

## Stale inventory, price changes, duplicate completion

**Stale inventory.** TTL is enforced on every GET. The server reconciles `now > expiresAt` into the terminal `expired` state before responding. The client renders a dedicated "Your hold expired" screen with recovery context (which seats, which event) and a Start-over CTA that creates a new session.

**Price changes.** On every GET the server compares the live price (from the `PriceOracle` stub) against the session's `reservedPrice`. If they differ, the response flips to `price_changed` and includes both numbers. `/complete` returns 409 with `reason: "price_changed"` while state is `price_changed`. The fan has to `POST /accept-price` (with `If-Match`) before trying again. The old price stays frozen until that explicit acceptance, so the fan is never silently charged more.

**Duplicate completion.** Two mechanisms, both required:

1. **`completionToken`** — issued at session creation, cleared on the first successful `complete`. A second attempt with a stale or missing token 409s with the current (completed) session attached.
2. **`Idempotency-Key` header** — generated per logical attempt and reused across retries. The server stores `(sessionId, Idempotency-Key) → response` and returns the cached body byte-for-byte on retry. The cache check runs **before** any validation, so a retry with a stale `If-Match` or a bogus body still gets the original success back.

Together: `completionToken` protects against cross-device double-completion. `Idempotency-Key` makes retries from a flaky network safe. There's also a race branch for two concurrent completes with different idempotency keys: one wins the state transition to `payment_pending` and the other waits for it to resolve, then returns 409 with `reason: "already_completed"`. The scenario test asserts the payment stub was called exactly once.

## Tradeoffs

- **Simulated mobile over native.** I built the second surface as another Astro route so I could spend the time on state correctness. Because the shared client package has no DOM dependencies, a React Native screen could consume it later without touching the business logic.
- **In-memory storage.** Three `Map`s, no persistence across restarts. The assessment allowed it. The store module is a drop-in swap for Redis or Postgres.
- **Stubbed payment / inventory / pricing** behind the `PaymentGateway`, `InventorySource`, and `PriceOracle` interfaces. The default payment stub uses a deterministic PRNG so scenario tests are reproducible. The scenario suite swaps in a trivial always-OK stub.
- **Polling, not SSE.** A 5-second poll with exponential backoff is enough to demonstrate the continuity story. SSE would be the next step for battery life and faster propagation.
- **Decorative card form.** The inputs render exactly as the mock shows but aren't state-managed or validated. Since payment is stubbed, validating card inputs would widen scope away from the actual problem: state continuity across surfaces.
- **No TypeScript project references.** `packages/*` are source-exported (`main` points at `./src/index.ts`), which is incompatible with composite references. I spent longer than I'd like figuring out why `tsc` kept complaining before accepting the tradeoff. `pnpm -r --parallel typecheck` handles dependency ordering via workspace topology, so nothing's actually broken.
- **QR code dropped for a copyable link and "Open mobile view" button.** A QR encoding `localhost` is unscannable from a phone, so the QR was cargo-cult. In production this would be an App Links / Universal Links intent.
- **Race-handling in `/complete` uses a polling spin.** The loser waits up to 5s on a 5ms-interval poll for the winner's state transition, then returns 409. Fine for a prototype. A per-session promise map would be cleaner.

## What I'd do with more time

- **Measure performance end-to-end.** Lighthouse CI on both routes with a budget file, Server-Timing headers from the API, p50/p95 for `/complete` latency under the retry/backoff schedule, throttled-connection runs that verify the pre-script content stays load-bearing.
- **E2E tests with Playwright.** The current scenarios exercise the API in-process. Driving a real browser would catch regressions in the hydration path: pause-on-hidden, countdown reconciliation after a poll, the state flip when the server reports `price_changed` mid-session.
- **More edge-case coverage.** Clock drift mid-resume, two devices racing on `accept-price`, aggressive back-button after `complete`, payment-stub `pending` resolving on a different device than the one that initiated it. The state model should hold up; writing the matrix would prove it.
- **A real React Native app.** `packages/client` was built for this. A small Expo screen rendering the active state is a few hours of work. Wiring real deep links takes longer.
- **Richer checkout flow.** A pre-checkout seat picker that writes selections into the session, saved-cards against the actual `PaymentGateway` interface, promo codes mutating `currentPrice` through the pricing oracle, and a real receipt view off the completed state.
- **Clean up the race-handling in `/complete`.** Swap the polling spin for a per-session promise map so losers await the winner's resolved result directly. Reflect the actual terminal state in `reason` (`already_completed` vs `already_failed`) instead of always returning `already_completed`.
