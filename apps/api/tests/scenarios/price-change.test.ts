import { describe, expect, it } from 'vitest';
import type { ApiError, Session } from '@checkout/types';
import { buildApp, createSession, getJson, postJson } from './helpers.js';
import { DEFAULT_LISTING } from '../../src/stubs/seed.js';

describe('scenario: price change mid-flow', () => {
	it('runs the full price-change recovery flow', async () => {
		const { app, payment } = buildApp();
		const session = await createSession(app);
		const originalPrice = session.reservedPrice;

		const bump = await postJson(app, `/api/test/listings/${DEFAULT_LISTING.id}/price`, {
			price: originalPrice + 100,
		});
		expect(bump.status).toBe(200);

		const resumed = await getJson(app, `/api/sessions/${session.id}`);
		expect(resumed.status).toBe(200);
		const after = resumed.body as Session;
		expect(after.state).toBe('price_changed');
		expect(after.reservedPrice).toBe(originalPrice);
		expect(after.currentPrice).toBe(originalPrice + 100);
		expect(after.version).toBeGreaterThan(session.version);

		const blocked = await postJson(
			app,
			`/api/sessions/${session.id}/complete`,
			{ completionToken: session.completionToken },
			{ 'Idempotency-Key': 'k1', 'If-Match': String(after.version) },
		);
		expect(blocked.status).toBe(409);
		const blockedBody = blocked.body as ApiError;
		expect(blockedBody.reason).toBe('price_changed');
		expect(blockedBody.current).toBeTruthy();

		const accepted = await app.request(
			`/api/sessions/${session.id}/accept-price`,
			{ method: 'POST', headers: { 'If-Match': String(after.version) } },
		);
		expect(accepted.status).toBe(200);
		const acceptedBody = (await accepted.json()) as Session;
		expect(acceptedBody.state).toBe('active');
		expect(acceptedBody.reservedPrice).toBe(originalPrice + 100);

		const completed = await postJson(
			app,
			`/api/sessions/${session.id}/complete`,
			{ completionToken: session.completionToken },
			{ 'Idempotency-Key': 'k2', 'If-Match': String(acceptedBody.version) },
		);
		expect(completed.status).toBe(200);
		expect((completed.body as Session).state).toBe('completed');
		expect(payment.calls).toHaveLength(1);
	});
});
