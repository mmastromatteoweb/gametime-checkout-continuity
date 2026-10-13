import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { seedDefault, stubs } from './stubs/index.js';

seedDefault(stubs.pricing);

const app = new Hono();

app.use(
	'*',
	cors({
		origin: process.env.WEB_ORIGIN ?? 'http://localhost:4321',
		credentials: true,
	}),
);

app.get('/health', (c) => c.json({ ok: true }));

const port = Number(process.env.PORT ?? 3000);

serve({ fetch: app.fetch, port }, (info) => {
	console.log(`api listening on http://localhost:${info.port}`);
});
