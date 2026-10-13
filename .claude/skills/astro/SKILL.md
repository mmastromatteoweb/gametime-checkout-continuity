# Astro Skill

Invoke this skill for any Astro-specific decision: routing, rendering modes, config, adapters, component syntax, integrations, slots, or content collections.

## How to use this skill

This skill connects to the official Astro documentation via MCP. When invoked, query the Astro docs server (configured in `.mcp.json`) for the relevant topic before writing any Astro-specific code.

**Invoke this skill when:**

- Configuring `astro.config.mjs` (output mode, adapter, integrations)
- Writing `.astro` component syntax (frontmatter, slots, expressions)
- Setting up routing (`getStaticPaths`, dynamic routes, `prerender`)
- Using Astro adapters (`@astrojs/node`, standalone vs middleware mode)
- Writing API routes (`APIRoute` type, `APIContext`, response handling)
- Handling `<Fragment slot="...">` for head injection
- Using `set:html` or other Astro directives
- Debugging build errors specific to Astro

## Key Astro concepts for this project

### Hybrid output mode

`output: 'hybrid'` — SSG by default, opt-in to SSR per route. This is the core architectural decision. Pages with `export const prerender = true` are built at compile time. Pages without it (like API routes) are server-rendered on request.

### Rendering a page as SSG

```astro
---
export const prerender = true;

export async function getStaticPaths() {
	return [{ params: { slug: 'example-slug' } }];
}

const { slug } = Astro.params;
---
```

### Rendering an API route as SSR

```typescript
// src/pages/api/example/[slug].ts
import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ params }) => {
	return new Response(JSON.stringify({ ok: true }), {
		status: 200,
		headers: { 'Content-Type': 'application/json' },
	});
};
// No prerender export — SSR by default in hybrid mode
```

### Head slot injection

```astro
<!-- In a component -->
<Fragment slot="head">
	<script type="application/ld+json" set:html={JSON.stringify(data)} />
</Fragment>
```

```astro
<!-- In the layout -->
<head>
	<slot name="head" />
</head>
```

### set:html directive

Bypasses Astro's HTML escaping. Required for JSON-LD output. Only use for trusted, serialized data.

```astro
<script type="application/ld+json" set:html={JSON.stringify(structuredData, null, 2)} />
```

## Query the Astro docs

Use the `astro-docs` MCP server for any question not covered above. The server provides full, current documentation on all Astro APIs and patterns.
