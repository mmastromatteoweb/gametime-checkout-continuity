import type {
	ApiError,
	CompleteRequest,
	CreateSessionRequest,
	Session,
	Surface,
} from '@checkout/types';
import { Hono, type Context } from 'hono';
import { idempotency, sessions } from '../store.js';
import { createSession, reconcileInPlace } from '../session-logic.js';
import type { Stubs } from '../stubs/index.js';

function err(obj: ApiError): ApiError {
	return obj;
}

export function sessionsRoutes(stubs: Stubs): Hono {
	const r = new Hono();

	r.post('/', async (c) => {
		const body = (await c.req.json().catch(() => null)) as Partial<CreateSessionRequest> | null;
		if (!body?.listingId || (body.surface !== 'web' && body.surface !== 'mobile')) {
			return c.json(err({ error: 'Invalid request body' }), 400);
		}
		const listing = stubs.inventory.getListing(body.listingId);
		if (!listing) {
			return c.json(err({ error: 'Listing not found', listingId: body.listingId }), 404);
		}
		if (!stubs.inventory.isAvailable(body.listingId)) {
			return c.json(err({ error: 'Listing unavailable' }), 409);
		}
		const price = stubs.pricing.getPrice(body.listingId);
		const session = createSession(listing, price, body.surface as Surface);
		sessions.set(session.id, session);
		return c.json(session, 201);
	});

	r.get('/:id', (c) => {
		const id = c.req.param('id');
		const session = sessions.get(id);
		if (!session) {
			return c.json(err({ error: 'Session not found', sessionId: id }), 404);
		}
		const livePrice = stubs.pricing.has(session.listingId)
			? stubs.pricing.getPrice(session.listingId)
			: session.currentPrice;
		reconcileInPlace(session, livePrice);
		return c.json(session, 200);
	});

	r.post('/:id/accept-price', async (c) => {
		const id = c.req.param('id');
		const session = sessions.get(id);
		if (!session) {
			return c.json(err({ error: 'Session not found', sessionId: id }), 404);
		}
		const livePrice = stubs.pricing.getPrice(session.listingId);
		reconcileInPlace(session, livePrice);
		if (session.state === 'expired') {
			return c.json(err({ error: 'Session expired', current: session }), 410);
		}
		const ifMatch = c.req.header('If-Match');
		if (ifMatch !== String(session.version)) {
			return c.json(err({ error: 'Version mismatch', current: session }), 409);
		}
		session.reservedPrice = session.currentPrice;
		session.listing.reservedPrice = session.currentPrice;
		session.state = 'active';
		session.version += 1;
		return c.json(session, 200);
	});

	r.post('/:id/complete', async (c) => {
		const id = c.req.param('id');
		const session = sessions.get(id);
		if (!session) {
			return c.json(err({ error: 'Session not found', sessionId: id }), 404);
		}

		const idemKey = c.req.header('Idempotency-Key');
		if (!idemKey) {
			return c.json(err({ error: 'Missing Idempotency-Key header' }), 400);
		}
		const cacheKey = `${id}:${idemKey}`;
		const cached = idempotency.get(cacheKey);
		if (cached) {
			return c.json(cached.body as object, cached.status as 200 | 402 | 409 | 410);
		}

		// Read the body up front so all subsequent validation runs in one synchronous
		// block — important for concurrent completion requests on the same session.
		const body = (await c.req.json().catch(() => null)) as Partial<CompleteRequest> | null;

		const livePrice = stubs.pricing.getPrice(session.listingId);
		reconcileInPlace(session, livePrice);

		if (session.state === 'expired') {
			return c.json(err({ error: 'Session expired', current: session }), 410);
		}
		if (session.state === 'price_changed') {
			return c.json(
				err({ error: 'Price changed', reason: 'price_changed', current: session }),
				409,
			);
		}
		if (session.state === 'completed') {
			return c.json(
				err({ error: 'Already completed', reason: 'already_completed', current: session }),
				409,
			);
		}
		if (session.state === 'payment_pending') {
			const deadline = Date.now() + 5000;
			while (session.state === 'payment_pending' && Date.now() < deadline) {
				await new Promise((r) => setTimeout(r, 5));
			}
			return c.json(
				err({ error: 'Already completed', reason: 'already_completed', current: session }),
				409,
			);
		}

		if (!body?.completionToken || body.completionToken !== session.completionToken) {
			return c.json(err({ error: 'Invalid completion token', current: session }), 409);
		}
		const ifMatch = c.req.header('If-Match');
		if (ifMatch !== String(session.version)) {
			return c.json(
				err({ error: 'Version mismatch', reason: 'version_mismatch', current: session }),
				409,
			);
		}

		session.state = 'payment_pending';
		session.version += 1;

		let result = await stubs.payment.charge({
			sessionId: session.id,
			amount: session.reservedPrice,
			currency: 'USD',
		});
		if (result.status === 'pending') {
			result = await stubs.payment.charge({
				sessionId: session.id,
				amount: session.reservedPrice,
				currency: 'USD',
			});
		}

		let responseBody: Session | ApiError;
		let status: number;
		if (result.status === 'ok') {
			session.state = 'completed';
			session.completionToken = null;
			session.version += 1;
			responseBody = session;
			status = 200;
		} else {
			session.state = 'failed';
			session.lastError = result.status === 'declined' ? result.reason : 'payment_error';
			session.version += 1;
			responseBody = session;
			status = 402;
		}

		idempotency.set(cacheKey, { status, body: responseBody });
		return c.json(responseBody as object, status as 200 | 402);
	});

	const notAllowed = (c: Context) =>
		c.json({ error: 'Method not allowed' } satisfies ApiError, 405);
	r.all('/', notAllowed);
	r.all('/:id', notAllowed);
	r.all('/:id/accept-price', notAllowed);
	r.all('/:id/complete', notAllowed);

	return r;
}
