# State Model Rules

The checkout session state model is the contract that binds the API, web surface, and mobile surface. Lock this before writing route handlers or UI.

## States

| State             | Meaning                                                                 | Terminal |
| ----------------- | ----------------------------------------------------------------------- | -------- |
| `active`          | Hold is valid, reserved price unchanged, fan can complete               | No       |
| `price_changed`   | Current price differs from the price reserved at session creation       | No       |
| `payment_pending` | A `complete` request is in flight; prevents double-submit               | No       |
| `completed`       | Order placed successfully                                               | Yes      |
| `expired`         | TTL elapsed before completion; hold released                            | Yes      |
| `failed`          | Payment or completion error; fan can retry (transitions back to active) | No       |

## Transitions

```
create ──────────────► active
active ──price delta──► price_changed
price_changed ─accept─► active
active ──POST complete► payment_pending
payment_pending ──ok──► completed      (terminal)
payment_pending ─fail─► failed
payment_pending ─idem─► active         (retry-safe reset on timeout)
failed ────retry─────► active
<any non-terminal> ─TTL► expired       (terminal)
```

Only these transitions are legal. The server rejects any client-driven transition that is not in this list.

## Session shape

```typescript
type SessionState =
	| 'active'
	| 'price_changed'
	| 'payment_pending'
	| 'completed'
	| 'expired'
	| 'failed';

type Session = {
	id: string;
	listingId: string;
	listing: ListingSnapshot; // frozen at creation
	reservedPrice: number; // price when session was created
	currentPrice: number; // live price (may differ)
	state: SessionState;
	createdAt: string; // ISO-8601
	expiresAt: string; // ISO-8601 — authoritative TTL
	version: number; // incremented on every state transition
	completionToken: string | null; // present only in `active`; consumed on complete
	lastError: string | null; // populated in `failed`
};
```

## Expiration

- TTL is **10 minutes** from `createdAt`. Set once at creation. Do not extend.
- `expiresAt` is the single source of truth. Clients render countdowns from this value, never from a client-side timer alone.
- The server treats any session where `now > expiresAt` as `expired` regardless of its last stored state (except `completed`).

## Price change detection

- On every `GET /api/sessions/:id`, compare `currentPrice` to `reservedPrice`. If different, return state `price_changed` with both values.
- `complete` is rejected (409) when `state === 'price_changed'`. The fan must explicitly POST `/accept-price` first.

## Duplicate completion prevention

Two mechanisms, both required:

1. **`completionToken`** — issued at session creation, consumed on the first successful `complete`. A second `complete` call with the same (or missing) token returns 409 with the existing `completed` session.
2. **`Idempotency-Key` header** — the client generates one UUID per logical completion attempt and reuses it across retries. The server stores the result keyed by this header for the session's lifetime so retries return the original response, not a new attempt.

Together: `completionToken` prevents cross-device double-completion; `Idempotency-Key` makes retries from a flaky network safe.

## Version field

Every state transition increments `version`. Clients include `If-Match: <version>` on mutating requests. A stale version returns 409 with the current session so the client can reconcile.

## Terminal states

`completed` and `expired` are terminal. No transitions out. API returns the final snapshot on any further GET.
