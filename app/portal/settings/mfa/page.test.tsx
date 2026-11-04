import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const stepUp = vi.hoisted(() => vi.fn());
vi.mock("@/components/portal/MfaStepUp", () => ({
  MfaStepUp: (props: { next: string }) => {
    stepUp(props.next);
    return null;
  },
}));

import MfaStepUpPage from "./page";

afterEach(() => {
  cleanup();
  stepUp.mockReset();
});

async function nextFor(next?: string) {
  render(await MfaStepUpPage({ searchParams: Promise.resolve({ next }) }));
  return stepUp.mock.calls[0][0];
}

describe("MfaStepUpPage next sanitization", () => {
  it.each([
    ["//evil.com"],
    ["https://evil.com"],
    ["/\\evil"],
    ["javascript:alert(1)"],
    ["/%2F%2Fevil"],
    [undefined],
  ])("falls back to /portal for %s", async (next) => {
    expect(await nextFor(next)).toBe("/portal");
  });

  it.each([["/company/members?company=x"], ["/admin"], ["/company"]])(
    "preserves %s",
    async (next) => {
      expect(await nextFor(next)).toBe(next);
    },
  );
});
