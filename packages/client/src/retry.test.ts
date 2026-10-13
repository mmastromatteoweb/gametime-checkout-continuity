import { describe, expect, it, vi } from 'vitest';
import { HttpError, isRetryable, retryWithBackoff } from './retry.js';

describe('retry', () => {
	it('retries up to attempts then throws', async () => {
		const fn = vi.fn().mockRejectedValue(new Error('boom'));
		const sleep = vi.fn().mockResolvedValue(undefined);
		await expect(retryWithBackoff(fn, { attempts: 3, sleep })).rejects.toThrow('boom');
		expect(fn).toHaveBeenCalledTimes(3);
		expect(sleep).toHaveBeenCalledTimes(2);
	});

	it('uses exponential backoff with cap', async () => {
		const fn = vi.fn().mockRejectedValue(new Error('x'));
		const sleep = vi.fn().mockResolvedValue(undefined);
		await expect(
			retryWithBackoff(fn, { attempts: 5, baseMs: 500, factor: 2, maxMs: 4000, sleep }),
		).rejects.toThrow();
		expect(sleep.mock.calls.map((c) => c[0])).toEqual([500, 1000, 2000, 4000]);
	});

	it('returns the result when the first attempt succeeds', async () => {
		const fn = vi.fn().mockResolvedValue('ok');
		await expect(retryWithBackoff(fn)).resolves.toBe('ok');
		expect(fn).toHaveBeenCalledOnce();
	});

	it('does not retry on 4xx HttpError', async () => {
		const fn = vi.fn().mockRejectedValue(new HttpError(409, { error: 'conflict' }));
		await expect(retryWithBackoff(fn, { attempts: 3, sleep: vi.fn() })).rejects.toBeInstanceOf(HttpError);
		expect(fn).toHaveBeenCalledOnce();
	});

	it('retries 5xx HttpError and network errors', () => {
		expect(isRetryable(new HttpError(502, null))).toBe(true);
		expect(isRetryable(new HttpError(409, null))).toBe(false);
		expect(isRetryable(new Error('network down'))).toBe(true);
	});
});
