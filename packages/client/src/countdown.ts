export type CountdownOptions = {
	expiresAt: string;
	now?: () => number;
	setInterval?: (fn: () => void, ms: number) => unknown;
	clearInterval?: (handle: unknown) => void;
	onTick?: (remainingMs: number) => void;
	onExpired?: () => void;
	tickMs?: number;
};

export class Countdown {
	private expiresAtMs: number;
	private now: () => number;
	private setInt: (fn: () => void, ms: number) => unknown;
	private clearInt: (handle: unknown) => void;
	private onTick?: (remainingMs: number) => void;
	private onExpired?: () => void;
	private tickMs: number;
	private handle: unknown = null;
	private firedExpired = false;

	constructor(opts: CountdownOptions) {
		this.expiresAtMs = Date.parse(opts.expiresAt);
		this.now = opts.now ?? (() => Date.now());
		this.setInt = opts.setInterval ?? ((fn, ms) => setInterval(fn, ms));
		this.clearInt = opts.clearInterval ?? ((h) => clearInterval(h as ReturnType<typeof setInterval>));
		this.onTick = opts.onTick;
		this.onExpired = opts.onExpired;
		this.tickMs = opts.tickMs ?? 1000;
	}

	remainingMs(): number {
		return Math.max(0, this.expiresAtMs - this.now());
	}

	isExpired(): boolean {
		return this.now() >= this.expiresAtMs;
	}

	reconcile(expiresAt: string): void {
		this.expiresAtMs = Date.parse(expiresAt);
		this.firedExpired = false;
	}

	start(): void {
		if (this.handle !== null) return;
		const tick = () => {
			const r = this.remainingMs();
			this.onTick?.(r);
			if (r <= 0 && !this.firedExpired) {
				this.firedExpired = true;
				this.onExpired?.();
				this.stop();
			}
		};
		tick();
		this.handle = this.setInt(tick, this.tickMs);
	}

	stop(): void {
		if (this.handle === null) return;
		this.clearInt(this.handle);
		this.handle = null;
	}
}
