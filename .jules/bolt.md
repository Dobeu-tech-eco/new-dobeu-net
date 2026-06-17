## 2023-10-27 - Lazy loading third-party embeds in Radix Dialogs
**Learning:** Initial bundle sizes can be bloated by heavy third-party components (like Typeform or Calendly embeds) that are wrapped inside hidden Modal/Dialog components (like Radix UI's Dialog), meaning the user downloads the JS before even opening the modal.
**Action:** Use Next.js `next/dynamic` to dynamically import heavy third-party embed components when they are conditionally rendered or hidden inside a Dialog by default. This shaves off unnecessary MBs from the initial page load JS payload.
