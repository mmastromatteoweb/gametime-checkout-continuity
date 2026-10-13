import { describe, expect, it } from 'vitest';
import { DefaultPriceOracle } from './pricing.js';

describe('DefaultPriceOracle', () => {
	it('throws when a listing has no price', () => {
		const p = new DefaultPriceOracle();
		expect(() => p.getPrice('nope')).toThrow();
	});

	it('round-trips set/get', () => {
		const p = new DefaultPriceOracle();
		p.set('l', 123.45);
		expect(p.getPrice('l')).toBe(123.45);
	});

	it('mutates existing prices (so the test harness can force a change)', () => {
		const p = new DefaultPriceOracle();
		p.set('l', 100);
		p.set('l', 275);
		expect(p.getPrice('l')).toBe(275);
	});

	it('reset clears all prices', () => {
		const p = new DefaultPriceOracle();
		p.set('l', 100);
		p.reset();
		expect(p.has('l')).toBe(false);
	});
});
