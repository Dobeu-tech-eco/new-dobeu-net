/**
 * In-memory dedupe for Stripe webhook event IDs.
 *
 * Lives outside the route file because Next.js App Router route segments only
 * permit a fixed set of named exports (HTTP verbs + config). Putting the test
 * reset hook here keeps `app/api/webhooks/stripe/route.ts` legal while still
 * giving the test suite a way to clear state between cases.
 *
 * Backing store is a process-local `Set` with a bounded size — good enough for
 * a single-region serverless deployment. The real safety net is that every
 * downstream UPDATE is naturally idempotent (mirror-of-target-state), so a
 * missed dedupe just costs an extra database write, not correctness.
 */

const SEEN_EVENT_IDS = new Set<string>();
const SEEN_EVENT_LIMIT = 1000;

/**
 * Returns `true` if the event has been seen before. Otherwise records it and
 * returns `false`. Trims the oldest entry once the cap is reached.
 */
export function rememberStripeEvent(eventId: string): boolean {
  if (SEEN_EVENT_IDS.has(eventId)) return true;
  SEEN_EVENT_IDS.add(eventId);
  if (SEEN_EVENT_IDS.size > SEEN_EVENT_LIMIT) {
    const first = SEEN_EVENT_IDS.values().next().value;
    if (first) SEEN_EVENT_IDS.delete(first);
  }
  return false;
}

/** Allow Stripe to retry a failed event by dropping it from the dedupe set. */
export function forgetStripeEvent(eventId: string): void {
  SEEN_EVENT_IDS.delete(eventId);
}

/** Test-only hook so dedupe state doesn't bleed between cases. */
export function __resetSeenStripeEventsForTests(): void {
  SEEN_EVENT_IDS.clear();
}
