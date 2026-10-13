# Mobile Surface Rules

## Scope

The mobile surface is a **second Astro route**, not a React Native app. The assessment explicitly permits "a simulated mobile view or deep-link route" and the time budget doesn't justify spinning up Expo.

React Native is a stretch goal. If added, it imports `@checkout/client` unchanged. That's the entire point of putting the session logic in a shared package — the architecture is RN-ready without RN being present.

## URL shape

- `/m/checkout/:id` — the mobile resume route.
- The handoff from web is a URL (QR code on `/checkout/:id`, copyable link, SMS-style demo). Clicking it on a phone-sized viewport lands on the mobile route.
- In a real native app this URL would be an App Links / Universal Links intent. Document that in the README; don't build it.

## Surface signal

On `POST /api/sessions`, pass `surface: "mobile"` when the session is created from `/m/checkout/*` and `surface: "web"` when created from `/checkout/*`. This is what the continuity-conversion metric in `rules/resilience.md` reads to detect cross-surface completions.

## What differs from web

| Concern         | Web (`/checkout/:id`)         | Mobile (`/m/checkout/:id`)                    |
| --------------- | ----------------------------- | --------------------------------------------- |
| Viewport        | Default (full width)          | `width=device-width, initial-scale=1, viewport-fit=cover` |
| Primary CTA     | Inline button                 | Full-width, bottom-anchored, safe-area padded |
| Header          | Standard page header          | Native-style with back chevron                |
| Copy            | "Confirm purchase"            | "Tap to complete"                             |
| Countdown style | Inline, right-aligned         | Prominent, center-top                         |
| Modals/sheets   | Centered dialog               | Bottom sheet                                  |

## What is shared

Everything load-bearing. Both routes:

- Fetch the session server-side using `@checkout/client`
- Pass the same props to the same countdown / poller / complete islands
- Render the same required UI for every state in `rules/resilience.md`
- Use the same instrumentation events

The only forks are layout wrappers and the Tailwind classes applied to them.

## Deep-link demonstration

On `/checkout/:id`, render a small "Open on your phone" affordance:

- QR code encoding the full `/m/checkout/:id` URL for the current session
- A copyable text link below it

This makes the cross-surface handoff demonstrable in a screen recording without needing SMS or a real deep-link intent.

## What not to do

- Do not implement separate state logic for mobile. If the mobile surface diverges from web in anything beyond layout/copy, the shared-client abstraction is leaking and the review will catch it.
- Do not detect user-agent on the server to redirect `/checkout/:id` → `/m/checkout/:id`. Routes are chosen by the deep link, not by sniffing.
- Do not build a service worker or offline cache for mobile. Interesting, but out of scope for the time budget.
