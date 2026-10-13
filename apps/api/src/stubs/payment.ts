export type PaymentResult =
	| { status: 'ok'; reference: string }
	| { status: 'declined'; reason: string }
	| { status: 'pending'; reference: string };

export interface PaymentGateway {
	charge(input: { sessionId: string; amount: number; currency: 'USD' }): Promise<PaymentResult>;
}

function mulberry32(seed: number): () => number {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

export class DefaultPaymentGateway implements PaymentGateway {
	private rng: () => number;
	private pending: Map<string, 'ok' | 'declined'> = new Map();
	private calls: Array<{ sessionId: string; amount: number }> = [];

	constructor(seed = 1) {
		this.rng = mulberry32(seed);
	}

	setSeed(seed: number): void {
		this.rng = mulberry32(seed);
		this.pending.clear();
		this.calls = [];
	}

	callCount(): number {
		return this.calls.length;
	}

	resetCalls(): void {
		this.calls = [];
	}

	async charge(input: { sessionId: string; amount: number; currency: 'USD' }): Promise<PaymentResult> {
		this.calls.push({ sessionId: input.sessionId, amount: input.amount });

		const resolution = this.pending.get(input.sessionId);
		if (resolution) {
			this.pending.delete(input.sessionId);
			if (resolution === 'ok') {
				return { status: 'ok', reference: `pay_${input.sessionId}` };
			}
			return { status: 'declined', reason: 'card_declined' };
		}

		const r = this.rng();
		if (r < 0.85) {
			return { status: 'ok', reference: `pay_${input.sessionId}` };
		}
		if (r < 0.95) {
			return { status: 'declined', reason: 'card_declined' };
		}
		const nextResolution: 'ok' | 'declined' = this.rng() < 0.9 ? 'ok' : 'declined';
		this.pending.set(input.sessionId, nextResolution);
		return { status: 'pending', reference: `pay_${input.sessionId}_pending` };
	}
}
