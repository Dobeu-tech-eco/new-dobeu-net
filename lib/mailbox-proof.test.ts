import { describe, expect, it } from "vitest";
import {
  EMAIL_CHANGE_QUIET_SECONDS,
  EMAIL_CHANGE_WINDOW_SECONDS,
  LINK_EXCHANGE_GRACE_SECONDS,
  emailChangeQuiet,
  identityEmailChangedAt,
  latestLinkTimestamp,
  toSeconds,
} from "@/lib/mailbox-proof";

const LINK = Math.floor(Date.parse("2026-11-01T10:00:00Z") / 1000);
const iso = (secs: number) => new Date(secs * 1000).toISOString();
/** A pure creation: created_at == updated_at. */
const identityAt = (secs: number) => [{ provider: "email", created_at: iso(secs), updated_at: iso(secs) }];
/** An identity created long ago and changed (confirmed) at `updatedSecs`. */
const identityChanged = (updatedSecs: number, createdSecs = LINK - 30 * 86_400) => [
  { provider: "email", created_at: iso(createdSecs), updated_at: iso(updatedSecs) },
];

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

describe("identityEmailChangedAt", () => {
  it("is a change whenever updated_at differs from created_at (no creation slack)", () => {
    expect(identityEmailChangedAt(identityAt(LINK))).toEqual({ updated: LINK, changedAt: null });
    expect(identityEmailChangedAt(identityChanged(LINK, LINK - 1))).toEqual({ updated: LINK, changedAt: LINK });
    expect(identityEmailChangedAt(identityChanged(LINK, LINK - 3))).toEqual({ updated: LINK, changedAt: LINK });
    // A scripted change within the same second as creation still counts.
    expect(
      identityEmailChangedAt([
        { provider: "email", created_at: "2026-01-01T00:00:00.100Z", updated_at: "2026-01-01T00:00:00.900Z" },
      ]),
    ).toEqual({ updated: Math.floor(Date.parse("2026-01-01T00:00:00Z") / 1000), changedAt: Math.floor(Date.parse("2026-01-01T00:00:00Z") / 1000) });
  });
  it("is invalid for a missing identity or a missing / unparseable timestamp", () => {
    expect(identityEmailChangedAt(null)).toBe("invalid");
    expect(identityEmailChangedAt([])).toBe("invalid");
    expect(identityEmailChangedAt([{ provider: "email", updated_at: iso(LINK) }])).toBe("invalid");
    expect(identityEmailChangedAt([{ provider: "email", created_at: "x", updated_at: iso(LINK) }])).toBe("invalid");
  });
  it("treats updated_at before created_at as a change (fail closed) without throwing", () => {
    expect(() => identityEmailChangedAt(identityChanged(LINK - 100, LINK))).not.toThrow();
    expect(identityEmailChangedAt(identityChanged(LINK - 100, LINK))).toEqual({
      updated: LINK - 100,
      changedAt: LINK - 100,
    });
  });
});

describe("emailChangeQuiet", () => {
  const ids = identityAt(LINK - 3_600);

  it("the quiet period is 24 h and the window adds the 5 min exchange grace", () => {
    expect(EMAIL_CHANGE_QUIET_SECONDS).toBe(86_400);
    expect(LINK_EXCHANGE_GRACE_SECONDS).toBe(300);
    expect(EMAIL_CHANGE_WINDOW_SECONDS).toBe(86_700);
  });

  it("H-B3: change 5 s before the link, identity 1 s before: not quiet", () => {
    expect(
      emailChangeQuiet({ emailChangeSentAt: iso(LINK - 5), identities: identityAt(LINK - 1), linkTs: LINK }),
    ).toBe(false);
  });

  it("H-B4: password change clears email_change_sent_at; identity change signal still refuses", () => {
    expect(
      emailChangeQuiet({
        emailChangeSentAt: null,
        identities: identityChanged(LINK - 10),
        linkTs: LINK,
      }),
    ).toBe(false);
    // The same chain recorded through the methods list (the held code).
    const linkTs = latestLinkTimestamp([{ method: "magiclink", timestamp: LINK }]) as number;
    expect(
      emailChangeQuiet({ emailChangeSentAt: null, identities: identityChanged(linkTs - 10), linkTs }),
    ).toBe(false);
  });

  it("a creation-only identity (updated == created) with no change request is quiet; a change 2 s after creation is not", () => {
    expect(emailChangeQuiet({ emailChangeSentAt: null, identities: identityAt(LINK - 10), linkTs: LINK })).toBe(true);
    expect(
      emailChangeQuiet({ emailChangeSentAt: null, identities: identityChanged(LINK - 8, LINK - 10), linkTs: LINK }),
    ).toBe(false);
  });

  it("an identity change exactly at the window boundary is quiet; one second later is not", () => {
    expect(
      emailChangeQuiet({ emailChangeSentAt: null, identities: identityChanged(LINK - 86_700), linkTs: LINK }),
    ).toBe(true);
    expect(
      emailChangeQuiet({ emailChangeSentAt: null, identities: identityChanged(LINK - 86_699), linkTs: LINK }),
    ).toBe(false);
  });

  it("a missing created_at is not quiet", () => {
    expect(
      emailChangeQuiet({
        emailChangeSentAt: null,
        identities: [{ provider: "email", updated_at: iso(LINK - 3_600) }],
        linkTs: LINK,
      }),
    ).toBe(false);
  });

  it("a garbage identity (updated before created) does not throw and fails closed", () => {
    expect(() =>
      emailChangeQuiet({ emailChangeSentAt: null, identities: identityChanged(LINK - 100, LINK - 50), linkTs: LINK }),
    ).not.toThrow();
    expect(
      emailChangeQuiet({ emailChangeSentAt: null, identities: identityChanged(LINK - 100, LINK - 50), linkTs: LINK }),
    ).toBe(false);
  });

  it("a change 2 h before the link is not quiet", () => {
    expect(emailChangeQuiet({ emailChangeSentAt: iso(LINK - 7_200), identities: ids, linkTs: LINK })).toBe(false);
  });

  it("a change 25 h before is quiet; exactly 86700 s before is quiet; 86699 s is not", () => {
    expect(emailChangeQuiet({ emailChangeSentAt: iso(LINK - 25 * 3_600), identities: ids, linkTs: LINK })).toBe(true);
    expect(emailChangeQuiet({ emailChangeSentAt: iso(LINK - 86_700), identities: ids, linkTs: LINK })).toBe(true);
    expect(emailChangeQuiet({ emailChangeSentAt: iso(LINK - 86_699), identities: ids, linkTs: LINK })).toBe(false);
    expect(emailChangeQuiet({ emailChangeSentAt: iso(LINK - 86_400), identities: ids, linkTs: LINK })).toBe(false);
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
    expect(
      emailChangeQuiet({ identities: [{ provider: "email", created_at: iso(LINK - 9), updated_at: "nope" }], linkTs: LINK }),
    ).toBe(false);
    expect(
      emailChangeQuiet({ identities: [{ provider: "email", created_at: iso(LINK - 9), updated_at: null }], linkTs: LINK }),
    ).toBe(false);
    expect(emailChangeQuiet({ identities: [], linkTs: LINK })).toBe(false);
    expect(emailChangeQuiet({ identities: null, linkTs: LINK })).toBe(false);
    expect(
      emailChangeQuiet({
        identities: [{ provider: "github", created_at: iso(LINK - 9), updated_at: iso(LINK - 9) }],
        linkTs: LINK,
      }),
    ).toBe(false);
  });
});
