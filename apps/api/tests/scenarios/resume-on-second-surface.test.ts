import { describe, expect, it } from 'vitest';
import type { Session } from '@checkout/types';
import { buildApp, createSession, getJson } from './helpers.js';

describe('scenario: resume on second surface', () => {
	it('a session created on web is readable from /api/sessions/:id as the mobile surface would', async () => {
		const { app } = buildApp();
		const web = await createSession(app, 'web');
		expect(web.state).toBe('active');
		expect(web.surface).toBe('web');

		const { status, body } = await getJson(app, `/api/sessions/${web.id}`);
		expect(status).toBe(200);
		const resumed = body as Session;
		expect(resumed.id).toBe(web.id);
		expect(resumed.reservedPrice).toBe(web.reservedPrice);
		expect(resumed.expiresAt).toBe(web.expiresAt);
		expect(resumed.version).toBe(web.version);
		expect(resumed.state).toBe('active');
	});
});
