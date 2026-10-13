export type PollOptions<T> = {
	fetchFn: () => Promise<T>;
	onResult?: (value: T) => void;
	onError?: (err: unknown, consecutiveFailures: number) => void;
	onDegraded?: (consecutiveFailures: number) => void;
	intervalMs?: number;
	backoffSchedule?: number[];
	degradedAfterMs?: number;
	setTimeout?: (fn: () => void, ms: number) => unknown;
	clearTimeout?: (handle: unknown) => void;
	now?: () => number;
};

const DEFAULT_BACKOFF = [2000, 4000, 8000, 16000, 30000];
const DEFAULT_INTERVAL = 5000;
const DEFAULT_DEGRADED_MS = 15000;

export class Poller<T> {
	private opts: PollOptions<T>;
	private handle: unknown = null;
	private paused = false;
	private stopped = false;
	private failures = 0;
	private firstFailureAt: number | null = null;
	private degradedFired = false;
	private setT: (fn: () => void, ms: number) => unknown;
	private clearT: (handle: unknown) => void;
	private nowFn: () => number;

	constructor(opts: PollOptions<T>) {
		this.opts = opts;
		this.setT = opts.setTimeout ?? ((fn, ms) => setTimeout(fn, ms));
		this.clearT = opts.clearTimeout ?? ((h) => clearTimeout(h as ReturnType<typeof setTimeout>));
		this.nowFn = opts.now ?? (() => Date.now());
	}

	start(): void {
		this.stopped = false;
		this.schedule(0);
	}

	stop(): void {
		this.stopped = true;
		if (this.handle !== null) {
			this.clearT(this.handle);
			this.handle = null;
		}
	}

	pause(): void {
		this.paused = true;
		if (this.handle !== null) {
			this.clearT(this.handle);
			this.handle = null;
		}
	}

	resume(): void {
		if (!this.paused) return;
		this.paused = false;
		this.schedule(0);
	}

	private schedule(delay: number): void {
		if (this.stopped || this.paused) return;
		this.handle = this.setT(() => {
			this.handle = null;
			void this.tick();
		}, delay);
	}

	private async tick(): Promise<void> {
		if (this.stopped || this.paused) return;
		try {
			const value = await this.opts.fetchFn();
			this.failures = 0;
			this.firstFailureAt = null;
			this.degradedFired = false;
			this.opts.onResult?.(value);
			this.schedule(this.opts.intervalMs ?? DEFAULT_INTERVAL);
		} catch (err) {
			this.failures += 1;
			if (this.firstFailureAt === null) this.firstFailureAt = this.nowFn();
			this.opts.onError?.(err, this.failures);
			const sinceFirstFailure = this.nowFn() - (this.firstFailureAt ?? this.nowFn());
			if (!this.degradedFired && sinceFirstFailure >= (this.opts.degradedAfterMs ?? DEFAULT_DEGRADED_MS)) {
				this.degradedFired = true;
				this.opts.onDegraded?.(this.failures);
			}
			const schedule = this.opts.backoffSchedule ?? DEFAULT_BACKOFF;
			const delay = schedule[Math.min(this.failures - 1, schedule.length - 1)] ?? DEFAULT_INTERVAL;
			this.schedule(delay);
		}
	}
}
