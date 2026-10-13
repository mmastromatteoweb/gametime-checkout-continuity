# Stub Rules

Payment, inventory, and pricing are stubbed behind clear interfaces. The assessment explicitly says they do not need to be real — but the interface boundary matters, because it's what demonstrates that the state model and API are independent of any particular backend.

All stubs live in `apps/api/src/stubs/`.

## PaymentGateway

```typescript
export type PaymentResult =
	| { status: 'ok'; reference: string }
	| { status: 'declined'; reason: string }
	| { status: 'pending'; reference: string };

export interface PaymentGateway {
	charge(input: { sessionId: string; amount: number; currency: 'USD' }): Promise<PaymentResult>;
}
```

Default stub:

- 85% `ok`
- 10% `declined` with `reason: 'card_declined'`
- 5% `pending` (resolves to `ok` or `declined` on the next call to `/complete` with the same idempotency key — exercises the `payment_pending` → `completed` / `failed` transitions)
- Deterministic with a seeded PRNG so scenario tests are reproducible. Export `setPaymentSeed(seed: number)` for tests.

## InventorySource

```typescript
export interface InventorySource {
	getListing(listingId: string): Listing | null;
	isAvailable(listingId: string): boolean;
}
```

Default stub reads from an in-memory `Map<string, Listing>`. `isAvailable` returns `true` unless the listing has been explicitly marked unavailable via a test helper.

## PriceOracle

```typescript
export interface PriceOracle {
	getPrice(listingId: string): number;
}
```

Default stub reads from an in-memory `Map<string, number>`. The test-harness endpoint `POST /api/test/listings/:id/price` mutates this map so scenario tests can force a price change on a listing that already has an active session.

## Wiring

The three stubs are instantiated once in `apps/api/src/stubs/index.ts` and injected into route handlers:

```typescript
export const stubs = {
	payment: new DefaultPaymentGateway(),
	inventory: new DefaultInventorySource(),
	pricing: new DefaultPriceOracle(),
};
```

Route handlers accept the stub bag as a dependency (either via Hono context or a thin factory). Scenario tests swap in configured instances before calling `app.request()`.

## What stubs do not do

- No network calls. Everything resolves synchronously (wrapped in `Promise.resolve` where the interface is async).
- No persistence. Reset by reinitializing the module or calling an exported `reset*()` function.
- No logging. Tests assert against call counts and the API response, not log output.
- No cross-talk. The payment stub does not read from the pricing map; the inventory stub does not consult payment. Keep them independent.

## Seeding

`apps/api/src/stubs/seed.ts` seeds the listing shown in the design mock so the implementation matches on first boot. See `rules/ui.md` for the exact object shape and values. Also exported as `seedDefault()` for scenario tests.
