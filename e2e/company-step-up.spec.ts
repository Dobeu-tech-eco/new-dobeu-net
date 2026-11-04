import { test, expect } from "@playwright/test";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  canRunSupabaseE2E,
  createServiceClient,
  ensureTestUser,
  loginAs,
  resolveSupabaseEnv,
  skipReason
} from "./portal-session";
import { msUntilNextStep, totp } from "./totp";

/**
 * Company-admin two-factor step-up lands on the original deep link.
 *
 * Uses a DEDICATED user: a verified TOTP factor forces step-up everywhere, so
 * it must never be shared with other specs. Needs [auth.mfa.totp] enabled in
 * supabase/config.toml (local stack only).
 */
// Fixtures are scoped per Playwright project: locally chromium and
// mobile-chrome run this spec in parallel workers, and cleanup deletes the
// user's factors and its seeded companies.
const projectSlug = (name: string) => name.replace(/[^a-z0-9]+/gi, "-").toLowerCase();

test.skip(!canRunSupabaseE2E(), skipReason());

// The step-up form talks to Supabase from the browser. next.config.ts'
// connect-src only allows https://*.supabase.co, so against the local stack
// (http://127.0.0.1:54321) the CSP would block those calls.
test.use({ bypassCSP: true });

test.describe("company admin MFA step-up", () => {
  test.describe.configure({ mode: "serial" });

  let admin: SupabaseClient;
  let userId: string;
  let companyId: string;
  let factorId: string;
  let secret: string;
  let enrollStep: number;
  let email: string;
  let companyPrefix: string;

  test.beforeAll(async ({}, testInfo) => {
    const slug = projectSlug(testInfo.project.name);
    email = `e2e-company-stepup-${slug}@test.dobeu.net`;
    companyPrefix = `E2E step-up ${slug} `;
    admin = createServiceClient();
    userId = await ensureTestUser(admin, email);
    await clearSeed(); // clear leftovers from an aborted run

    const { data: company, error: companyError } = await admin
      .from("companies")
      .insert({ name: `${companyPrefix}${Date.now()}`, status: "active" })
      .select("id")
      .single();
    if (companyError || !company) throw new Error(`E2E seed company failed: ${companyError?.message}`);
    companyId = company.id;

    const { error: memberError } = await admin
      .from("company_members")
      .insert({ company_id: companyId, user_id: userId, role: "company_admin", status: "active" });
    if (memberError) throw new Error(`E2E seed member failed: ${memberError.message}`);

    // Enroll and verify a TOTP factor from a Node-side session.
    const { url, anonKey } = resolveSupabaseEnv();
    const client = createServerClient(url!, anonKey!, {
      cookies: { getAll: () => [], setAll: () => {} }
    });
    const { data: link, error: linkError } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email
    });
    const tokenHash = link?.properties?.hashed_token;
    if (linkError || !tokenHash) throw new Error(`E2E generateLink failed: ${linkError?.message}`);
    let { error: otpError } = await client.auth.verifyOtp({ type: "magiclink", token_hash: tokenHash });
    if (otpError) {
      ({ error: otpError } = await client.auth.verifyOtp({ type: "email", token_hash: tokenHash }));
    }
    if (otpError) throw new Error(`E2E verifyOtp failed: ${otpError.message}`);

    const { data: enrolled, error: enrollError } = await client.auth.mfa.enroll({ factorType: "totp" });
    if (enrollError || !enrolled) {
      throw new Error(`E2E mfa.enroll failed (is [auth.mfa.totp] enabled?): ${enrollError?.message}`);
    }
    factorId = enrolled.id;
    secret = enrolled.totp.secret;

    const { data: challenge, error: challengeError } = await client.auth.mfa.challenge({ factorId });
    if (challengeError || !challenge) throw new Error(`E2E mfa.challenge failed: ${challengeError?.message}`);
    enrollStep = Math.floor(Date.now() / 30_000);
    const { error: verifyError } = await client.auth.mfa.verify({
      factorId,
      challengeId: challenge.id,
      code: totp(secret)
    });
    if (verifyError) throw new Error(`E2E mfa.verify failed: ${verifyError.message}`);
  });

  test.afterAll(async () => {
    if (!admin || !userId) return;
    await clearSeed();
    await admin.auth.admin.deleteUser(userId);
  });

  /** Removes the user's factors, memberships and the seeded company (not the user). */
  async function clearSeed() {
    if (!userId) return; // beforeAll failed before the user existed
    const { data: factors } = await admin.auth.admin.mfa.listFactors({ userId });
    for (const f of factors?.factors ?? []) {
      await admin.auth.admin.mfa.deleteFactor({ id: f.id, userId });
    }
    await admin.from("company_members").delete().eq("user_id", userId);
    await admin.from("companies").delete().like("name", `${companyPrefix}%`);
  }

  test("step-up returns to the exact /company/members deep link", async ({ page }) => {
    test.setTimeout(180_000); // may wait out a 30 s TOTP step
    const target = `/company/members?company=${companyId}`;

    // Fresh AAL1 session. Land on a public page: /portal would itself bounce
    // to the step-up and abort loginAs' own navigation.
    await loginAs(page, email, "/privacy");

    await page.goto(target);
    await page.waitForURL(/\/portal\/settings\/mfa/);
    const stepUpUrl = new URL(page.url());
    expect(stepUpUrl.pathname).toBe("/portal/settings/mfa");
    expect(stepUpUrl.searchParams.get("next")).toBe(target);
    expect(stepUpUrl.search).toBe(`?next=${encodeURIComponent(target)}`);

    // Supabase rejects a code reused within the step that verified it.
    if (Math.floor(Date.now() / 30_000) === enrollStep) {
      await page.waitForTimeout(msUntilNextStep() + 500);
    }
    // Avoid generating a code right at a step boundary.
    if (msUntilNextStep() < 3_000) await page.waitForTimeout(msUntilNextStep() + 500);

    await page.getByLabel("Authentication code").fill(totp(secret));
    await page.getByRole("button", { name: "Continue" }).click();

    await page.waitForURL((u) => u.pathname === "/company/members");
    const landed = new URL(page.url());
    expect(landed.pathname + landed.search).toBe(target);
    await expect(page.getByRole("heading", { name: "Members", level: 1 })).toBeVisible();
  });
});
