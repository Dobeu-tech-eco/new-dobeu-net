## 2024-05-24 - Dynamic imports for LightboxProvider tabs
**Learning:** Next.js First Load JS was high for the main landing page because LightboxProvider imported heavy components (LeadForm, BookingTab with calendly script, TypeformTab with embed script) directly.
**Action:** Used `next/dynamic` to dynamically import `LeadForm`, `BookingTab`, and `TypeformTab` in `LightboxProvider.tsx`. This delays loading the associated third-party scripts (calendly, typeform) and form code until the modal is actually opened, dropping the First Load JS for `/` from 400+ KB down to 199 KB.
