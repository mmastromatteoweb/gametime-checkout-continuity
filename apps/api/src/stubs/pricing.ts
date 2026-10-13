export interface PriceOracle {
	getPrice(listingId: string): number;
}

export class DefaultPriceOracle implements PriceOracle {
	private prices: Map<string, number> = new Map();

	getPrice(listingId: string): number {
		const price = this.prices.get(listingId);
		if (price === undefined) {
			throw new Error(`No price for listing ${listingId}`);
		}
		return price;
	}

	set(listingId: string, price: number): void {
		this.prices.set(listingId, price);
	}

	has(listingId: string): boolean {
		return this.prices.has(listingId);
	}

	reset(): void {
		this.prices.clear();
	}
}
