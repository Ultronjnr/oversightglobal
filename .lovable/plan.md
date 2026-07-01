## Goal

Redesign the public **Landing (Home) page** and add a new **Pricing page** to match the uploaded designs, without touching any app/portal logic. The home hero becomes a **5-slide auto-rotating carousel**, each slide carrying its own headline, bullet cards, stat card, and a **relevant, transparent background image that blends into the dark navy background**.

This is purely public-facing presentation work — no changes to auth, portals, backend, or routing guards.

## Scope Guardrails

- Only edit `src/pages/LandingPage.tsx`, add `src/pages/Pricing.tsx`, register one route in `src/App.tsx`, and add new generated background images under `src/assets/`.
- No changes to any portal, service, hook, or database code.
- Keep the existing `Logo`, design tokens (indigo/blue glassmorphism), and dark navy hero background.

## Part 1 — Homepage Hero: 5 auto-rotating slides

Rebuild the hero as a carousel that cycles automatically (every ~6 seconds), with a subtle fade/slide transition, pause-on-hover, and clickable dot indicators. Each slide matches the uploaded `synced-slide1–5` layout:

- Kicker: `FOR SOUTH AFRICAN SMES`
- Large two-color split headline (white + accent color)
- Three left "problem" cards (icon + title + subtitle)
- Right stat card ("WHERE IT'S GOING RIGHT NOW" style) with 3 red/amber/accent figures + a green "With Ovasyt…" summary line
- Each slide themed with its own accent color and a **transparent background image** faded into the navy backdrop

The five slides (content + accent + background image theme):

```
1. "Your business is leaking money. You just can't see where."
   Accent: red/blue · BG: cracked piggy bank / leaking coins motif
2. "If SARS asked for proof right now, could you find it?"
   Accent: amber · BG: magnifying glass over documents / audit motif
3. "Know exactly where every rand goes. Before it goes."
   Accent: blue · BG: flowing rand notes / directional arrows motif
4. "Stop running your business through WhatsApp."
   Accent: purple · BG: tangled chat bubbles / scattered messages motif
5. "Ovasyt usually pays for itself in unclaimed VAT alone."
   Accent: cyan · BG: stacked coins / recovered money motif
```

Background images will be generated as low-opacity, transparent PNGs so they blend seamlessly into the dark hero and never compete with the text (positioned right side, ~15–25% opacity, masked/faded edges).

## Part 2 — Homepage below-the-fold sections

Rebuild the remaining sections to match `landing-page.png`:
- "This is what 'we'll sort it out later' costs an SME" — 3 stat cards (R30k+, 1 in 4, 3 days)
- "The difference isn't subtle" — Spreadsheets/WhatsApp vs Ovasyt comparison
- "Spend control that doesn't slow you down" — 6 feature cards
- "Every invoice, SARS-checked before it's filed" — invoice scanning panel
- Testimonial band + final CTA + footer

## Part 3 — Pricing page

New page at route `/pricing` matching `pricing.png`:
- Header/nav (shared style with landing) + `PRICING` kicker + headline
- 3 pricing cards: Starter (R 1 290/mo), Growth (R 3 450/mo, "MOST POPULAR"), Enterprise (Custom)
- "Every detail, side by side" comparison table
- FAQ section (4 questions) + footer
- Nav "Pricing" link updated to route to `/pricing`

## Technical Notes

- Carousel: lightweight React state + `useEffect` interval (no new dependency), or reuse existing `embla`/shadcn carousel if already installed — will check and prefer the existing one.
- Background images: 5 generated transparent PNGs imported as ES6 assets, rendered with Tailwind opacity + gradient mask so they blend into `bg-background`.
- All colors via existing semantic tokens; accent-per-slide handled with inline theme classes already used in the current hero.
- `<title>`/meta stay app-appropriate.

## Deliverables

- Updated `src/pages/LandingPage.tsx` (carousel hero + refreshed sections)
- New `src/pages/Pricing.tsx`
- New route `/pricing` in `src/App.tsx`
- 5 new transparent background images in `src/assets/`
