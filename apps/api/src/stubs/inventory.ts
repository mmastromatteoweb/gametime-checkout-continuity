import type { Listing } from '@checkout/types';
import { listings } from '../store.js';

export interface InventorySource {
	getListing(listingId: string): Listing | null;
	isAvailable(listingId: string): boolean;
}

export class DefaultInventorySource implements InventorySource {
	private unavailable: Set<string> = new Set();

	getListing(listingId: string): Listing | null {
		return listings.get(listingId) ?? null;
	}

	isAvailable(listingId: string): boolean {
		if (this.unavailable.has(listingId)) return false;
		const listing = listings.get(listingId);
		return listing?.available ?? false;
	}

	markUnavailable(listingId: string): void {
		this.unavailable.add(listingId);
	}

	reset(): void {
		this.unavailable.clear();
	}
}
