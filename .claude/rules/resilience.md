# Resilience Rules

The checkout flow has to survive bad LTE in a stadium parking lot. These rules keep the UI honest when the network is not.

## Core principle

The fan should always know:

1. How much time they have left on their hold
2. Whether we are currently in sync with the server
3. What they should do next

Never show a blank screen, an indefinite spinner, or a dead state with no recovery path.

## Countdown

- The countdown is **client-authoritative between polls** so it keeps ticking offline.
- On every successful poll or mutation response, reconcile against the server's `expiresAt`. Overwrite the local anchor; do not drift from it.
- When `now >= expiresAt` locally, immediately render the `expired` UI without waiting for the next poll to confirm.
- Visual urgency threshold: under 60 seconds remaining, switch to a warning style.

## Polling

- Poll `GET /api/sessions/:id` every **5 seconds** while the tab is visible and the session is non-terminal.
- Pause polling on `visibilitychange` → hidden. Resume on visible with an immediate poll.
- On poll failure, back off: 2s → 4s → 8s → 16s → cap at 30s. Reset on first success.
- After **15 seconds** of consecutive poll failures, surface a non-blocking banner: "Reconnecting… your hold is still valid for Xs." Do not clear the UI.
- Stop polling once state is `completed` or `expired`.

## Completion request

- Transition optimistically to `payment_pending` in the UI the moment the fan taps complete. Server will confirm or reject.
- Attach `Idempotency-Key: <uuid>` on the first attempt. Reuse the same key for every retry of that same logical completion.
- Attach `If-Match: <version>` to catch stale-state races.
- Retry policy on network error or 5xx: **3 attempts total**, 500ms base, 2x backoff, max 4s. Do not retry on 4xx — those are intentional server responses.
- On 409 (conflict), re-fetch the session and route to the correct state UI (`price_changed`, already `completed` from another device, etc). Do not retry.
- On 410 (gone / expired), route to the `expired` UI with a clear recovery CTA.

## Cross-surface resume

- The resume URL (`/checkout/:id` and `/m/checkout/:id`) is the single entry point from a deep link, text message, or second device.
- The server-rendered shell must include the current session snapshot in the first HTML byte. No skeleton loader for price, expiry, or listing details.
- Hydration only adds: countdown ticking, polling, and the complete button handler. Everything load-bearing is already in the DOM.

## State UI requirements

Every non-happy state needs an explicit, named UI. Do not fall through to a generic error page.

| State             | Must show                                                 | Must offer                           |
| ----------------- | --------------------------------------------------------- | ------------------------------------ |
| `active`          | Price, listing, countdown                                 | Complete button                      |
| `price_changed`   | Old price, new price, delta, countdown                    | Accept new price, or abandon         |
| `payment_pending` | "Processing…" with disabled complete button               | Nothing — do not let them double-tap |
| `completed`       | Order confirmation                                        | Done                                 |
| `expired`         | "Your hold expired" with original listing context         | Start over (new session)             |
| `failed`          | Reason if known, otherwise "Something went wrong"         | Retry, or abandon                    |
| offline / poll down | Banner over current state: "Reconnecting… hold valid for Xs" | Nothing — keep current UI usable |

## Instrumentation

Fire these events via a stubbed `track(event, props)`. They do not need a real sink; they need to exist and be documented in the README.

- `session_created` — `{ sessionId, listingId, price, surface }`
- `session_resumed` — `{ sessionId, surface, timeSinceCreated, state }`
- `price_change_shown` — `{ sessionId, oldPrice, newPrice }`
- `price_change_accepted` — `{ sessionId }`
- `completion_attempted` — `{ sessionId, attempt, idempotencyKey }`
- `completion_succeeded` — `{ sessionId }`
- `completion_conflict` — `{ sessionId, reason }` (duplicate, stale version, price changed)
- `session_expired` — `{ sessionId, surface }`
- `poll_degraded` — `{ sessionId, consecutiveFailures }`

Continuity conversion = `session_resumed` → `completion_succeeded` where `surface` on resume differs from `surface` on create.
