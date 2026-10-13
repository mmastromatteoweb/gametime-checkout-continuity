import type { Listing, Session } from '@checkout/types';

export type IdempotencyEntry = { status: number; body: unknown };

export const sessions: Map<string, Session> = new Map();
export const listings: Map<string, Listing> = new Map();
export const idempotency: Map<string, IdempotencyEntry> = new Map();

let clock: () => number = () => Date.now();

export function now(): number {
	return clock();
}

export function setNow(fn: () => number): void {
	clock = fn;
}

export function resetClock(): void {
	clock = () => Date.now();
}

export function resetStore(): void {
	sessions.clear();
	listings.clear();
	idempotency.clear();
	resetClock();
}

export function seedListing(listing: Listing): void {
	listings.set(listing.id, listing);
}
