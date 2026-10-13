import type { ApiError, TestSetPriceRequest } from '@checkout/types';
import { Hono } from 'hono';
import type { Stubs } from '../stubs/index.js';

export function listingsRoutes(stubs: Stubs): Hono {
	const r = new Hono();

	r.get('/:id', (c) => {
		const id = c.req.param('id');
		const listing = stubs.inventory.getListing(id);
		if (!listing) {
			return c.json({ error: 'Listing not found', listingId: id } satisfies ApiError, 404);
		}
		return c.json(listing, 200);
	});

	r.all('/:id', (c) =>
		c.json({ error: 'Method not allowed' } satisfies ApiError, 405),
	);

	return r;
}

export function testListingsRoutes(stubs: Stubs): Hono {
	const r = new Hono();

	r.post('/:id/price', async (c) => {
		const id = c.req.param('id');
		const body = (await c.req.json().catch(() => null)) as Partial<TestSetPriceRequest> | null;
		if (typeof body?.price !== 'number') {
			return c.json({ error: 'Invalid request body' } satisfies ApiError, 400);
		}
		const listing = stubs.inventory.getListing(id);
		if (!listing) {
			return c.json({ error: 'Listing not found', listingId: id } satisfies ApiError, 404);
		}
		listing.currentPrice = body.price;
		stubs.pricing.set(id, body.price);
		return c.json(listing, 200);
	});

	r.all('/:id/price', (c) =>
		c.json({ error: 'Method not allowed' } satisfies ApiError, 405),
	);

	return r;
}
