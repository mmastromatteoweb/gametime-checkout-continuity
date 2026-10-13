import { describe, expect, it } from 'vitest';
import type { ApiError, Session } from '@checkout/types';
import { buildApp, createSession, postJson } from './helpers.js';

describe('scenario: duplicate completion', () => {
	it('exactly one of two concurrent completions with different Idempotency-Keys succeeds', async () => {
		const { app, payment } = buildApp();
		const session = await createSession(app);

		const complete = (idemKey: string) =>
			postJson(
				app,
				`/api/sessions/${session.id}/complete`,
				{ completionToken: session.completionToken },
				{ 'Idempotency-Key': idemKey, 'If-Match': String(session.version) },
			);

		const [a, b] = await Promise.all([complete('key-a'), complete('key-b')]);

		const statuses = [a.status, b.status].sort((x, y) => x - y);
		expect(statuses).toEqual([200, 409]);

		const ok = a.status === 200 ? a : b;
		const conflict = a.status === 409 ? a : b;
		expect((ok.body as Session).state).toBe('completed');

		const conflictBody = conflict.body as ApiError;
		expect(conflictBody.reason).toBe('already_completed');
		expect(conflictBody.current).toBeTruthy();
		expect((conflictBody.current as Session).state).toBe('completed');

		expect(payment.calls).toHaveLength(1);
	});
});
