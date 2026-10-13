import { beforeEach, describe, expect, it } from 'vitest';
import type { Listing } from '@checkout/types';
import { idempotency, listings, now, resetStore, seedListing, sessions, setNow } from './store.js';

const FIXTURE: Listing = {
	id: 'l-1',
	eventName: 'E',
	venue: 'V',
	eventStart: '2026-01-01T00:00:00Z',
	section: '1',
	row: '1',
	quantity: 1,
	currentPrice: 10,
	available: true,
};

describe('store', () => {
	beforeEach(() => resetStore());

	it('starts empty after reset', () => {
		expect(sessions.size).toBe(0);
		expect(listings.size).toBe(0);
		expect(idempotency.size).toBe(0);
	});

	it('seeds listings', () => {
		seedListing(FIXTURE);
		expect(listings.get('l-1')).toEqual(FIXTURE);
	});

	it('resets state between tests', () => {
		seedListing(FIXTURE);
		idempotency.set('k', { status: 200, body: {} });
		resetStore();
		expect(listings.size).toBe(0);
		expect(idempotency.size).toBe(0);
	});

	it('allows clock override via setNow', () => {
		setNow(() => 42);
		expect(now()).toBe(42);
		resetStore();
		expect(now()).not.toBe(42);
	});
});
