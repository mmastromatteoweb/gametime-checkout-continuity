export type RetryOptions = {
	attempts?: number;
	baseMs?: number;
	factor?: number;
	maxMs?: number;
	sleep?: (ms: number) => Promise<void>;
	shouldRetry?: (error: unknown) => boolean;
};

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export class HttpError extends Error {
	readonly status: number;
	readonly body: unknown;
	constructor(status: number, body: unknown) {
		super(`HTTP ${status}`);
		this.status = status;
		this.body = body;
	}
}

export function isRetryable(error: unknown): boolean {
	if (error instanceof HttpError) {
		return error.status >= 500 && error.status < 600;
	}
	// Network / unknown errors retry.
	return true;
}

export async function retryWithBackoff<T>(fn: (attempt: number) => Promise<T>, opts: RetryOptions = {}): Promise<T> {
	const attempts = opts.attempts ?? 3;
	const base = opts.baseMs ?? 500;
	const factor = opts.factor ?? 2;
	const max = opts.maxMs ?? 4000;
	const sleep = opts.sleep ?? defaultSleep;
	const shouldRetry = opts.shouldRetry ?? isRetryable;

	let lastError: unknown;
	for (let attempt = 1; attempt <= attempts; attempt++) {
		try {
			return await fn(attempt);
		} catch (err) {
			lastError = err;
			if (attempt === attempts || !shouldRetry(err)) throw err;
			const delay = Math.min(max, base * Math.pow(factor, attempt - 1));
			await sleep(delay);
		}
	}
	throw lastError;
}
