import { randomUUID } from 'node:crypto';
import type { Listing, Session, Surface } from '@checkout/types';
import { now } from './store.js';

export const TTL_MS = 10 * 60 * 1000;

export function createSession(listing: Listing, currentPrice: number, surface: Surface): Session {
	const createdAt = now();
	return {
		id: randomUUID(),
		listingId: listing.id,
		listing: {
			id: listing.id,
			eventName: listing.eventName,
			venue: listing.venue,
			eventStart: listing.eventStart,
			section: listing.section,
			row: listing.row,
			quantity: listing.quantity,
			reservedPrice: currentPrice,
		},
		reservedPrice: currentPrice,
		currentPrice,
		state: 'active',
		surface,
		createdAt: new Date(createdAt).toISOString(),
		expiresAt: new Date(createdAt + TTL_MS).toISOString(),
		version: 1,
		completionToken: randomUUID(),
		lastError: null,
	};
}

/**
 * Mutates `session` in place to reflect expiry and price-change reconciliation.
 * Returns the same reference for convenience.
 */
export function reconcileInPlace(session: Session, livePrice: number): Session {
	if (session.state === 'completed') return session;

	const expiresAtMs = Date.parse(session.expiresAt);
	if (now() >= expiresAtMs && session.state !== 'expired') {
		session.state = 'expired';
		session.completionToken = null;
		session.version += 1;
		return session;
	}

	if (session.state === 'expired' || session.state === 'failed' || session.state === 'payment_pending') {
		return session;
	}

	if (livePrice !== session.reservedPrice) {
		session.currentPrice = livePrice;
		if (session.state !== 'price_changed') {
			session.state = 'price_changed';
			session.version += 1;
		}
	} else if (session.state === 'price_changed') {
		session.currentPrice = livePrice;
	}

	return session;
}
