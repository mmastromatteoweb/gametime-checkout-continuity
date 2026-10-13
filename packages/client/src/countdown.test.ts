import { describe, expect, it, vi } from 'vitest';
import { Countdown } from './countdown.js';

function iso(ms: number): string {
	return new Date(ms).toISOString();
}

describe('Countdown', () => {
	it('reports remaining time against injected now()', () => {
		let t = 1000;
		const c = new Countdown({ expiresAt: iso(10_000), now: () => t });
		expect(c.remainingMs()).toBe(9000);
		t = 11_000;
		expect(c.remainingMs()).toBe(0);
		expect(c.isExpired()).toBe(true);
	});

	it('ticks and fires onExpired exactly once when it crosses zero', () => {
		let t = 0;
		const onTick = vi.fn();
		const onExpired = vi.fn();
		let intFn: (() => void) | null = null;
		const c = new Countdown({
			expiresAt: iso(3000),
			now: () => t,
			setInterval: (fn) => {
				intFn = fn;
				return 1;
			},
			clearInterval: () => {},
			onTick,
			onExpired,
			tickMs: 1000,
		});
		c.start();
		expect(onTick).toHaveBeenCalledWith(3000);
		t = 1000;
		intFn!();
		t = 3000;
		intFn!();
		t = 4000;
		intFn!();
		expect(onExpired).toHaveBeenCalledTimes(1);
	});

	it('reconcile() updates expiresAt and re-arms the expired latch', () => {
		let t = 0;
		const onExpired = vi.fn();
		let intFn: (() => void) | null = null;
		const c = new Countdown({
			expiresAt: iso(1000),
			now: () => t,
			setInterval: (fn) => {
				intFn = fn;
				return 1;
			},
			clearInterval: () => {},
			onExpired,
			tickMs: 100,
		});
		c.start();
		t = 1500;
		intFn!();
		expect(onExpired).toHaveBeenCalledTimes(1);
		c.reconcile(iso(5000));
		c.start();
		expect(c.remainingMs()).toBe(3500);
	});
});
