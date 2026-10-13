import { describe, expect, it, vi } from 'vitest';
import { Poller } from './poll.js';

type Scheduled = { fn: () => void; ms: number; handle: number };

function fakeScheduler() {
	let next = 1;
	const pending: Scheduled[] = [];
	const api = {
		setTimeout: (fn: () => void, ms: number) => {
			const handle = next++;
			pending.push({ fn, ms, handle });
			return handle;
		},
		clearTimeout: (h: unknown) => {
			const i = pending.findIndex((p) => p.handle === h);
			if (i >= 0) pending.splice(i, 1);
		},
		pending,
		async flushNext() {
			const s = pending.shift();
			if (s) await s.fn();
		},
	};
	return api;
}

describe('Poller', () => {
	it('polls repeatedly on success and resets backoff', async () => {
		const sched = fakeScheduler();
		const fetchFn = vi.fn().mockResolvedValue('v');
		const onResult = vi.fn();
		const p = new Poller<string>({
			fetchFn,
			onResult,
			intervalMs: 5000,
			setTimeout: sched.setTimeout,
			clearTimeout: sched.clearTimeout,
		});
		p.start();
		expect(sched.pending[0]?.ms).toBe(0);
		await sched.flushNext();
		expect(onResult).toHaveBeenCalledWith('v');
		expect(sched.pending[0]?.ms).toBe(5000);
		await sched.flushNext();
		expect(fetchFn).toHaveBeenCalledTimes(2);
	});

	it('applies backoff schedule on consecutive failures', async () => {
		const sched = fakeScheduler();
		const fetchFn = vi.fn().mockRejectedValue(new Error('x'));
		const onError = vi.fn();
		const p = new Poller<string>({
			fetchFn,
			onError,
			backoffSchedule: [2000, 4000, 8000, 16000, 30000],
			setTimeout: sched.setTimeout,
			clearTimeout: sched.clearTimeout,
		});
		p.start();
		await sched.flushNext();
		expect(sched.pending[0]?.ms).toBe(2000);
		await sched.flushNext();
		expect(sched.pending[0]?.ms).toBe(4000);
		await sched.flushNext();
		expect(sched.pending[0]?.ms).toBe(8000);
		expect(onError).toHaveBeenCalledTimes(3);
	});

	it('fires onDegraded after sustained failures past degradedAfterMs', async () => {
		const sched = fakeScheduler();
		let now = 1000;
		const fetchFn = vi.fn().mockRejectedValue(new Error('x'));
		const onDegraded = vi.fn();
		const p = new Poller<string>({
			fetchFn,
			onDegraded,
			degradedAfterMs: 15000,
			now: () => now,
			setTimeout: sched.setTimeout,
			clearTimeout: sched.clearTimeout,
		});
		p.start();
		await sched.flushNext();
		expect(onDegraded).not.toHaveBeenCalled();
		now = 16_001;
		await sched.flushNext();
		expect(onDegraded).toHaveBeenCalledOnce();
	});

	it('pause/resume stops and restarts the polling cycle', async () => {
		const sched = fakeScheduler();
		const fetchFn = vi.fn().mockResolvedValue('v');
		const p = new Poller<string>({
			fetchFn,
			setTimeout: sched.setTimeout,
			clearTimeout: sched.clearTimeout,
		});
		p.start();
		p.pause();
		expect(sched.pending).toHaveLength(0);
		p.resume();
		expect(sched.pending).toHaveLength(1);
		await sched.flushNext();
		expect(fetchFn).toHaveBeenCalledOnce();
	});

	it('stop cancels pending work', () => {
		const sched = fakeScheduler();
		const p = new Poller<string>({
			fetchFn: () => Promise.resolve('v'),
			setTimeout: sched.setTimeout,
			clearTimeout: sched.clearTimeout,
		});
		p.start();
		p.stop();
		expect(sched.pending).toHaveLength(0);
	});
});
