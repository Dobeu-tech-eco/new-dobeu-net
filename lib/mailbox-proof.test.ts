import { describe, expect, it } from "vitest";
import {
  EMAIL_CHANGE_QUIET_SECONDS,
  emailChangeQuiet,
  latestLinkTimestamp,
  toSeconds,
} from "@/lib/mailbox-proof";

const LINK = Math.floor(Date.parse("2026-11-01T10:00:00Z") / 1000);
const iso = (secs: number) => new Date(secs * 1000).toISOString();
const identityAt = (secs: number) => [{ provider: "email", updated_at: iso(secs) }];

describe("toSeconds", () => {
  it("floors to whole seconds and rejects missing or unparseable input", () => {
    expect(toSeconds("2026-11-01T10:00:00.999Z")).toBe(LINK);
    expect(toSeconds("garbage")).toBeNull();
    expect(toSeconds("")).toBeNull();
    expect(toSeconds(null)).toBeNull();
    expect(toSeconds(5)).toBeNull();
  });
});

describe("latestLinkTimestamp", () => {
  it("takes the newest numeric timestamp among link methods only", () => {
    expect(
      latestLinkTimestamp([
        { method: "otp", timestamp: 10 },
        { method: "magiclink", timestamp: 20 },
        { method: "password", timestamp: 99 },
        "invite",
        { method: "invite" },
        { method: "email/signup", timestamp: Number.NaN },
      ]),
    ).toBe(20);
  });
  it("is null with no usable link entry", () => {
    expect(latestLinkTimestamp([{ method: "password", timestamp: 1 }, "otp"])).toBeNull();
    expect(latestLinkTimestamp([])).toBeNull();
  });
});

describe("emailChangeQuiet", () => {
  const ids = identityAt(LINK - 3_600);

  it("the quiet period is 24 h", () => {
    expect(EMAIL_CHANGE_QUIET_SECONDS).toBe(86_400);
  });

  it("H-B3: change 5 s before the link, identity 1 s before: not quiet", () => {
    expect(
      emailChangeQuiet({ emailChangeSentAt: iso(LINK - 5), identities: identityAt(LINK - 1), linkTs: LINK }),
    ).toBe(false);
  });

  it("a change 2 h before the link is not quiet", () => {
    expect(emailChangeQuiet({ emailChangeSentAt: iso(LINK - 7_200), identities: ids, linkTs: LINK })).toBe(false);
  });

  it("a change 25 h before is quiet; exactly 86400 s before is quiet; 86399 s is not", () => {
    expect(emailChangeQuiet({ emailChangeSentAt: iso(LINK - 25 * 3_600), identities: ids, linkTs: LINK })).toBe(true);
    expect(emailChangeQuiet({ emailChangeSentAt: iso(LINK - 86_400), identities: ids, linkTs: LINK })).toBe(true);
    expect(emailChangeQuiet({ emailChangeSentAt: iso(LINK - 86_399), identities: ids, linkTs: LINK })).toBe(false);
  });

  it("no change ever (null, undefined, empty) is quiet", () => {
    for (const emailChangeSentAt of [null, undefined, ""]) {
      expect(emailChangeQuiet({ emailChangeSentAt, identities: ids, linkTs: LINK })).toBe(true);
    }
  });

  it("a first-time confirmed invitee (identity created before the link) is quiet", () => {
    expect(emailChangeQuiet({ emailChangeSentAt: null, identities: identityAt(LINK - 2), linkTs: LINK })).toBe(true);
  });

  it("an identity updated after the link is not quiet; the same second is", () => {
    expect(emailChangeQuiet({ identities: identityAt(LINK + 1), linkTs: LINK })).toBe(false);
    expect(emailChangeQuiet({ identities: identityAt(LINK), linkTs: LINK })).toBe(true);
  });

  it("unparseable or missing values fail closed", () => {
    expect(emailChangeQuiet({ emailChangeSentAt: "garbage", identities: ids, linkTs: LINK })).toBe(false);
    expect(emailChangeQuiet({ identities: [{ provider: "email", updated_at: "nope" }], linkTs: LINK })).toBe(false);
    expect(emailChangeQuiet({ identities: [{ provider: "email", updated_at: null }], linkTs: LINK })).toBe(false);
    expect(emailChangeQuiet({ identities: [], linkTs: LINK })).toBe(false);
    expect(emailChangeQuiet({ identities: null, linkTs: LINK })).toBe(false);
    expect(emailChangeQuiet({ identities: [{ provider: "github", updated_at: iso(LINK - 9) }], linkTs: LINK })).toBe(false);
  });
});
