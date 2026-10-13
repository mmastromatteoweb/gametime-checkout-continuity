import type { Session, Surface } from '@checkout/types';
import { createApp } from '../../src/app.js';
import { resetStore } from '../../src/store.js';
import { DefaultInventorySource } from '../../src/stubs/inventory.js';
import type { PaymentGateway, PaymentResult } from '../../src/stubs/payment.js';
import { DefaultPriceOracle } from '../../src/stubs/pricing.js';
import { DEFAULT_LISTING, seedDefault } from '../../src/stubs/seed.js';

export class StubPayment implements PaymentGateway {
	calls: Array<{ sessionId: string; amount: number }> = [];
	result: PaymentResult = { status: 'ok', reference: 'ref' };
	async charge(input: { sessionId: string; amount: number; currency: 'USD' }): Promise<PaymentResult> {
		this.calls.push({ sessionId: input.sessionId, amount: input.amount });
		return this.result;
	}
}

export function buildApp() {
	resetStore();
	const payment = new StubPayment();
	const inventory = new DefaultInventorySource();
	const pricing = new DefaultPriceOracle();
	seedDefault(pricing);
	const stubs = { payment, inventory, pricing };
	const app = createApp({ stubs, allowTestRoutes: true });
	return { app, stubs, payment };
}

export async function postJson(app: ReturnType<typeof createApp>, path: string, body: unknown, headers: Record<string, string> = {}): Promise<{ status: number; body: unknown }> {
	const res = await app.request(path, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', ...headers },
		body: JSON.stringify(body),
	});
	const text = await res.text();
	return { status: res.status, body: text ? JSON.parse(text) : null };
}

export async function getJson(app: ReturnType<typeof createApp>, path: string, headers: Record<string, string> = {}): Promise<{ status: number; body: unknown }> {
	const res = await app.request(path, { method: 'GET', headers });
	const text = await res.text();
	return { status: res.status, body: text ? JSON.parse(text) : null };
}

export async function createSession(app: ReturnType<typeof createApp>, surface: Surface = 'web'): Promise<Session> {
	const { status, body } = await postJson(app, '/api/sessions', {
		listingId: DEFAULT_LISTING.id,
		surface,
	});
	if (status !== 201) throw new Error(`createSession got ${status}`);
	return body as Session;
}
