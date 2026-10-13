import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { listingsRoutes, testListingsRoutes } from './routes/listings.js';
import { sessionsRoutes } from './routes/sessions.js';
import type { Stubs } from './stubs/index.js';

export type AppOptions = {
	stubs: Stubs;
	webOrigin?: string;
	allowTestRoutes?: boolean;
};

export function createApp(opts: AppOptions): Hono {
	const app = new Hono();

	app.use(
		'*',
		cors({
			origin: opts.webOrigin ?? 'http://localhost:4321',
			credentials: true,
		}),
	);

	app.use('*', async (c, next) => {
		await next();
		c.header('Cache-Control', 'no-store');
	});

	app.get('/health', (c) => c.json({ ok: true }));

	app.route('/api/sessions', sessionsRoutes(opts.stubs));
	app.route('/api/listings', listingsRoutes(opts.stubs));

	if (opts.allowTestRoutes) {
		app.route('/api/test/listings', testListingsRoutes(opts.stubs));
	}

	return app;
}
