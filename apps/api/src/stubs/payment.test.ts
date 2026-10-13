import { describe, expect, it } from 'vitest';
import { DefaultPaymentGateway } from './payment.js';

describe('DefaultPaymentGateway', () => {
	it('is deterministic for a given seed', async () => {
		const a = new DefaultPaymentGateway(42);
		const b = new DefaultPaymentGateway(42);
		const seqA: string[] = [];
		const seqB: string[] = [];
		for (let i = 0; i < 20; i++) {
			seqA.push((await a.charge({ sessionId: `s${i}`, amount: 10, currency: 'USD' })).status);
			seqB.push((await b.charge({ sessionId: `s${i}`, amount: 10, currency: 'USD' })).status);
		}
		expect(seqA).toEqual(seqB);
	});

	it('honors ~85/10/5 distribution over a large sample', async () => {
		const gw = new DefaultPaymentGateway(7);
		const counts = { ok: 0, declined: 0, pending: 0 };
		const N = 5000;
		for (let i = 0; i < N; i++) {
			const r = await gw.charge({ sessionId: `s${i}`, amount: 10, currency: 'USD' });
			counts[r.status]++;
		}
		expect(counts.ok / N).toBeGreaterThan(0.8);
		expect(counts.ok / N).toBeLessThan(0.9);
		expect(counts.declined / N).toBeGreaterThan(0.06);
		expect(counts.declined / N).toBeLessThan(0.14);
		expect(counts.pending / N).toBeGreaterThan(0.02);
		expect(counts.pending / N).toBeLessThan(0.08);
	});

	it('tracks call count and resets', async () => {
		const gw = new DefaultPaymentGateway(1);
		await gw.charge({ sessionId: 's', amount: 1, currency: 'USD' });
		await gw.charge({ sessionId: 's', amount: 1, currency: 'USD' });
		expect(gw.callCount()).toBe(2);
		gw.resetCalls();
		expect(gw.callCount()).toBe(0);
	});

	it('resolves a pending charge on the next call with the same sessionId', async () => {
		const gw = new DefaultPaymentGateway(1);
		// Force a pending first — try seeds until we land on pending in first call.
		let seed = 0;
		let first = await gw.charge({ sessionId: 'x', amount: 1, currency: 'USD' });
		while (first.status !== 'pending') {
			seed++;
			gw.setSeed(seed);
			first = await gw.charge({ sessionId: 'x', amount: 1, currency: 'USD' });
			if (seed > 500) throw new Error('could not reach pending');
		}
		const second = await gw.charge({ sessionId: 'x', amount: 1, currency: 'USD' });
		expect(second.status === 'ok' || second.status === 'declined').toBe(true);
	});
});
