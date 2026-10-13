# Monorepo Rules

## Layout

```
gametime-checkout-continuity/
├── apps/
│   ├── web/                       # @checkout/web — Astro
│   └── api/                       # @checkout/api — Hono
├── packages/
│   ├── types/                     # @checkout/types — TS interfaces, no runtime
│   └── client/                    # @checkout/client — framework-agnostic session client
├── pnpm-workspace.yaml
├── package.json                   # root scripts only, no runtime deps
├── tsconfig.base.json             # strict settings shared via "extends"
└── .claude/                       # rules, skills, settings
```

## Package names

Every workspace is scoped under `@checkout/*`:

- `@checkout/web`
- `@checkout/api`
- `@checkout/types`
- `@checkout/client`

## pnpm-workspace.yaml

```yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

## Workspace dependencies

Apps depend on packages. Packages do not depend on apps.

| Importer           | May import                                     |
| ------------------ | ---------------------------------------------- |
| `@checkout/web`    | `@checkout/types`, `@checkout/client`          |
| `@checkout/api`    | `@checkout/types`                              |
| `@checkout/client` | `@checkout/types`                              |
| `@checkout/types`  | nothing in this repo                           |

Use the `workspace:*` protocol in every internal dependency:

```json
"dependencies": {
	"@checkout/types": "workspace:*"
}
```

`@checkout/client` must not depend on anything DOM-specific. It is designed so a hypothetical React Native screen imports it unchanged. If you need `window` or `document`, pass it in via a parameter — do not reach for it inside the package.

## TypeScript

- One `tsconfig.base.json` at the root with `strict: true`, `moduleResolution: "bundler"`, `target: "ES2022"`.
- Each package has its own `tsconfig.json` that extends the base and sets its `outDir` / `rootDir`.
- Packages export via `exports` field in `package.json`, not via `main` only — avoids subpath import pain.

### Why no project references / composite

`@checkout/types` and `@checkout/client` are **source-exported** — their `package.json` main/types/exports point at `./src/index.ts`, not at a built `./dist/*.d.ts`. This keeps dev friction low (changes propagate without a build step).

Source-exported packages are incompatible with TypeScript project references, because `references` requires `composite: true` on the referenced project, and `composite: true` requires the referenced project to have been built. If you add `references` to `tsconfig.json`, you'll hit `TS6305` ("output file has not been built from source file") or `TS6306` ("referenced project must have setting composite: true").

The tradeoff accepted here: no `tsc -b` incremental builds, no enforced dep-direction from TypeScript. Dep direction is enforced by convention and by what `package.json` dependencies declare. `pnpm -r --parallel typecheck` runs each project's typecheck in parallel and handles the dependency graph via pnpm's own topology.

If this project ever needs a real production build pipeline, migrate `packages/*` to compiled packages: add a `build` script, point `exports` at `./dist`, re-add `composite: true` to the base and `references` to the per-package tsconfigs.

## Scripts

Root `package.json`:

```json
{
	"scripts": {
		"dev": "pnpm -r --parallel --if-present dev",
		"build": "pnpm -r --if-present build",
		"typecheck": "pnpm -r --parallel --if-present typecheck",
		"lint": "pnpm -r --parallel --if-present lint",
		"test": "pnpm -r --parallel --if-present test"
	}
}
```

Every package that has a dev loop defines `dev`. Every package that has code defines `typecheck`, `lint`, and (where applicable) `test`.

## Dev servers and ports

- `@checkout/api` → `http://localhost:3000`
- `@checkout/web` → `http://localhost:4321` (Astro default)

`pnpm dev` from the root launches both in parallel. The web app reads the API base URL from an environment variable (`API_BASE_URL`, default `http://localhost:3000`) so it's trivially overridable.

## CORS

The Hono API must enable CORS for `http://localhost:4321` in development. Use `hono/cors`:

```typescript
import { cors } from 'hono/cors';
app.use('*', cors({ origin: process.env.WEB_ORIGIN ?? 'http://localhost:4321', credentials: true }));
```

Do not use `origin: '*'` with credentials — some fetch calls will send cookies in a future auth iteration.

## What does not belong in the root

- Runtime dependencies (every dep lives in its owning workspace)
- Source files (only workspaces hold source)
- Framework-specific config (lives in the app)
