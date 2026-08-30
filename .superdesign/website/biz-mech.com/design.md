---
version: "superdesign-alpha"
name: "Industrial Amber Workshop"
description: "Near-black dark-mode-default system built on an engine-grain texture, one rationed amber accent driving badges/CTAs/numerals, and a stenciled circular emblem as its visual anchor."
colors:
  background: "#000000"
  surface: "#141418"
  surface-muted: "#212529"
  text-primary: "#F0F0F0"
  text-secondary: "#6C757D"
  accent: "#F5C518"
  accent-alt: "#FFC107"
typography:
  display-lg:
    fontFamily: "Chakra Petch"
    fontSize: "56px"
    fontWeight: 600
    lineHeight: "1.2"
    letterSpacing: "1.1px"
  headline-md:
    fontFamily: "Chakra Petch"
    fontSize: "32px"
    fontWeight: 600
    lineHeight: "1.2"
    letterSpacing: "-0.6px"
  body-md:
    fontFamily: "Inter"
    fontSize: "20px"
    fontWeight: 300
    lineHeight: "1.5"
  label-md:
    fontFamily: "Inter"
    fontSize: "24px"
    fontWeight: 600
    lineHeight: "1.2"
  body-base:
    fontFamily: "Inter"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: "1.5"
  accent-serif:
    fontFamily: "Times New Roman"
    fontStyle: "italic"
    role: "quoted testimonial voice"
spacing:
  base: "8px"
  unit-sm: "4px"
  unit-md: "16px"
  gap: "24px"
  section-padding: "48px"
rounded:
  chip: "19px"
  card: "16px"
  control: "24px"
  pill: "40px"
  emblem: "800px"
components:
  button-primary:
    background: "#F5C518"
    text-color: "#0A0A0A"
    radius: "40px"
    height: "42px"
    padding: "8px 24px"
    hover-background: "#E0B015"
    hover-boxShadow: "rgba(245, 197, 24, 0.3) 0px 4px 12px 0px"
    hover-transform: "matrix(0.98, 0, 0, 0.98, 0, 0)"
  button-outline:
    background: "transparent"
    text-color: "#F5C518"
    radius: "40px"
    height: "42px"
    padding: "8px 24px"
    border: "1px solid rgb(245, 197, 24)"
    hover-background: "#F5C518"
    hover-color: "#000000"
  card-panel:
    background: "transparent"
    radius: "0px"
    padding: "0px"
  card-case-study:
    background: "#141418"
    radius: "16px"
    padding: "24px"
  chip-tag:
    background: "#212529"
    text-color: "#F0F0F0"
    radius: "19px"
    padding: "4px 16px"
  footer:
    background: "rgba(0, 0, 0, 0.6)"
---
# Industrial Amber Workshop
Source: https://www.biz-mech.com/

## Overview
This is a dark-mode-default, industrial-editorial system: near-black surfaces throughout, a single stenciled circular emblem as the hero's visual center, and one amber/gold accent (`#F5C518`) rationed across badges, links, numerals, and CTAs. Typography carries the identity — a squared, technical display face (Chakra Petch) for headlines against a light, humanist body face (Inter) — reading as a blend of Swiss structural rigor and shop-manual/workshop grit. A faint engine-grain texture sits behind everything, reinforcing the mechanical metaphor without ever competing with content.

## Composition
The first screen centers a circular badge-style emblem above a large centered headline, a one-line subhead, a row of four pill-shaped capability tags, and a quoted italic-accented statement — all vertically stacked and centered, generous negative space above and below. Below the fold, density increases sharply: a labeled section ("What I Fix") introduces a uniform 4-up card row, followed by a 3-up case-study row with heavier internal structure (badges, numerals, tag rows), then a 4-up horizontal process rail, a pull-quote card, and finally a centered CTA band and a compact footer. The deliberate choice is front-loading restraint (a nearly empty, centered hero) against a payoff of dense, evidence-heavy cards below — rejecting the alternative of spreading proof points across the fold, which would dilute the emblem's impact as the singular first-glance focal point.

## Colors
Background is dominant near-black (`#000000` ~66% of pixels, plus `#181818`/`#141418`-family tones ~26–29% for panels), confirming a true dark-mode-default rather than a gradient-driven hero. `#141418` serves as the primary card/panel surface (measured at ~49% declared area, reflecting its use across every card body). `#212529` is a muted structural tone for tag chips. Text ink is `#F0F0F0` for primary reading text. The accent `#F5C518` (with `#FFC107` as a close secondary amber) is tightly rationed — declared at only ~2.2% of area — appearing solely on: capability chip icons/borders, quoted emphasis words, numeral highlights, section rule marks, tag pills, and both CTA buttons. Everything structural (borders, dividers, secondary buttons) stays in neutral gray/black; no blue, purple, or red from the Bootstrap token set appears anywhere in the visible system — those remain unused primitives.

## Typography
Chakra Petch drives all display and headline moments — the hero title at 56px/600 with tight tracking (1.1px) and 32px/600 sub-headlines (e.g., each "Case Study" title) with slightly negative tracking (-0.6px), giving a technical, stenciled feel appropriate to the emblem. Inter carries all reading text: 20px/300 for hero subhead/lead copy, 24px/600 for bold inline labels, and a dense 14px/400 base for card body paragraphs. An italic Times New Roman treatment appears once, inside the pull-quote card, functioning as an accent-serif voice distinct from the sans-only system elsewhere — a single deliberate departure, not a secondary system.

## Layout
Content is centered and width-constrained with generous horizontal margins on desktop; the hero is a single centered column. Card grids use a strict base-8 spacing rhythm (4/8/16/24/48px gaps) and near-zero card radius on the primary panel grid, contrasted with 16px-radius rounded cards for case studies. Section labels use a left-accent-bar + icon + text pattern (a vertical amber rule beside an icon and heading) to open each band. The layout responds by column count only — no evidence of asymmetric spans; all grids observed are uniform-width row structures, not bento or masonry.

## Components
- **Navbar**: not present as a distinct persistent bar in the captured viewports — the page opens directly into the hero emblem; no nav links, logo bar, or sticky header is evidenced above the fold.
- **Hero emblem**: one circular badge graphic (wrench-and-gear seal) centered top of page, ~180px diameter, stacked above the display headline — the singular focal illustration of the page.
- **Capability chip row**: ×4 pill badges in a single centered horizontal cluster directly under the hero subhead. Surface: `#212529`-toned fill, radius 19px, small icon + label each (e.g. gear/chart/handshake/shield glyphs), amber-accented icon strokes.
- **Hero primary CTA**: not present as a visible filled button on the first screen in these captures — the hero terminates in the pill-chip row and quoted line, with no solid button beneath the headline. The definitive primary button is the amber-filled pill measured near the page end (see button-primary token): `#F5C518` fill, `#0A0A0A` text, 40px radius, 42px height, `8px 24px` padding, hover to `#E0B015` with `rgba(245, 197, 24, 0.3) 0px 4px 12px 0px` shadow and a slight 0.98 scale-down.
- **Secondary outline button**: paired beside the primary CTA near the page end; transparent fill, `#F5C518` text, 1px solid `rgb(245, 197, 24)` border, same 40px radius/42px height/`8px 24px` padding, hover inverts to solid amber fill with black text.
- **"What I Fix" card grid**: 4-up row of equal-width cards (icon-topped), each transparent/near-black surface, 0px radius, top-aligned icon glyph (robot, clipboard-list, graduation cap, cloud-check), bold heading, 2–3 line body paragraph beneath — no CTA, no chips, pure informational tiles.
- **Case study card family**: ×3 in a row, rounded 16px cards on `#141418` surface with generous internal padding. Anatomy top-to-bottom: small status pill badge (e.g. percentage/metric label) + icon top-right, oversized Chakra Petch numbered heading, italic-style subheading pairing (role · category), 3–4 line descriptive body with one bolded inline phrase, a large amber oversized-numeral/metric statement line, a secondary muted results line, a divider rule, and a closing row of 3–4 small tag chips. This is the richest, most detailed card family on the page.
- **Process rail**: ×4 numbered steps in a single horizontal row, each a bordered/underlined panel (amber bottom rule visible on each), icon top, "N. LABEL" heading in caps, short body sentence — a lighter-weight card than the case studies, no background fill distinction from the page.
- **Pull-quote card**: single wide card, `#141418`-toned surface, quote-mark icon top-left, italic serif-toned quoted statement, attribution line with the amber-highlighted role, closing row of small tag chips referencing model names — a single one-off unit, not repeated.
- **Stat/tag chip family**: recurring small pill badges (`#212529` fill, 19px radius) used inside case-study cards and the model-name row; consistent compact `4px 16px`-scale padding.
- **CTA/callout band**: centered text block (heading + one-line body) followed by a two-item cluster: the amber pill primary button and an outline-style secondary link/button beside it, plus a location/meta caption line below — full-width band, no card container, sits directly on page background.
- **Footer**: `rgba(0, 0, 0, 0.6)` translucent band, 2 inline links plus icon-labeled contact items, a divider rule above a centered copyright line with one amber-highlighted inline phrase.

## Graphics & Effects
A faint monochrome engine/gear photographic texture sits full-bleed behind the entire hero and lower sections at low opacity/darkened treatment — this is the page's only imagery, never a colorful gradient wash; it stays within the black-dominant palette so the page reads as textured-black, not photographic. No large-scale gradient backgrounds are present; the only soft blur effects are `blur(2px)`, `blur(4px)`, and `blur(6px)` backdrop filters used narrowly (likely on card edges or the emblem's shadow softening), not as full glassmorphic panels. Elevation is communicated through subtle surface-tone shifts (`#000000` → `#141418` → `#212529`) rather than heavy drop shadows; the one explicit shadow is the CTA hover state's `rgba(245, 197, 24, 0.3) 0px 4px 12px 0px` amber glow.

## Motion
Interactions are fast and utilitarian: `all 0.25s ease` and `all 0.2s ease` drive general hover/state transitions, with `transform 0.2s ease` isolated for scale-based press feedback (the CTA's 0.98 scale-down on hover). Loading/skeleton states use standard keyframe patterns (`progress-bar-stripes`, `spinner-border`, `spinner-grow`, `placeholder-glow`, `placeholder-wave`) for async or placeholder content. Motion overall is restrained and mechanical — quick eases, no springs or overshoot — matching the industrial, no-nonsense character of the type and layout.

## Guardrails
- Never fill the hero with a saturated gradient — background stays near-black; amber appears only in chip icons, the quote emphasis, and CTA buttons.
- Do not round the "What I Fix" and process-rail cards — they are 0px-radius flat panels, distinct from the 16px-rounded case-study cards.
- Keep the primary CTA pill radius at 40px, height 42px — do not merge it with the case-study card's 16px radius or the chip's 19px radius.
- Preserve the two-button CTA pairing (solid amber pill + amber-outline pill) at identical dimensions — never make the secondary button a different height or radius.
- Reserve Times New Roman italic exclusively for the single pull-quote — do not extend it to headlines or body copy elsewhere.
- Keep case-study cards as the only family carrying numerals, metric callouts, and tag-chip rows — do not add that density to the plainer 4-up feature grid.