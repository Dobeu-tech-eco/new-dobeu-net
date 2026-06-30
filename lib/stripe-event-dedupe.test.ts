import { describe, it, expect, beforeEach } from "vitest";
import {
  rememberStripeEvent,
  forgetStripeEvent,
  __resetSeenStripeEventsForTests
} from "./stripe-event-dedupe";

describe("stripe-event-dedupe", () => {
  beforeEach(() => {
    __resetSeenStripeEventsForTests();
  });

  it("should remember new events", () => {
    expect(rememberStripeEvent("evt_1")).toBe(false);
    expect(rememberStripeEvent("evt_1")).toBe(true);
  });

  it("should forget events", () => {
    expect(rememberStripeEvent("evt_1")).toBe(false);
    forgetStripeEvent("evt_1");
    expect(rememberStripeEvent("evt_1")).toBe(false);
  });

  it("should drop oldest event when limit is reached", () => {
    const limit = 1000;
    for (let i = 0; i < limit; i++) {
      expect(rememberStripeEvent(`evt_${i}`)).toBe(false);
    }

    expect(rememberStripeEvent("evt_0")).toBe(true);

    expect(rememberStripeEvent(`evt_${limit}`)).toBe(false);

    expect(rememberStripeEvent("evt_0")).toBe(false);
  });
});
