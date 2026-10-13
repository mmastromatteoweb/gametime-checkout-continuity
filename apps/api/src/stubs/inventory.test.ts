import { beforeEach, describe, expect, it } from 'vitest';
import { resetStore } from '../store.js';
import { DefaultInventorySource } from './inventory.js';
import { seedDefault, DEFAULT_LISTING } from './seed.js';
import { DefaultPriceOracle } from './pricing.js';

describe('DefaultInventorySource', () => {
	beforeEach(() => resetStore());

	it('returns null for unknown listings', () => {
		const inv = new DefaultInventorySource();
		expect(inv.getListing('nope')).toBeNull();
		expect(inv.isAvailable('nope')).toBe(false);
	});

	it('returns the seeded listing and reports available', () => {
		seedDefault(new DefaultPriceOracle());
		const inv = new DefaultInventorySource();
		expect(inv.getListing(DEFAULT_LISTING.id)).toEqual(DEFAULT_LISTING);
		expect(inv.isAvailable(DEFAULT_LISTING.id)).toBe(true);
	});

	it('markUnavailable flips isAvailable to false', () => {
		seedDefault(new DefaultPriceOracle());
		const inv = new DefaultInventorySource();
		inv.markUnavailable(DEFAULT_LISTING.id);
		expect(inv.isAvailable(DEFAULT_LISTING.id)).toBe(false);
	});

	it('reset() clears local unavailable set', () => {
		seedDefault(new DefaultPriceOracle());
		const inv = new DefaultInventorySource();
		inv.markUnavailable(DEFAULT_LISTING.id);
		inv.reset();
		expect(inv.isAvailable(DEFAULT_LISTING.id)).toBe(true);
	});
});
