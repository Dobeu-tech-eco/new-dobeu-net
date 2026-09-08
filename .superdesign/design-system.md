# Dobeu Design System — marketing surface

On-brand tokens for dobeu.net public pages. Source of truth: `app/globals.css` + `tailwind.config.ts` + Nunito in `app/layout.tsx`.

## Brand

- **Name:** Dobeu Tech Solutions · descriptor “AI operations for growing businesses”
- **Mark:** `public/brand/dobeu-symbol.svg` / `dobeu-wordmark.svg` / `dobeu-horizontal.svg`. Never substitute initials, emoji, or invented SVGs.
- **Voice:** terse, honest, anti-theater. Outcome-led for SMB operators (hours back, errors gone, you own the code). Do not lead with stack names (Claude, MCP, Next.js) above the fold.

## Color

| Role | Light | Dark |
| --- | --- | --- |
| Background | `#FFFFFF` | `#111120` |
| Foreground | `#111120` | `#FAFAFA` |
| Primary / CTA | violet `#5B4FD9` | coral amber `#F59555` |
| Accent | amber `#F59555` | violet `#6B5CE7` |
| Muted text | `hsl(243 6% 40%)` — **do not stack `/45` or `/50` opacity on this token**; WCAG AA needs ≥4.5:1 |
| Border | `hsl(245 55% 91%)` | `hsl(243 22% 19%)` |

Hero chips and conversion links must sit on a solid surface (`bg-card` / `bg-background`), never orange-on-orange gradient.

## Type

- Family: Nunito 400/500/600/700/800 for sans and display
- H1: `font-display font-extrabold tracking-tight leading-[1.02]`
- Body: 16–18px, muted only at full token strength
- Badge: 11px / 700 / uppercase / 0.03em

## Shape & motion

- Radius: sm 6 / md 12 / lg 20 / xl 24 / pill 999
- Buttons: `rounded-full` on marketing CTAs
- Cards: `rounded-2xl border border-border bg-card shadow-sm`
- Motion: respect `prefers-reduced-motion`; no `aria-live` on decorative typewriter

## Layout

- Container: centered, `max-w-6xl` marketing, 1rem pad
- Nav: sticky 60px, logo + availability + Services / Process / About / Pricing / FAQ + Book
- Footer: live properties only (dobeu.net, GitHub, dobeu.space if live). Never print dobeu.cloud, dobeutech.com, or dobeu.dev

## Components

- Primary CTA: solid primary, “Book a call”
- Secondary CTA: outline, pricing or case studies (not /labs)
- Ghost: “Tell me about your project”
- Cookie banner: compact bottom **bar** or corner card; must not cover hero CTAs or the mobile sticky book bar
