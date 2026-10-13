# Rendering Rules

## Core principle

Match the rendering model to the **volatility** of the data. In checkout, everything is session-bound, so nothing is SSG — but the difference between what the server renders and what the client hydrates is still load-bearing.

| Data                              | Volatility             | Where it renders                   |
| --------------------------------- | ---------------------- | ---------------------------------- |
| Listing title, section, row, qty  | Frozen at session create | SSR — in HTML on first byte      |
| Reserved price                    | Frozen at session create | SSR — in HTML on first byte      |
| Current price                     | Server-reconciled on GET | SSR — in HTML on first byte      |
| Session state (banner, CTA)       | Server-reconciled on GET | SSR — in HTML on first byte      |
| Expiration timestamp (`expiresAt`) | Fixed per session        | SSR as ISO string + `<time datetime>` |
| Countdown ticker                  | Per second              | Client-hydrated island             |
| State poll + reconciliation       | Every 5s                | Client-hydrated island             |
| Complete button handler           | On click                | Client-hydrated island             |

The rule of thumb: **if a crawler disabled JS doesn't see the fan what they're buying, how much, and how long they have — the renderer is wrong.** This is also what makes the page fast on a bad LTE connection: the critical state is already in the DOM before any JS downloads.

## Astro

- `output: 'hybrid'`, `adapter: node({ mode: 'standalone' })`.
- **No `prerender` export on any page in this app.** Sessions are per-fan; there is nothing static to pre-build.
- `/checkout/:id` and `/m/checkout/:id` fetch the session in frontmatter via `@checkout/client`, server-side, and pass the snapshot to islands as props.
- Fetch errors (404, 410) are handled in frontmatter and routed to the matching state UI — not thrown.

## Hydration

Keep hydration surface small. Each island does exactly one thing.

- `<Countdown client:load expiresAt={session.expiresAt} />` — ticks, reconciles with `expiresAt` on prop change, fires `expired` state when it crosses zero.
- `<SessionPoller client:load sessionId={session.id} initialVersion={session.version} />` — polls per `rules/resilience.md`, dispatches state updates to a tiny client-side store the other islands subscribe to.
- `<CompleteButton client:load sessionId={session.id} />` — handles the complete call with the shared client's retry/idempotency logic.

No full-page hydration. No framework runtime beyond what the islands import.

## astro.config.mjs

```js
import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import tailwind from '@astrojs/tailwind';

export default defineConfig({
	output: 'hybrid',
	adapter: node({ mode: 'standalone' }),
	integrations: [tailwind()],
});
```

Do not add integrations beyond what the islands require.

## What never happens on the client

- Session fetch on initial mount (it's already in the SSR props)
- Price computation (server does this, client renders it)
- Expiration determination (server reconciles on every GET; client just mirrors)
- Any state transition decision (server owns transitions; client renders the result)
