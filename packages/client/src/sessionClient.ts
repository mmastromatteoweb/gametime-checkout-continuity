import type {
	CompleteRequest,
	CreateSessionRequest,
	Listing,
	Session,
	Surface,
} from '@checkout/types';
import { HttpError, isRetryable, retryWithBackoff, type RetryOptions } from './retry.js';
import { newIdempotencyKey } from './uuid.js';

export type Fetch = (input: string, init?: RequestInit) => Promise<Response>;

export type SessionClientOptions = {
	baseUrl: string;
	fetch?: Fetch;
	retry?: RetryOptions;
};

export type CompleteResult = { status: number; session: Session };

export class SessionClient {
	private baseUrl: string;
	private fetchFn: Fetch;
	private retryOpts?: RetryOptions;

	constructor(opts: SessionClientOptions) {
		this.baseUrl = opts.baseUrl.replace(/\/$/, '');
		this.fetchFn = opts.fetch ?? ((input, init) => fetch(input, init));
		this.retryOpts = opts.retry;
	}

	async createSession(input: CreateSessionRequest): Promise<Session> {
		const res = await this.fetchFn(`${this.baseUrl}/api/sessions`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(input),
		});
		return await this.parseJson<Session>(res, [201]);
	}

	async getSession(id: string): Promise<Session> {
		const res = await this.fetchFn(`${this.baseUrl}/api/sessions/${id}`, { method: 'GET' });
		return await this.parseJson<Session>(res, [200]);
	}

	async acceptPrice(id: string, version: number): Promise<Session> {
		const res = await this.fetchFn(`${this.baseUrl}/api/sessions/${id}/accept-price`, {
			method: 'POST',
			headers: { 'If-Match': String(version) },
		});
		return await this.parseJson<Session>(res, [200]);
	}

	async getListing(id: string): Promise<Listing> {
		const res = await this.fetchFn(`${this.baseUrl}/api/listings/${id}`, { method: 'GET' });
		return await this.parseJson<Listing>(res, [200]);
	}

	/**
	 * Completes the session with network-level retry.
	 * Reuses the same Idempotency-Key across retries.
	 * Returns the final response — may be 200 (completed) or 402 (failed).
	 * 4xx conflict responses throw an HttpError so the caller can reconcile.
	 */
	async complete(
		id: string,
		version: number,
		body: CompleteRequest,
		idempotencyKey?: string,
	): Promise<CompleteResult> {
		const key = idempotencyKey ?? newIdempotencyKey();
		return await retryWithBackoff(
			async () => {
				const res = await this.fetchFn(`${this.baseUrl}/api/sessions/${id}/complete`, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						'Idempotency-Key': key,
						'If-Match': String(version),
					},
					body: JSON.stringify(body),
				});
				if (res.status === 200 || res.status === 402) {
					const session = (await res.json()) as Session;
					return { status: res.status, session };
				}
				const errBody = await res.json().catch(() => null);
				throw new HttpError(res.status, errBody);
			},
			{
				attempts: this.retryOpts?.attempts ?? 3,
				baseMs: this.retryOpts?.baseMs ?? 500,
				factor: this.retryOpts?.factor ?? 2,
				maxMs: this.retryOpts?.maxMs ?? 4000,
				sleep: this.retryOpts?.sleep,
				shouldRetry: isRetryable,
			},
		);
	}

	private async parseJson<T>(res: Response, okStatuses: number[]): Promise<T> {
		if (!okStatuses.includes(res.status)) {
			const body = await res.json().catch(() => null);
			throw new HttpError(res.status, body);
		}
		return (await res.json()) as T;
	}
}

export type { Surface };
