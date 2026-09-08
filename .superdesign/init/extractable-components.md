# Extractable components

Menu for Superdesign `DraftComponent` extraction. Props listed are page-varying / API only. Source lives in `components.md` / `layouts.md`.

## Layout

### SiteNav
- Source: `components/landing/SiteNav.tsx`
- Category: layout
- Description: Sticky marketing header — mark, availability, hash links, Universe menu, GitHub, ThemeToggle, Book-a-call CTA, mobile drawer.
- Extractable props: none (no public props; CTA uses `useLightbox().open("book")`)
- Hardcoded: NAV_LINKS (Work/Process/About/FAQ), Universe copy, availability styles, "Book a call", GitHub label `dobeutech`, all CSS

### SiteFooter
- Source: `components/landing/SiteFooter.tsx`
- Category: layout
- Description: Marketing footer with mark, tagline, four link columns, copyright, cookie-preferences opener.
- Extractable props: none
- Hardcoded: FOOTER_LINKS groups (Site/Account/Contact/Legal), tagline, brand cluster copy, cookie button

### LegalLayout
- Source: `components/landing/LegalLayout.tsx`
- Category: layout
- Description: Legal chrome — nav, back link, sticky sidebar, titled prose article, footer.
- Extractable props: title (string), lastUpdated (ISO date string), children
- Hardcoded: LEGAL_LINKS hrefs/labels, "Back to home", prose class names, sidebar "Legal" heading

### LightboxProvider
- Source: `components/landing/LightboxProvider.tsx`
- Category: layout
- Description: Booking/form/email dialog context; wraps marketing pages.
- Extractable props: children; context `open(tab?: "book"|"form"|"email")`, `close()`
- Hardcoded: dialog title/description, tab labels, dynamic LeadForm/BookingTab/TypeformTab

### DobeuMark
- Source: `components/brand/DobeuMark.tsx`
- Category: layout
- Description: Official three-circle mark SVG.
- Extractable props: className (string, size/layout only)
- Hardcoded: SVG paths, fills `#6B5CE7` / `#4A3FA8` / `#F4A261`, aria-label

### ThemeToggle
- Source: `components/theme-toggle.tsx`
- Category: layout
- Description: Icon button + menu for Light / Dark / System.
- Extractable props: none
- Hardcoded: Sun/Moon/Monitor icons, menu labels, ghost icon Button

## Basic

### Button
- Source: `components/ui/button.tsx`
- Category: basic
- Description: DS v2 CVA button.
- Extractable props: variant (`default`|`accent`|`outline`|`secondary`|`ghost`|`link`|`destructive`), size (`default`|`sm`|`lg`|`xl`|`icon`), asChild (boolean)
- Hardcoded: radius-md, hover brightness, 150ms ease-out, focus ring classes

### Card
- Source: `components/ui/card.tsx`
- Category: basic
- Description: Surface card; border XOR shadow.
- Extractable props: variant (`default`|`elevated`|`ghost`), padding (`default`|`compact`|`none`)
- Hardcoded: rounded-lg, p-7 / p-5, title display type

### CookieBanner
- Source: `components/CookieBanner.tsx`
- Category: basic
- Description: GDPR/CCPA first-visit banner + preferences dialog; mounted from AnalyticsProvider.
- Extractable props: none (reads `useCookieConsent()`; exposes `window.openCookiePreferences`)
- Hardcoded: category labels/descriptions, Accept/Decline/Manage copy, policy hrefs `/cookies` `/privacy`
