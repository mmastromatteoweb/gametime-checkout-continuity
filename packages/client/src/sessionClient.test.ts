import { describe, expect, it, vi } from 'vitest';
import type { Session } from '@checkout/types';
import { SessionClient } from './sessionClient.js';
import { HttpError } from './retry.js';

function jsonResponse(status: number, body: unknown): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { 'Content-Type': 'application/json' },
	});
}

const FIXTURE: Session = {
	id: 's-1',
	listingId: 'l-1',
	listing: {
		id: 'l-1',
		eventName: 'E',
		venue: 'V',
		eventStart: '2026-01-01T00:00:00Z',
		section: '1',
		row: '1',
		quantity: 1,
		reservedPrice: 100,
	},
	reservedPrice: 100,
	currentPrice: 100,
	state: 'active',
	surface: 'web',
	createdAt: '2026-01-01T00:00:00Z',
	expiresAt: '2026-01-01T00:10:00Z',
	version: 1,
	completionToken: 'tok',
	lastError: null,
};

describe('SessionClient', () => {
	it('createSession POSTs JSON and parses the response', async () => {
		const fetch = vi.fn().mockResolvedValue(jsonResponse(201, FIXTURE));
		const c = new SessionClient({ baseUrl: 'http://api', fetch });
		const result = await c.createSession({ listingId: 'l-1', surface: 'web' });
		expect(result).toEqual(FIXTURE);
		expect(fetch).toHaveBeenCalledWith('http://api/api/sessions', expect.objectContaining({ method: 'POST' }));
		const init = fetch.mock.calls[0]![1] as RequestInit;
		expect(init.body).toContain('"listingId":"l-1"');
	});

	it('getSession GETs by id', async () => {
		const fetch = vi.fn().mockResolvedValue(jsonResponse(200, FIXTURE));
		const c = new SessionClient({ baseUrl: 'http://api/', fetch });
		await c.getSession('s-1');
		expect(fetch).toHaveBeenCalledWith('http://api/api/sessions/s-1', { method: 'GET' });
	});

	it('acceptPrice sends If-Match', async () => {
		const fetch = vi.fn().mockResolvedValue(jsonResponse(200, FIXTURE));
		const c = new SessionClient({ baseUrl: 'http://api', fetch });
		await c.acceptPrice('s-1', 7);
		const [, init] = fetch.mock.calls[0]!;
		expect((init as RequestInit).headers).toMatchObject({ 'If-Match': '7' });
	});

	it('complete reuses the same Idempotency-Key across retries', async () => {
		const fetch = vi
			.fn()
			.mockResolvedValueOnce(jsonResponse(503, { error: 'down' }))
			.mockResolvedValueOnce(jsonResponse(200, { ...FIXTURE, state: 'completed' }));
		const c = new SessionClient({
			baseUrl: 'http://api',
			fetch,
			retry: { sleep: () => Promise.resolve() },
		});
		const result = await c.complete('s-1', 1, { completionToken: 'tok' }, 'IDEM');
		expect(result.status).toBe(200);
		expect(fetch).toHaveBeenCalledTimes(2);
		for (const call of fetch.mock.calls) {
			const headers = (call[1] as RequestInit).headers as Record<string, string>;
			expect(headers['Idempotency-Key']).toBe('IDEM');
		}
	});

	it('complete throws HttpError on 409 without retrying', async () => {
		const fetch = vi.fn().mockResolvedValue(jsonResponse(409, { error: 'conflict' }));
		const c = new SessionClient({
			baseUrl: 'http://api',
			fetch,
			retry: { sleep: () => Promise.resolve() },
		});
		await expect(c.complete('s-1', 1, { completionToken: 'tok' }, 'K')).rejects.toBeInstanceOf(HttpError);
		expect(fetch).toHaveBeenCalledOnce();
	});

	it('complete returns 402 as a result (does not throw)', async () => {
		const fetch = vi.fn().mockResolvedValue(jsonResponse(402, { ...FIXTURE, state: 'failed' }));
		const c = new SessionClient({ baseUrl: 'http://api', fetch });
		const result = await c.complete('s-1', 1, { completionToken: 'tok' }, 'K');
		expect(result.status).toBe(402);
		expect(result.session.state).toBe('failed');
	});
});
