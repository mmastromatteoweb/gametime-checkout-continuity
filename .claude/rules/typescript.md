# TypeScript Rules

## Shared types

All shared types live in `packages/types/src/index.ts` and are imported via `@checkout/types`. Never redefine them inline in `apps/web`, `apps/api`, or `packages/client`.

The source of truth for the shape is `rules/state-model.md`. If a type changes there, update `packages/types` first, then let the typechecker drive updates downstream.

### What belongs in `@checkout/types`

- `SessionState` union
- `Session`, `Listing`, `ListingSnapshot`
- API request bodies (`CreateSessionRequest`, `AcceptPriceRequest`, `CompleteRequest`)
- API response bodies (success and error — `ApiError` with optional `current: Session`)
- Analytics event payloads from `rules/resilience.md`'s `track()` list

### What does not belong there

- Component props — define inline where used
- Internal store shapes in `apps/api` — keep in `apps/api/src/store.ts`
- Framework types — those come from the framework

## Code quality

- Strict mode. No `any`. No non-null assertions without an explanatory comment.
- No dead code, no commented-out blocks, no `console.log` in production paths.
- PascalCase for components and types, camelCase for variables and functions, kebab-case for files.
- Each module has a single clear responsibility.
- Prefer `type` over `interface` for data shapes; use `interface` only when declaration merging is intentional.

## Checks

Run before marking any phase done:

```bash
pnpm -r --parallel --if-present typecheck
```

Zero errors required.
