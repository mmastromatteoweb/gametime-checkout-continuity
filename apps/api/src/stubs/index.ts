import { DefaultInventorySource } from './inventory.js';
import { DefaultPaymentGateway } from './payment.js';
import { DefaultPriceOracle } from './pricing.js';
import { seedDefault } from './seed.js';

export type Stubs = {
	payment: DefaultPaymentGateway;
	inventory: DefaultInventorySource;
	pricing: DefaultPriceOracle;
};

export function createStubs(seed = 1): Stubs {
	return {
		payment: new DefaultPaymentGateway(seed),
		inventory: new DefaultInventorySource(),
		pricing: new DefaultPriceOracle(),
	};
}

export const stubs: Stubs = createStubs();

export { seedDefault };
export * from './inventory.js';
export * from './payment.js';
export * from './pricing.js';
