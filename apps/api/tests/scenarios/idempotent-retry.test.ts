import { describe, expect, it } from 'vitest';
import { buildApp, createSession, postJson } from './helpers.js';

describe('scenario: idempotent retry', () => {
	it('two completions with the same Idempotency-Key return identical responses and run payment once', async () => {
		const { app, payment } = buildApp();
		const session = await createSession(app);

		const first = await postJson(
			app,
			`/api/sessions/${session.id}/complete`,
			{ completionToken: session.completionToken },
			{ 'Idempotency-Key': 'ID-1', 'If-Match': String(session.version) },
		);
		expect(first.status).toBe(200);

		const second = await postJson(
			app,
			`/api/sessions/${session.id}/complete`,
			// Intentionally bogus body + If-Match — idempotency cache must short-circuit before any validation.
			{ completionToken: 'bogus' },
			{ 'Idempotency-Key': 'ID-1', 'If-Match': '999' },
		);
		expect(second.status).toBe(first.status);
		expect(JSON.stringify(second.body)).toBe(JSON.stringify(first.body));
		expect(payment.calls).toHaveLength(1);
	});
});
