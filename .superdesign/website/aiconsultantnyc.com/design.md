---
version: "superdesign-alpha"
name: "Amber Ledger Minimalism"
description: "Warm off-white editorial system with near-black display type, a single rationed amber-to-orange gradient accent, and flat white elevation cards."
colors:
  background: "#F2F0ED"
  surface: "#FFFFFF"
  surface-dark: "#222A39"
  text-primary: "#151C28"
  text-secondary: "#676F7E"
  accent: "#F59F0A"
  accent-tint: "rgba(245, 159, 10, 0.15)"
  border-hairline: "#E5E2DC"
typography:
  display-lg:
    fontFamily: "Inter"
    fontSize: "60px"
    fontWeight: 900
    lineHeight: "1"
    letterSpacing: "-1.5px"
  headline-md:
    fontFamily: "Inter"
    fontSize: "24px"
    fontWeight: 600
    lineHeight: "1.33"
    letterSpacing: "-0.6px"
  body-md:
    fontFamily: "Inter"
    fontSize: "20px"
    fontWeight: 400
    lineHeight: "1.4"
  label-md:
    fontFamily: "Inter"
    fontSize: "16px"
    fontWeight: 700
    lineHeight: "1.5"
    letterSpacing: "-0.4px"
  body-run:
    fontFamily: "Inter"
    fontSize: "18px"
    fontWeight: 400
    lineHeight: "1.5"
    color: "#676F7E"
  accent-eyebrow:
    fontFamily: "Inter"
    fontSize: "13px"
    fontWeight: 700
    letterSpacing: "0.06em"
    color: "#F59F0A"
spacing:
  base: "8px"
  gap: "24px"
  section-padding: "128px"
  card-gap: "16px"
rounded:
  control: "16px"
  card: "24px"
  chip: "9999px"
  pill: "9999px"
components:
  navbar:
    background: "rgba(251, 250, 249, 0.8)"
    backdrop-filter: "blur(12px)"
    height: "73px"
    radius: "0px"
    width: "100%"
  button-primary:
    background: "linear-gradient(135deg, rgb(245, 159, 10) 0%, rgb(249, 148, 31) 100%)"
    text-color: "#222A39"
    radius: "16px"
    height: "40px"
    shadow: "rgba(245, 159, 10, 0.4) 0px 4px 14px -2px"
  button-ghost:
    background: "transparent"
    text-color: "#151C28"
    radius: "0px"
    height: "60px"
    padding: "16px 0px"
  card-white:
    background: "#FFFFFF"
    radius: "24px"
    shadow: "rgba(21, 28, 40, 0.08) 0px 4px 24px -4px"
    padding: "40px"
  card-stat:
    background: "#FFFFFF"
    radius: "24px"
    shadow: "rgba(21, 28, 40, 0.08) 0px 4px 24px -4px"
    padding: "8px 24px"
  card-dark-panel:
    background: "#222A39"
    radius: "16px"
    padding: "24px"
    text-color: "#FFFFFF"
  card-translucent-band:
    background: "rgba(242, 240, 237, 0.5)"
    radius: "0px"
    padding: "128px 408px"
  chip-eyebrow:
    background: "rgba(245, 159, 10, 0.15)"
    text-color: "#F59F0A"
    radius: "9999px"
    padding: "8px 16px"
---
# Amber Ledger Minimalism
Source: https://aiconsultantnyc.com/

## Overview
This is a light-mode, editorial-minimalist consulting system: a warm off-white canvas (#F2F0ED, ~81% of pixels as rendered) carries near-black slab-weight Inter headlines, gray-blue body copy, and one rationed amber-orange gradient reserved almost exclusively for the primary CTA and eyebrow labels. There is no photography, no illustration beyond one small abstract node-diagram graphic — the system's texture comes entirely from type weight contrast, generous whitespace, flat white cards with soft ambient shadow, and short blockquote callouts with a colored left rule. It reads as trustworthy, understated, financial-services-adjacent: closer to Swiss-influenced editorial than to any glassmorphic or dark-mode-default aesthetic, aside from one deep navy interruption band mid-page.

## Composition
The first screen is strictly vertical and left-aligned: a square edge-to-edge navbar, then an oversized three-line display headline, two paragraphs of supporting body copy, a wrapped row of four pill-shaped trust chips, a CTA pair (solid gradient pill + text link with icon), and a small address/contact footer-style block — all inside a left-set column against open cream space at the right. Scrolling down, the rhythm alternates: a quote/callout block with an amber left-border, a two-column heading+diagram band, a dark navy full-bleed band holding stacked testimonial-style cards, a three-across stat-card grid, a two-column pros/cons list, an amber-tinted disclaimer band, an accordion FAQ list, and a closing two-column contact/CTA band before the footer. The deliberate choice is restraint: one accent color and no imagery-heavy hero, rejecting the more common saturated-gradient-hero/bento-grid approach in favor of density built from typographic hierarchy and card elevation alone.

## Colors
Background is #F2F0ED, an off-white cream (~81% pixel share plus the related #FFFFFF card fields at ~8%), establishing a paper-like, warm-neutral surface rather than true white or dark. #FFFFFF serves the surface role for cards, testimonial tiles, and FAQ rows, always lifted with a soft `rgba(21, 28, 40, 0.08) 0px 4px 24px -4px` shadow. #222A39 is a rationed dark-navy surface used only for one full-bleed interruption band and the footer contact panel — never the dominant background. Text ink is #151C28 for primary headings/body-strong and #676F7E for secondary/paragraph copy, giving a two-step gray hierarchy with no pure black. The single accent, #F59F0A (amber-orange, transitioning to rgb(249,148,31) in gradients), is tightly rationed: the nav CTA, hero CTA, eyebrow labels, stat numerals, list-item rules, and one tinted disclaimer band — never a background wash, always a small high-contrast punctuation mark against the cream field.

## Typography
All type is Inter, single-family, carrying the whole hierarchy through weight and size rather than mixed fonts. Display headlines run at 60px/900 with -1.5px tracking and lh 1, extremely tight and heavy — the system's loudest signal. Section headlines step down to 24px/600 with -0.6px tracking. Body copy alternates between a 20px/400 lh1.4 for hero-adjacent paragraphs and an 18px/400 lh1.5 gray (#676F7E) for running section copy. Labels and eyebrow tags use 16px/700 with -0.4px tracking, and stat/case-study numerals appear oversized in the same amber accent, far larger than any body size, functioning as the page's second loudest signal after the display headline. No serif or mono family appears; the amber color, not a type-family swap, is the system's accent device.

## Layout
Content is constrained to a 1152px max-width, centered, with a spacing scale of 8/16/24/32/40/128px — 128px marking major section padding, 24px the standard card/grid gap. The stat/case-study band is a 3-column grid (5 items, uneven wrap: a row of three then two), gap 24px, each cell a white 24px-radius shadow card. The pros/cons band is a 2-column grid (2 items) with an approximate 56/39 split. The dark navy testimonial band stacks cards in a 1-column, 4-item, 64px-gap vertical list. The mid-page translucent quote/definition rows repeat 3 across at 60%-width proportions with heavy 128px/408px padding, giving them wide letterbox margins rather than edge-to-edge fill. FAQ items are full-width 100%-span rows stacked with 24px radius per item. Nothing goes fully full-bleed except the navbar and the navy interruption band — everything else respects the centered container.

## Components
- **Navbar**: edge-to-edge square bar, 0px radius on all four corners, 73px tall, spans 100% viewport width, sticky, fill `rgba(251, 250, 249, 0.8)` with `backdrop-filter: blur(12px)`. Holds 7 items: wordmark (two-tone, second half in amber), 4 text nav links, a phone-number utility link, and a solid CTA pill. CTA: gradient fill `linear-gradient(135deg, rgb(245, 159, 10) 0%, rgb(249, 148, 31) 100%)`, text #222A39, radius 16px, height 40px.
- **Hero primary button**: the solid amber-gradient pill beneath the headline is the true primary — an observed ~16px-radius, ~48–52px-tall filled control matching the nav CTA's gradient and text-on-color treatment, paired beside a plain-text phone link with a small leading icon (not a button).
- **Trust chip row**: 4 pill-shaped tags wrapped under the hero paragraphs, tinted amber fill (`rgba(245, 159, 10, 0.15)`-class background), amber text, radius 9999px, small dot marker before each label — informational, non-interactive.
- **Ghost text button (mid-page utility)**: transparent fill, text #151C28, 0px radius, 60px height, 16px/0px padding — used as plain link-style row items rather than boxed buttons; ×8 instances scattered through content bands.
- **Blockquote callout card**: white surface, 24px radius, `rgba(21, 28, 40, 0.08) 0px 4px 24px -4px` shadow, amber left-border accent, padding ~8–24px; anatomy is a single emphasized paragraph with bold inline figures — one per major claim, appears twice in the "why hire" section.
- **Heading + diagram band**: two-column layout (56/39 split), left a stacked headline, right a small white node-and-line abstract graphic on a cream field — one instance, mid-page process intro.
- **Dark navy testimonial stack**: full-bleed #222A39 band containing rounded dark-navy sub-cards (radius ~16px) with white body text describing outcomes — 4 stacked vertically, 64px gap, each near full width of the band.
- **Stat / case-study card**: white surface, 24px radius, same ambient shadow, padding 40px; anatomy top-to-bottom: amber all-caps eyebrow label, oversized amber numeral or ratio (e.g., a number-to-number transform), a small gray unit label, then a gray descriptive paragraph. Arranged 3-across, 24px gap, 5 total cards (row of 3, then row of 2).
- **Pros/cons two-column list**: transparent background, 0px radius, icon-led headings ("thumb" glyphs) above two vertical lists, each list item left-bordered in amber (pro column) or neutral gray (con column), stacked with generous line-height.
- **Amber disclaimer band**: single-row translucent-amber tinted card, large rounded corners (~16–24px), centered short statement — a single visual callout, full width of container.
- **FAQ accordion row**: white surface, 24px radius, `rgba(21, 28, 40, 0.08) 0px 4px 24px -4px` shadow, padding 8px 24px, chevron-down affordance right-aligned; stacked full-width rows, expandable on click.
- **Contact/CTA closing band**: 2-column split — left an empty/white media-style card (24px radius), right a stack of icon-labeled contact rows (amber-tinted icon chips, radius ~12–16px) followed by a dark-navy CTA card (radius ~16px, white heading + gray subtext) inviting the closing action.
- **Footer**: transparent background, 7 links across a three-part layout (wordmark + tagline, address block, link list), hairline top border, closing copyright line centered below.

## Graphics & Effects
The only gradient fills are small and rationed: `linear-gradient(135deg, rgb(245, 159, 10) 0%, rgb(249, 148, 31) 100%)` covers just the CTA pill surfaces (roughly 0.1% of page pixels) — never the hero background. A soft vertical scrim, `linear-gradient(rgba(251, 250, 249, 0.8), rgba(251, 250, 249, 0.9), rgb(251, 250, 249))`, sits behind the navbar and any bordering media edge (~5.5% of page), fading toward solid cream to blend sticky-header content into the scroll. Elevation throughout is a single consistent ambient shadow, `rgba(21, 28, 40, 0.08) 0px 4px 24px -4px`, applied uniformly to every white card family — flat, soft, non-directional, never a hard drop shadow. The CTA additionally carries a warm glow shadow, `rgba(245, 159, 10, 0.4) 0px 4px 14px -2px`, giving it a lifted, glandular emphasis distinct from the neutral card shadows. Backdrop blur appears twice: `blur(12px)` on the sticky nav, `blur(4px)` on any smaller frosted chip surface. No noise, grain, starfield, or photographic texture is present — the canvas is flat and clean throughout.

## Motion
Interactions are fast and utilitarian: color/background/border transitions run at `0.15s cubic-bezier(0.4, 0, 0.2, 1)`, covering link and button color states; a broader `all 0.15s cubic-bezier(0.4, 0, 0.2, 1)` handles general hover state changes. Shadow and transform shifts (card lift, button press) use `box-shadow, transform 0.3s ease`. Scale-based press feedback runs on `transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)`. Entrance/exit keyframes (`fade-in`, `enter`, `exit`) govern FAQ accordion expand/collapse alongside an `accordion-up` keyframe for the collapse motion; a `pulse` keyframe is reserved for subtle idle-state emphasis (e.g., a live-status dot). All motion is quick (150–300ms), snappy, and non-bouncy — no spring/overshoot easing anywhere in the system.

## Guardrails
- Never fill the hero background with the amber gradient — it belongs only to CTA pills and small chip tints; the hero stays cream (#F2F0ED) with black display type.
- Never round the navbar's corners or inset it — it is a square, edge-to-edge, sticky bar at 73px, not a floating capsule.
- Never substitute the ghost/ text-link buttons' 0px-radius flat style for the primary CTA's 16px gradient pill, or vice versa.
- Never introduce a second accent hue or a serif/mono display face — Inter plus one amber is the entire type and color signature.
- Never turn the dark navy band into the page's dominant tone — it is a single rationed full-bleed interruption, not a dark-mode base.
- Keep all card shadows to the single soft ambient value; do not harden them into crisp drop shadows or add borders in place of shadow.