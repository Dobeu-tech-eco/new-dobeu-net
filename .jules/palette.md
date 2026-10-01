## 2024-05-24 - Async Loading States
**Learning:** Many interactive forms and async operations (like Intake Review) lack a visual loading indicator when an action is triggered, which leaves the user guessing whether the action succeeded or stalled, and lacks accessibility indicators.
**Action:** Always include a visual loading indicator (e.g., `Loader2` from `lucide-react`) alongside the loading text when buttons disable and show progress. Ensure buttons correctly set `aria-busy={pending}` and loading spinners use `aria-hidden="true"`.
