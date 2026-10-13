import { serve } from '@hono/node-server';
import { createApp } from './app.js';
import { seedDefault, stubs } from './stubs/index.js';

seedDefault(stubs.pricing);

const app = createApp({
	stubs,
	webOrigin: process.env.WEB_ORIGIN ?? 'http://localhost:4321',
	allowTestRoutes: process.env.NODE_ENV !== 'production',
});

const port = Number(process.env.PORT ?? 3000);

serve({ fetch: app.fetch, port }, (info) => {
	console.log(`api listening on http://localhost:${info.port}`);
});
