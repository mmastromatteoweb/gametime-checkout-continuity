import type { Listing } from '@checkout/types';
import { seedListing } from '../store.js';
import type { DefaultPriceOracle } from './pricing.js';

export const DEFAULT_LISTING: Listing = {
	id: 'listing-123',
	eventName: 'Championship Cup: Finals — Blue Team vs. Green Team',
	venue: 'Civic Center Arena, Metropolis',
	eventStart: '2026-10-18T19:00:00-04:00',
	section: '106',
	row: '8',
	quantity: 2,
	currentPrice: 539.4,
	available: true,
};

export function seedDefault(pricing: DefaultPriceOracle): void {
	seedListing(DEFAULT_LISTING);
	pricing.set(DEFAULT_LISTING.id, DEFAULT_LISTING.currentPrice);
}
