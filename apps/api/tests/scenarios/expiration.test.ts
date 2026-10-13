import { afterEach, describe, expect, it } from 'vitest';
import type { ApiError, Session } from '@checkout/types';
import { buildApp, createSession, getJson, postJson } from './helpers.js';
import { resetClock, setNow } from '../../src/store.js';

describe('scenario: expiration', () => {
	afterEach(() => resetClock());

	it('a session past expiresAt is reconciled to expired on GET and rejects completion with 410', async () => {
		const { app } = buildApp();
		const session = await createSession(app);
		const createdAtMs = Date.parse(session.createdAt);
		const expiresAtMs = Date.parse(session.expiresAt);
		expect(expiresAtMs - createdAtMs).toBe(10 * 60 * 1000);

		setNow(() => expiresAtMs + 1000);

		const resumed = await getJson(app, `/api/sessions/${session.id}`);
		expect(resumed.status).toBe(200);
		expect((resumed.body as Session).state).toBe('expired');

		const complete = await postJson(
			app,
			`/api/sessions/${session.id}/complete`,
			{ completionToken: session.completionToken },
			{ 'Idempotency-Key': 'k-exp', 'If-Match': String((resumed.body as Session).version) },
		);
		expect(complete.status).toBe(410);
		expect((complete.body as ApiError).current).toBeTruthy();
		expect(((complete.body as ApiError).current as Session).state).toBe('expired');
	});
});
