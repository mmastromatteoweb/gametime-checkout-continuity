# API Rules

The API is the source of truth for the checkout session. Web and mobile are both pure clients of it. All routes are SSR (no `prerender` export).

See [state-model.md](./state-model.md) for the `Session` type and legal transitions. See [resilience.md](./resilience.md) for client retry and idempotency rules.

## Surface

| Method | Path                                | Purpose                                |
| ------ | ----------------------------------- | -------------------------------------- |
| POST   | `/api/sessions`                     | Create a checkout session              |
| GET    | `/api/sessions/[id]`                | Resume / snapshot a session            |
| POST   | `/api/sessions/[id]/accept-price`   | Acknowledge a price change             |
| POST   | `/api/sessions/[id]/complete`       | Finalize the order (idempotent)        |
| GET    | `/api/listings/[id]`                | Stub listing lookup                    |
| POST   | `/api/test/listings/[id]/price`     | Test harness: force a price change     |

Only these methods. Return 405 for anything else on a route.

## Shared headers

Every response:

```
Content-Type: application/json
Cache-Control: no-store
```

Session routes are never cached by the CDN or browser. The data is per-fan and time-sensitive.

## POST /api/sessions

Create a session for a listing.

### Request

```json
{ "listingId": "listing-123", "surface": "web" }
```

- `surface` is `"web" | "mobile"` — recorded on the session for continuity instrumentation.

### Response

- `201` → full `Session` in state `active` with `completionToken` populated
- `404` → `{ error: "Listing not found", listingId }`
- `409` → `{ error: "Listing unavailable" }` when inventory is gone

## GET /api/sessions/[id]

Snapshot the session. This is the resume endpoint — both surfaces call it on mount and on every poll.

The server reconciles state on read:

- If `now > expiresAt`, transition to `expired` before responding.
- If `currentPrice !== reservedPrice`, respond with state `price_changed`.
- Otherwise, respond with the stored state.

### Response

- `200` → full `Session`
- `404` → `{ error: "Session not found", sessionId }`

Never 410 on a resume. The fan should always get the session object back so the UI can route to the right state.

## POST /api/sessions/[id]/accept-price

Ack a new price and transition `price_changed` → `active`.

### Required headers

```
If-Match: <session.version>
```

### Response

- `200` → updated `Session` in state `active` with the new `reservedPrice`
- `409` → `{ error: "Version mismatch", current: <Session> }` when `If-Match` is stale
- `410` → `{ error: "Session expired", current: <Session> }`

## POST /api/sessions/[id]/complete

Finalize the order. **This is the only mutating endpoint that must be idempotent.**

### Required headers

```
Idempotency-Key: <uuid>
If-Match: <session.version>
```

### Request

```json
{ "completionToken": "<token from session>" }
```

### Behavior

1. If an entry exists for `(sessionId, Idempotency-Key)`, return the stored response verbatim. Do not re-execute.
2. If `completionToken` is missing or does not match the session's current token, return 409.
3. If `If-Match` does not match `session.version`, return 409.
4. If state is `expired`, return 410. If `price_changed`, return 409 with `reason: "price_changed"`.
5. Transition to `payment_pending`, invoke the stubbed payment interface, then transition to `completed` or `failed`.
6. Store the final response keyed by `(sessionId, Idempotency-Key)` before returning.

### Response

- `200` → `Session` in state `completed`
- `402` → `Session` in state `failed` with `lastError` populated
- `409` → `{ error: string, reason: "price_changed" | "already_completed" | "version_mismatch", current: Session }`
- `410` → `{ error: "Session expired", current: Session }`

## GET /api/listings/[id]

Stub listing lookup. Returns the listing snapshot used to seed a session.

### Response

- `200` → `Listing`
- `404` → `{ error: "Listing not found", listingId }`

## POST /api/test/listings/[id]/price

Test harness. Lets scripted scenarios force a price change on a listing so dependent sessions flip to `price_changed` on their next GET.

### Request

```json
{ "price": 275 }
```

### Response

- `200` → updated `Listing`

Gate this behind `process.env.NODE_ENV !== 'production'` so it is not available in a hypothetical production build.

## Error shape

All error responses follow the same shape:

```typescript
type ApiError = {
	error: string;
	reason?: string;
	// Any additional context (sessionId, listingId, current session snapshot, etc.)
	[key: string]: unknown;
};
```

When returning a 409 or 410 on a session route, **always include the current `Session` snapshot** under `current`. The client needs it to reconcile without a second round trip.

## Storage

In-memory. A single module exports:

```typescript
sessions: Map<string, Session>;
listings: Map<string, Listing>;
idempotency: Map<string, { status: number; body: unknown }>; // key: `${sessionId}:${idempotencyKey}`
```

No persistence across restarts. Document this in the README.
