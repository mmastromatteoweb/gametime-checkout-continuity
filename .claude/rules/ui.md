# UI Rules

The `active`-state layout for both surfaces is designed in Figma: file key `kqeiH8zDO5ZvUr6iizChJU`, node `1:2`. Every other state is text-spec'd here. If a rule in this file conflicts with the mock, this file wins — the mock covers the happy path only.

## Design language

Pulled from the mock. These are approximate; use the Figma file for exact tokens if needed via the Figma MCP.

- **Palette**: near-black background, charcoal cards with a subtle 1px border, bright mint green (~`#8FEBB0`) for primary CTA + featured prices + success states, off-white primary text, muted gray secondary text, amber for warnings, red for errors.
- **Type**: sans-serif stack. Large bold display for prices and seat coordinates. Regular weight for body. Numeric-tabular for countdown digits so they don't jiggle.
- **Spacing**: generous card padding (24px), 24px gutter between the two columns on web.
- **Shape**: 8–12px rounded corners on cards, 999px (pill) on primary buttons.
- **Shadow**: subtle, barely perceptible — the aesthetic is flat with soft depth, not glossy.

## Layout — `active`

Follow the Figma mock. Both surfaces render the same session data:

- **Web (`/checkout/:id`)**: top progress bar, two-column body (payment form left, order summary + CTA right).
- **Mobile (`/m/checkout/:id`)**: single column, event header → ticket summary → price breakdown → payment inputs → bottom-anchored CTA.

## Decorative inputs

The design shows a full card-capture form (email, phone, cardholder, card number, exp, CVC, ZIP). Per `rules/stubs.md`, payment is stubbed — we are **not** validating or state-managing these fields.

- Render the inputs exactly as in the mock, pre-filled with the mock's example values (`alex.morrison@example.com`, `+1 (555) 019-2834`, `ALEXANDER J MORRISON`, `•••• •••• •••• 4092`, etc.).
- Do not attach `onChange`, `onBlur`, or validation. They are visual props.
- The Confirm & Pay button is wired to the real complete flow via `@checkout/client`; it ignores form field values.
- Do not add any note in the UI explaining this. The README documents the stub.

## Countdown — missing from the mock

The mock has no countdown slot. Add one. This is load-bearing per `rules/resilience.md`.

- **Web**: inside the Event Timing Metadata Bar on the right column, right-aligned, next to the "7:00 PM EST" row. Format: `Hold expires in M:SS`. Numeric-tabular.
- **Mobile**: pinned to the top of the Event Header card, center-aligned, slightly larger. Same format.
- **Color**: muted gray when > 2 minutes remain; amber when ≤ 2 minutes; red when ≤ 60 seconds.
- **Under 60s**: also render a non-dismissible warning banner at the very top of the viewport: `Hurry — your hold expires in M:SS.` Amber background.

## State specs

Each row below describes what replaces or overlays the `active` layout for that state.

### `price_changed`

- Banner slot at the top of the right-column order summary (web) or above the price breakdown (mobile):
  - Copy: `Price changed. Was $X.XX, now $Y.YY.`
  - Old price with strikethrough, new price in accent color (mint).
- Primary CTA label flips to **`Accept new price`** (still mint).
- Secondary text link below the CTA: **`Abandon and start over`**.
- The `Confirm & Pay` behavior is disabled until the fan clicks Accept.
- Countdown continues normally.

### `payment_pending`

- Primary CTA label flips to **`Processing…`** with an inline spinner.
- CTA is `aria-disabled="true"` and non-interactive.
- The rest of the layout dims to ~70% opacity.
- No modal. Do not navigate away.

### `completed`

- Replace the main content area with a centered confirmation card:
  - Large mint checkmark icon.
  - Heading: **`You're in.`**
  - Subheading: `{event name} • {section} / Row {row} / Seats {seats}`
  - Confirmation code line: `Order #{short-id}`.
- No further CTAs required. If space allows: a secondary "View tickets" link (decorative — no destination).
- Hide the progress bar top strip.

### `expired`

- Replace the main content area with a centered empty-state card:
  - Icon: clock with a slash.
  - Heading: **`Your hold expired.`**
  - Body: `The seats you held for {event name} — {section} / Row {row} / Seats {seats} — were released. Pricing may have changed.`
  - Primary CTA: **`Start over`** (creates a new session for the same listing).
- Hide the countdown everywhere else.

### `failed`

- Banner slot at the top of the order summary:
  - Copy: `Payment couldn't go through.` If `lastError` is set, append on a second line: `{lastError}`.
  - Amber or soft-red background.
- Primary CTA label flips to **`Try again`** (still mint).
- Secondary text link: **`Use a different payment method`** (decorative — no destination).
- Countdown continues normally.

### Offline / degraded poll

- Fixed non-blocking banner pinned to the top of the viewport, above the countdown warning banner if both are present:
  - Copy: `Reconnecting… your hold is still valid for M:SS.`
  - Neutral slate background, muted text.
  - No dismiss affordance.
- Rest of the UI remains fully interactive. The complete button still works (the retry logic in `@checkout/client` handles the network).

## Cross-surface handoff — missing from the mock

Per `rules/mobile.md`, the web `/checkout/:id` must offer a way to open the session on the mobile surface.

- **Placement (web)**: a small card in the right column, below the order summary. Mobile view does not render this card.
- **Content**: a prominent "Open mobile view" button that opens `/m/checkout/:id` in a new tab, plus a click-to-copy affordance showing the full URL.
- **Label**: `Continue on mobile` (header), `Open the mobile view in a new tab. Both surfaces share this session — state changes propagate across polls.` (subtext).
- No QR code: the demo runs on `localhost`, which is unreachable from a phone. In production this would be an App Links / Universal Links intent — document in the README.

## Seed data

`apps/api/src/stubs/seed.ts` must seed the listing shown in the mock so the implementation matches:

```typescript
{
  id: 'listing-123',
  eventName: 'Championship Cup: Finals — Blue Team vs. Green Team',
  venue: 'Civic Center Arena, Metropolis',
  eventStart: '2026-10-18T19:00:00-04:00',
  section: '106',
  row: '8',
  quantity: 2, // seats 14, 15
  currentPrice: 539.40,
  available: true,
}
```

Pricing stub seed: `pricing.set('listing-123', 539.40)`.

## Accessibility

Minimum bar — do not skip:

- Price, countdown, and state banners use `aria-live="polite"` so screen readers announce transitions.
- `<time datetime="...">` wraps the expiration timestamp.
- Primary CTA has a visible focus ring; the mint-on-dark palette has enough contrast but focus states must remain visible.
- Form inputs have associated `<label>` even though they're decorative.
- Icons that convey meaning (clock-expired, declined, offline) have `aria-label`; purely decorative icons have `aria-hidden="true"`.
