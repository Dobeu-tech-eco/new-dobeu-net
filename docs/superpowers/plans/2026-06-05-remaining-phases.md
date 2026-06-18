# Remaining Phases (4 + 5 + Legacy Cutover + Close-out) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harden auth (TOTP MFA + Intercom HMAC), complete the user-gated legacy DB cutover, finish Phase 5 hygiene/a11y/E2E, and merge `test/coverage` → `main` as a fully production-ready release.

**Architecture:** Phases 0–3 are live on `https://dobeu.net`. Remaining work is four mostly-independent code-side streams (MFA, HMAC, CI/E2E, dead-code/hygiene/a11y) that dispatch as parallel agents, plus one human-gated data migration, converging on a final merge. Server-side mutations stay on the existing Server Action pattern (`lib/actions/*`, Zod, discriminated `{ ok }` returns). Admin gate stays env-driven (`isAdminEmail`) with a new AAL2 layer. Intercom keeps its existing `user_hash` plumbing; only server-side signing is added.

**Tech Stack:** Next.js 15 (App Router), TypeScript, Supabase (`@supabase/supabase-js` `auth.mfa.*`), `node:crypto` HMAC, Playwright (E2E), Vitest (unit), pnpm, Vercel.

**Companion design doc:** `docs/superpowers/specs/2026-06-05-remaining-phases-design.md`

---

## Task Group A: Phase 4 — Supabase TOTP MFA

**Owns (wave 1):** `lib/utils.ts` (add helper), `lib/supabase/middleware.ts`, `components/portal/MfaEnroll.tsx`, `components/portal/MfaStatus.tsx`, `app/portal/settings/mfa/page.tsx`, `app/portal/settings/page.tsx`, `app/admin/layout.tsx` (banner only).

### Task A1: AAL2 step-up decision helper (TDD)

**Files:**
- Modify: `lib/utils.ts`
- Test: `lib/utils.test.ts` (append; create if absent)

- [ ] **Step 1: Write the failing test**

Append to `lib/utils.test.ts` (or create with the existing import style — `import { describe, it, expect } from "vitest"`):

```ts
import { requiresAal2Stepup } from "@/lib/utils";

describe("requiresAal2Stepup", () => {
  it("returns false when no factor is enrolled (bootstrap: aal1/aal1)", () => {
    expect(requiresAal2Stepup({ currentLevel: "aal1", nextLevel: "aal1" })).toBe(false);
  });
  it("returns true when a factor exists but session is still aal1", () => {
    expect(requiresAal2Stepup({ currentLevel: "aal1", nextLevel: "aal2" })).toBe(true);
  });
  it("returns false when the session already satisfied aal2", () => {
    expect(requiresAal2Stepup({ currentLevel: "aal2", nextLevel: "aal2" })).toBe(false);
  });
  it("returns false when assurance info is null (fail-open for shape, gate handles network errors separately)", () => {
    expect(requiresAal2Stepup(null)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test:ci -- lib/utils.test.ts -t "requiresAal2Stepup"`
Expected: FAIL with "requiresAal2Stepup is not a function" / import error.

- [ ] **Step 3: Implement the helper**

Append to `lib/utils.ts`:

```ts
/**
 * Decide whether the current session must complete an AAL2 (TOTP) step-up.
 * Input is the shape returned by `supabase.auth.mfa.getAuthenticatorAssuranceLevel()`.
 * - nextLevel 'aal2' + currentLevel not 'aal2' → a factor exists but the
 *   session hasn't satisfied it → step-up required.
 * - No factor enrolled (currentLevel === nextLevel === 'aal1') → bootstrap,
 *   no step-up (the admin can still reach /admin to enroll; layout nags).
 */
export function requiresAal2Stepup(
  aal: { currentLevel: string | null; nextLevel: string | null } | null
): boolean {
  if (!aal) return false;
  return aal.nextLevel === "aal2" && aal.currentLevel !== "aal2";
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test:ci -- lib/utils.test.ts -t "requiresAal2Stepup"`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/utils.ts lib/utils.test.ts
git commit -m "feat(p4): add requiresAal2Stepup helper for admin MFA gate"
```

### Task A2: Enforce AAL2 on `/admin/*` in middleware

**Files:**
- Modify: `lib/supabase/middleware.ts`

- [ ] **Step 1: Add the import**

At the top of `lib/supabase/middleware.ts`, change the utils import line:

```ts
import { isAdminEmail, requiresAal2Stepup } from "@/lib/utils";
```

- [ ] **Step 2: Add the AAL2 gate inside the existing `/admin` block**

In `updateSession`, the existing `/admin` block ends after the `isAdminEmail` redirect. Add the AAL2 check immediately after the `isAdminEmail` check passes (i.e. just before the final `return response;`), still inside `if (path.startsWith("/admin"))`. Replace the existing admin block body with:

```ts
  // Gate /admin — must be authenticated AND email in ADMIN_EMAILS AND (if a
  // TOTP factor is enrolled) the session must be AAL2.
  if (path.startsWith("/admin")) {
    if (!user) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("next", path);
      return NextResponse.redirect(url);
    }
    if (!isAdminEmail(user.email)) {
      const url = request.nextUrl.clone();
      url.pathname = "/portal";
      url.searchParams.set("error", "not_authorized");
      return NextResponse.redirect(url);
    }
    // AAL2 step-up. Fail CLOSED on error (the admin surface is the sensitive one).
    try {
      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (requiresAal2Stepup(aal ?? null)) {
        const url = request.nextUrl.clone();
        url.pathname = "/portal/settings/mfa";
        url.searchParams.set("next", path);
        return NextResponse.redirect(url);
      }
    } catch {
      const url = request.nextUrl.clone();
      url.pathname = "/portal/settings/mfa";
      url.searchParams.set("error", "mfa_check_failed");
      url.searchParams.set("next", path);
      return NextResponse.redirect(url);
    }
  }
```

- [ ] **Step 3: Verify type-check + lint**

Run: `pnpm type-check && pnpm lint`
Expected: no errors (the `/portal/settings/mfa` route is created in Task A4; the redirect target is a string so this compiles before that page exists).

- [ ] **Step 4: Commit**

```bash
git add lib/supabase/middleware.ts
git commit -m "feat(p4): enforce AAL2 step-up on /admin in middleware"
```

### Task A3: MFA enroll + status components

**Files:**
- Create: `components/portal/MfaStatus.tsx`
- Create: `components/portal/MfaEnroll.tsx`

- [ ] **Step 1: Create `MfaEnroll.tsx`**

```tsx
"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

/**
 * One-time TOTP enrollment. Shows the QR (SVG data-URL from Supabase) + a
 * manual secret fallback, then verifies a 6-digit code to mark the factor
 * 'verified'. On success refreshes so MfaStatus re-reads listFactors().
 */
export function MfaEnroll({ onEnrolled }: { onEnrolled?: () => void }) {
  const router = useRouter();
  const supabase = React.useMemo(() => createClient(), []);
  const [qr, setQr] = React.useState<string | null>(null);
  const [secret, setSecret] = React.useState<string | null>(null);
  const [factorId, setFactorId] = React.useState<string | null>(null);
  const [code, setCode] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  async function startEnroll() {
    setBusy(true);
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp" });
    setBusy(false);
    if (error) {
      toast.error(error.message.includes("already") ? "2FA is already enabled." : error.message);
      return;
    }
    setQr(data.totp.qr_code);
    setSecret(data.totp.secret);
    setFactorId(data.id);
  }

  async function verify() {
    if (!factorId) return;
    setBusy(true);
    const { data: ch, error: chErr } = await supabase.auth.mfa.challenge({ factorId });
    if (chErr || !ch) {
      setBusy(false);
      toast.error(chErr?.message ?? "Could not start challenge.");
      return;
    }
    const { error } = await supabase.auth.mfa.verify({ factorId, challengeId: ch.id, code });
    setBusy(false);
    if (error) {
      toast.error("Invalid code. Try again.");
      setCode("");
      return;
    }
    toast.success("Two-factor authentication enabled.");
    setQr(null);
    setSecret(null);
    setFactorId(null);
    setCode("");
    onEnrolled?.();
    router.refresh();
  }

  if (!qr) {
    return (
      <button
        onClick={startEnroll}
        disabled={busy}
        className="rounded-md bg-primary text-primary-foreground px-3 py-1.5 text-sm font-medium hover:opacity-90 disabled:opacity-50 transition"
      >
        {busy ? "Starting…" : "Enable two-factor authentication"}
      </button>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Scan this with an authenticator app (1Password, Authy, Google Authenticator), then enter the
        6-digit code.
      </p>
      {/* Supabase returns qr_code as an SVG data-URL */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={qr} alt="TOTP enrollment QR code" className="h-44 w-44 rounded-md border border-border bg-white p-2" />
      {secret && (
        <p className="text-xs text-muted-foreground break-all">
          Or enter this secret manually: <code className="font-mono">{secret}</code>
        </p>
      )}
      <div className="flex items-center gap-2">
        <label htmlFor="totp-code" className="sr-only">
          6-digit code
        </label>
        <input
          id="totp-code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          className="w-28 rounded-md border border-border bg-background px-3 py-1.5 text-sm font-mono tracking-widest"
          placeholder="123456"
        />
        <button
          onClick={verify}
          disabled={busy || code.length !== 6}
          className="rounded-md bg-primary text-primary-foreground px-3 py-1.5 text-sm font-medium hover:opacity-90 disabled:opacity-50 transition"
        >
          {busy ? "Verifying…" : "Verify & enable"}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create `MfaStatus.tsx`**

```tsx
"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { MfaEnroll } from "@/components/portal/MfaEnroll";

type Factor = { id: string; status: string; friendly_name?: string | null };

/**
 * Reads the user's TOTP factors and shows either an "enabled ✓" row with a
 * disable button, or the MfaEnroll widget. Client-side; uses the browser
 * Supabase client (the MFA APIs operate on the user's own session).
 */
export function MfaStatus() {
  const router = useRouter();
  const supabase = React.useMemo(() => createClient(), []);
  const [factors, setFactors] = React.useState<Factor[] | null>(null);

  const load = React.useCallback(async () => {
    const { data } = await supabase.auth.mfa.listFactors();
    setFactors((data?.totp ?? []) as Factor[]);
  }, [supabase]);

  React.useEffect(() => {
    void load();
  }, [load]);

  async function disable(factorId: string) {
    const { error } = await supabase.auth.mfa.unenroll({ factorId });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Two-factor authentication disabled.");
    await load();
    router.refresh();
  }

  if (factors === null) return <p className="text-sm text-muted-foreground">Loading…</p>;

  const verified = factors.filter((f) => f.status === "verified");
  if (verified.length > 0) {
    return (
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm">
          <span className="font-medium text-green-600 dark:text-green-400">Enabled ✓</span>{" "}
          <span className="text-muted-foreground">— a code is required for admin access.</span>
        </p>
        <button
          onClick={() => disable(verified[0].id)}
          className="rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-muted transition"
        >
          Disable
        </button>
      </div>
    );
  }

  return <MfaEnroll onEnrolled={load} />;
}
```

- [ ] **Step 3: Verify type-check + lint**

Run: `pnpm type-check && pnpm lint`
Expected: no errors. (If `sonner`'s `toast` import path differs, match the existing usage in `components/portal/SettingsForm.tsx`.)

- [ ] **Step 4: Commit**

```bash
git add components/portal/MfaEnroll.tsx components/portal/MfaStatus.tsx
git commit -m "feat(p4): MFA enroll + status components"
```

### Task A4: Step-up page + settings section

**Files:**
- Create: `app/portal/settings/mfa/page.tsx`
- Modify: `app/portal/settings/page.tsx`

- [ ] **Step 1: Create the step-up page**

`app/portal/settings/mfa/page.tsx`:

```tsx
import { MfaStepUp } from "@/components/portal/MfaStepUp";

export const dynamic = "force-dynamic";

/**
 * AAL2 step-up. Middleware redirects an admin here when they have a TOTP
 * factor enrolled but the current session is still AAL1. Code-only — no
 * re-enroll. The `next` query param is the originally-requested admin path.
 */
export default async function MfaStepUpPage({
  searchParams
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return (
    <div className="mx-auto max-w-md py-12 space-y-6">
      <header>
        <h1 className="font-display text-2xl font-bold tracking-tight">Confirm your identity</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Enter the 6-digit code from your authenticator app to access the admin area.
        </p>
      </header>
      <MfaStepUp next={next ?? "/admin"} />
    </div>
  );
}
```

- [ ] **Step 2: Create the `MfaStepUp` client component**

`components/portal/MfaStepUp.tsx`:

```tsx
"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

/** Code-only AAL2 challenge against the user's existing verified TOTP factor. */
export function MfaStepUp({ next }: { next: string }) {
  const router = useRouter();
  const supabase = React.useMemo(() => createClient(), []);
  const [code, setCode] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { data: factors } = await supabase.auth.mfa.listFactors();
    const factor = (factors?.totp ?? []).find((f) => f.status === "verified");
    if (!factor) {
      setBusy(false);
      toast.error("No verified authenticator found. Enroll in Settings first.");
      return;
    }
    const { data: ch, error: chErr } = await supabase.auth.mfa.challenge({ factorId: factor.id });
    if (chErr || !ch) {
      setBusy(false);
      toast.error(chErr?.message ?? "Could not start challenge.");
      return;
    }
    const { error } = await supabase.auth.mfa.verify({ factorId: factor.id, challengeId: ch.id, code });
    setBusy(false);
    if (error) {
      toast.error("Invalid code. Try again.");
      setCode("");
      return;
    }
    router.replace(next);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="rounded-xl border border-border bg-card p-6 space-y-4">
      <label htmlFor="stepup-code" className="block text-sm font-medium">
        Authentication code
      </label>
      <input
        id="stepup-code"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
        className="w-full rounded-md border border-border bg-background px-3 py-2 font-mono tracking-widest"
        placeholder="123456"
        autoFocus
      />
      <button
        type="submit"
        disabled={busy || code.length !== 6}
        className="w-full rounded-md bg-primary text-primary-foreground px-3 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50 transition"
      >
        {busy ? "Verifying…" : "Continue to admin"}
      </button>
    </form>
  );
}
```

- [ ] **Step 3: Add the 2FA section to settings**

In `app/portal/settings/page.tsx`, add `import { MfaStatus } from "@/components/portal/MfaStatus";` at the top, then add a new section after the existing "Profile" `<section>` (before the closing `</div>`):

```tsx
      <section className="rounded-xl border border-border bg-card p-6 space-y-4">
        <h2 className="font-semibold">Two-factor authentication</h2>
        <p className="text-sm text-muted-foreground">
          Required to access the admin area. Adds a one-time code from your authenticator app on top
          of magic-link sign-in.
        </p>
        <MfaStatus />
      </section>
```

- [ ] **Step 4: Verify**

Run: `pnpm type-check && pnpm lint`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add app/portal/settings/mfa/page.tsx components/portal/MfaStepUp.tsx app/portal/settings/page.tsx
git commit -m "feat(p4): MFA step-up page + settings 2FA section"
```

### Task A5: Admin "Enable 2FA" bootstrap banner

**Files:**
- Modify: `app/admin/layout.tsx`

- [ ] **Step 1: Add a non-blocking banner when no factor is enrolled**

In `app/admin/layout.tsx`, after resolving `user` and before the main `return`, compute factor presence and render a banner. Add near the top imports:

```tsx
import Link from "next/link";
```

(`Link` is already imported — skip if present.) Then inside the component, after the admin-gate redirect, add:

```tsx
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  const needsEnroll = aal?.nextLevel !== "aal2"; // no verified factor yet
```

And render this banner as the first child inside the `<main>` (before `{children}`):

```tsx
          {needsEnroll && (
            <div
              role="status"
              className="mb-6 rounded-md border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm"
            >
              Two-factor authentication isn&apos;t enabled.{" "}
              <Link href="/portal/settings" className="font-medium underline">
                Enable it now
              </Link>{" "}
              to secure admin access.
            </div>
          )}
```

- [ ] **Step 2: Verify**

Run: `pnpm type-check && pnpm lint`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/admin/layout.tsx
git commit -m "feat(p4): admin enable-2FA bootstrap banner"
```

> **NOTE (parallel-dispatch):** Task Group B also edits `app/admin/layout.tsx`. If B runs concurrently, run B **after** this commit (see Task Group H). This task does not touch `app/portal/layout.tsx`.

---

## Task Group B: Phase 4 — Intercom HMAC

**Owns (wave 2, after A5):** `lib/intercom-hmac.ts`, `lib/intercom-hmac.test.ts`, `app/portal/layout.tsx`, `app/admin/layout.tsx`.

### Task B1: Server-side HMAC helper (TDD)

**Files:**
- Create: `lib/intercom-hmac.ts`
- Test: `lib/intercom-hmac.test.ts`

- [ ] **Step 1: Write the failing test**

`lib/intercom-hmac.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHmac } from "node:crypto";

describe("intercomUserHash", () => {
  const ORIGINAL = process.env.INTERCOM_IDENTITY_VERIFICATION_SECRET;
  afterEach(() => {
    process.env.INTERCOM_IDENTITY_VERIFICATION_SECRET = ORIGINAL;
    viResetModules();
  });
  beforeEach(() => {
    viResetModules();
  });

  function viResetModules() {
    // re-import fresh so the module reads the current env at call time
  }

  it("returns the HMAC-SHA256 hex digest of the user_id keyed by the secret", async () => {
    process.env.INTERCOM_IDENTITY_VERIFICATION_SECRET = "test_secret_123";
    const { intercomUserHash } = await import("@/lib/intercom-hmac");
    const userId = "00000000-0000-0000-0000-000000000001";
    const expected = createHmac("sha256", "test_secret_123").update(userId).digest("hex");
    expect(intercomUserHash(userId)).toBe(expected);
  });

  it("returns undefined when the secret is unset (graceful no-op)", async () => {
    delete process.env.INTERCOM_IDENTITY_VERIFICATION_SECRET;
    const { intercomUserHash } = await import("@/lib/intercom-hmac");
    expect(intercomUserHash("any-id")).toBeUndefined();
  });
});
```

> Note: the helper reads `process.env` at call time (not module load), so no module-cache juggling is required — the placeholder `viResetModules` is a no-op kept only so the test reads cleanly. If your vitest config caches env-at-import, the call-time read in Step 3 makes this moot.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test:ci -- lib/intercom-hmac.test.ts`
Expected: FAIL — module `@/lib/intercom-hmac` not found.

- [ ] **Step 3: Implement the helper**

`lib/intercom-hmac.ts`:

```ts
import { createHmac } from "node:crypto";

/**
 * Compute the Intercom Identity Verification hash for a user.
 *
 * Intercom hashes the identifier you send it. We send `user_id` (the Supabase
 * UUID) from both portal + admin layouts, so we HMAC that same value.
 *
 * Server-only (`node:crypto`). Kept SEPARATE from `lib/intercom.ts` because
 * that module is intentionally importable from the client; crypto must never
 * reach the client bundle.
 *
 * Returns `undefined` when `INTERCOM_IDENTITY_VERIFICATION_SECRET` is unset so
 * the caller boots Intercom unverified (dev / pre-provisioning) without throwing.
 */
export function intercomUserHash(userId: string): string | undefined {
  const secret = process.env.INTERCOM_IDENTITY_VERIFICATION_SECRET;
  if (!secret) return undefined;
  return createHmac("sha256", secret).update(userId).digest("hex");
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test:ci -- lib/intercom-hmac.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/intercom-hmac.ts lib/intercom-hmac.test.ts
git commit -m "feat(p4): server-side Intercom HMAC user_hash"
```

### Task B2: Wire `user_hash` into portal + admin layouts

**Files:**
- Modify: `app/portal/layout.tsx`
- Modify: `app/admin/layout.tsx`

- [ ] **Step 1: Portal layout**

In `app/portal/layout.tsx`, add the import:

```tsx
import { intercomUserHash } from "@/lib/intercom-hmac";
```

Find the existing `<IntercomIdentify ... />` usage. Compute the hash from the resolved `user.id` just before it and pass the prop:

```tsx
      <IntercomIdentify
        user_id={user.id}
        email={user.email ?? undefined}
        name={intercomNameFromUser(user)}
        created_at={user.created_at}
        user_hash={intercomUserHash(user.id)}
      />
```

- [ ] **Step 2: Admin layout**

In `app/admin/layout.tsx`, add the same import and add `user_hash={intercomUserHash(user.id)}` to the existing `<IntercomIdentify ... />` block (which already passes `user_id={user.id}`).

- [ ] **Step 3: Verify**

Run: `pnpm type-check && pnpm lint`
Expected: no errors (`IntercomIdentify` already accepts `user_hash?: string`).

- [ ] **Step 4: Commit**

```bash
git add app/portal/layout.tsx app/admin/layout.tsx
git commit -m "feat(p4): pass Intercom user_hash from portal + admin layouts"
```

### Task B3: Document the env var

**Files:**
- Modify: `CLAUDE.md` (env table) — **defer to Task Group E owner if running in parallel** (single CLAUDE.md owner). If B runs solo, do it here.

- [ ] **Step 1: Add the env row**

In `CLAUDE.md` "Env vars" table, add:

```markdown
| `INTERCOM_IDENTITY_VERIFICATION_SECRET` | Server-side HMAC for Intercom Identity Verification (`lib/intercom-hmac.ts`). Unset → Intercom boots unverified. Must also be set in the Intercom workspace dashboard. |
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: document INTERCOM_IDENTITY_VERIFICATION_SECRET"
```

> **Manual follow-up (user, not code):** set `INTERCOM_IDENTITY_VERIFICATION_SECRET` in Vercel **and** enable Identity Verification in the Intercom workspace (Settings → Security) with the same secret.

---

## Task Group C: Legacy DB cutover (USER-GATED)

**Owns:** `.agent/migration/*` (Findings + new mapping SQL), `lib/database.types.ts` (post-cutover regen only).
**Blocked on:** the user running the read-only inventory queries in `.agent/migration/inventory.md` and pasting output into its Findings section. **Do not author mapping SQL from memory.**

### Task C1: User fills inventory Findings (USER ACTION)

- [ ] **Step 1 (USER):** Run the queries in `.agent/migration/inventory.md` §1–§8 against `db-dobeutech-unified` and paste raw output into the Findings section.
- [ ] **Step 2 (USER):** Confirm which Supabase project the live Vercel `*_SUPABASE_*` envs currently resolve to (settles whether the §6.3-step-6 env swap is a no-op).
- [ ] **Step 3:** Hand back to the agent.

### Task C2: Author staging restore + mapping SQL (agent, after C1)

**Files:**
- Create: `.agent/migration/restore-staging.sql` (legacy dump → `legacy_import.*` on target)
- Create: `.agent/migration/mapping.sql` (per-table `insert into public.X select … from legacy_import.Y`)

- [ ] **Step 1:** From the filled Findings, write `restore-staging.sql` creating `legacy_import` schema and the table DDL matching the legacy column shapes (verbatim from §4 output).
- [ ] **Step 2:** Write `mapping.sql` per `.agent/PRODUCTION-PLAN.md` §6.2: leads dedupe-by-email (keep most-recent `last_seen`), FK uuid map in a temp table, status-string → enum normalization (`project_status`, `invoice_status`, `booking_status`), `messages` excluded, `is_admin` column **omitted** from the `profiles` insert (it's being dropped in Task Group E).
- [ ] **Step 3:** Document the `auth.users` import as a scripted `auth.admin.createUser` loop (cannot bulk-insert), keyed off legacy `users` rows; profiles auto-create via `handle_new_user()`.
- [ ] **Step 4: Commit (artifacts only; no app code)**

```bash
git add .agent/migration/restore-staging.sql .agent/migration/mapping.sql
git commit -m "chore(migration): author legacy→target staging restore + mapping SQL"
```

### Task C3: Execute cutover (operator-run, gated)

- [ ] **Step 1:** Freeze writes — disable Calendly webhook + put `/api/lead` in maintenance.
- [ ] **Step 2:** `pg_dump` legacy → restore into `legacy_import` on target → run `mapping.sql` → run the `auth.users` import script.
- [ ] **Step 3:** Copy storage objects: legacy `project-files` → target `project-files`; verify `project_files.storage_path` resolves.
- [ ] **Step 4: Verify pre-cutover gates** (`.agent/PRODUCTION-PLAN.md` §6.5): per-table row-count parity (allowing lead dedupe); one migrated user magic-link login works; one project + its files render in `/portal`.
- [ ] **Step 5:** If env swap needed (per C1 step 2), point the four Vercel `*_SUPABASE_*` vars at target + redeploy. Re-enable Calendly + `/api/lead`.
- [ ] **Step 6:** Regenerate types and commit:

```bash
pnpm db:types
git add lib/database.types.ts
git commit -m "chore(migration): regenerate types post-cutover"
```

- [ ] **Step 7:** 24h watch → 7-day legacy read-only soak → retire `db-dobeutech-unified`.

---

## Task Group D: Phase 5 — CI + E2E

**Owns (wave 1):** `e2e/tickets.spec.ts`. **Reports** the CLAUDE.md CI-note correction to Task Group E (single CLAUDE.md owner).

### Task D1: Correct the stale "CI doesn't run tests" claim

> **CI already runs `pnpm test:ci`** (`.github/workflows/ci.yml:40`). No workflow change is needed. Report to the Task Group E owner to fix the CLAUDE.md "## Commands" note that says CI does not run tests. If running D solo, apply the CLAUDE.md edit here:

- [ ] **Step 1 (if solo):** In `CLAUDE.md` "## Commands", replace the comment block claiming CI omits tests with: `# CI (.github/workflows/ci.yml) runs install + type-check + lint + test:ci + build.`
- [ ] **Step 2 (if solo): Commit**

```bash
git add CLAUDE.md
git commit -m "docs: correct CI note — CI runs tests (test:ci) since Phase 3"
```

### Task D2: Ticket-flow E2E journey

**Files:**
- Create: `e2e/tickets.spec.ts`
- Read for selectors: `app/portal/tickets/page.tsx`, `app/portal/tickets/[id]/page.tsx`

- [ ] **Step 1: Read the existing smoke spec for the project's Playwright conventions**

Run: open `e2e/` and read the existing `*.spec.ts` to match base-URL, fixtures, and any auth-setup pattern.

- [ ] **Step 2: Write the journey (adapt selectors to the real DOM after reading the pages)**

`e2e/tickets.spec.ts`:

```ts
import { test, expect } from "@playwright/test";

// Requires a seeded authenticated client session (reuse the existing e2e auth
// setup/fixture). If the smoke suite has a storageState for a portal user,
// load it here via test.use({ storageState: ... }).

test.describe("client ticket flow", () => {
  test("submit a request and see it listed", async ({ page }) => {
    await page.goto("/portal/tickets");
    await expect(page.getByRole("heading", { name: /tickets|requests/i })).toBeVisible();

    await page.getByRole("button", { name: /new request/i }).click();
    await page.getByLabel(/service|type/i).selectOption({ index: 1 });
    await page.getByLabel(/title/i).fill("E2E test request");
    await page.getByLabel(/description/i).fill("Created by the Playwright ticket-flow journey.");
    await page.getByRole("button", { name: /submit|create/i }).click();

    await expect(page.getByText("E2E test request")).toBeVisible();
  });
});
```

- [ ] **Step 3: Run it**

Run: `pnpm test:e2e -- e2e/tickets.spec.ts`
Expected: PASS (adjust selectors/labels to match the real ticket UI; do not leave guessed selectors — verify against the page source read in Step 1).

- [ ] **Step 4: Commit**

```bash
git add e2e/tickets.spec.ts
git commit -m "test(e2e): client ticket submit→list journey"
```

---

## Task Group E: Phase 5 — Dead code + hygiene

**Owns (wave 1, except `lib/utils.ts` which waits for A):** `.cmd` files, `supabase/migrations/<ts>_phase5_drop_is_admin.sql`, `lib/database.types.ts`, dead-export sites in `lib/*`, `CLAUDE.md`.

### Task E1: Re-run dead-code analysis (don't trust the stale report)

- [ ] **Step 1: Run the analyzers at HEAD**

Run: `pnpm dlx knip` then `pnpm dlx ts-prune`
Expected: a fresh list of unused exports. `.reports/dead-code-analysis.md` is from the Phase-1 branch and is stale — ignore it.

- [ ] **Step 2: Cross-check each hit before deleting**

For each flagged export, grep the repo for its usages (e.g. `rg "logApolloActivity"`). Delete only exports with **zero non-test importers**. Likely-true candidates to verify: `lib/apollo.ts#logApolloActivity`, `lib/analytics.ts#identify`, `lib/supabase/client.ts#isSupabaseConfigured`, `lib/utils.ts#sleep`. Do NOT delete framework-convention exports (route `metadata`/`config`/`default`), shadcn re-exports, or generated `database.types.ts` members.

- [ ] **Step 3: Remove confirmed-dead exports, one micro-commit each**

Example (only if `logApolloActivity` is confirmed unused — verify first):

```bash
# after removing the export from lib/apollo.ts and its test
git add lib/apollo.ts lib/apollo.test.ts
git commit -m "chore(p5): remove unused export logApolloActivity"
```

> `lib/utils.ts` edits here must wait until Task Group A has committed A1 (both touch `lib/utils.ts`). If A is in flight, skip `lib/utils.ts#sleep` in this pass and do it in wave 2.

### Task E2: Drop `profiles.is_admin` column

**Files:**
- Create: `supabase/migrations/20260616000000_phase5_drop_is_admin.sql`
- Modify (regenerated): `lib/database.types.ts`

- [ ] **Step 1: Confirm zero app-code references**

Run: `rg "is_admin" --glob '!supabase/**' --glob '!*.md'`
Expected: no matches in `app/`, `lib/`, `components/` (only migrations + docs). If any app-code reference exists, stop and resolve it before dropping.

- [ ] **Step 2: Write the migration**

`supabase/migrations/20260616000000_phase5_drop_is_admin.sql`:

```sql
-- Phase 5: physically drop the now-unused profiles.is_admin column.
-- Its RLS/trigger dependence was removed in 20260605000000_phase1_reconciliation.sql;
-- ADMIN_EMAILS (env) is the sole admin gate. Admin reads use the service-role client.
alter table public.profiles drop column if exists is_admin;
```

- [ ] **Step 3: Apply to the Vercel Supabase target**

Run: `pnpm supabase db push` (or apply via the Supabase SQL editor against the target if the CLI isn't linked).
Expected: column dropped; no error.

- [ ] **Step 4: Regenerate types**

Run: `pnpm db:types`
Expected: `lib/database.types.ts` no longer lists `is_admin` on `profiles`.

- [ ] **Step 5: Verify build**

Run: `pnpm type-check && pnpm build`
Expected: green (nothing referenced the column).

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260616000000_phase5_drop_is_admin.sql lib/database.types.ts
git commit -m "chore(p5): drop profiles.is_admin column + regenerate types"
```

> **Sequencing vs Task Group C:** if the legacy cutover restores into `profiles`, its `mapping.sql` must omit `is_admin` (already specified in C2 Step 2). With the target empty today, dropping now is safe.

### Task E3: `.cmd` script cleanup (confirm with user first)

- [ ] **Step 1: Confirm the keep-list with the user** (CLAUDE.md requires confirming `.cmd` intent). Default: keep `start-dev.cmd`, `deploy-vercel.cmd`; delete the rest.

- [ ] **Step 2: Delete the redundant git-wrappers**

```bash
git rm commit-all.cmd commit-fixes.cmd commit-push.cmd fix-build-and-push.cmd init-github.cmd push-observability.cmd push-vercel-fix.cmd unstick-and-push.cmd
del commit-gtm-and-push.cmd just-push.cmd
```

> `commit-gtm-and-push.cmd` and `just-push.cmd` are untracked (in `git status`) — remove with `del` (PowerShell), not `git rm`.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore(p5): remove redundant .cmd operator scripts (keep start-dev, deploy-vercel)"
```

### Task E4: Resolve `lib/analytics-server.ts` dangling reference + finalize CLAUDE.md

- [ ] **Step 1: Find any reference**

Run: `rg "analytics-server"`
Expected: only a README/CLAUDE mention (no code import). If a code import exists, create a minimal real module instead of deleting.

- [ ] **Step 2: Remove the dangling doc reference** (default path — no importer): edit the README/CLAUDE line that references `lib/analytics-server.ts` to drop the claim.

- [ ] **Step 3: Apply the pending CLAUDE.md edits owned by this group:** CI-runs-tests correction (from D1), `INTERCOM_IDENTITY_VERIFICATION_SECRET` env row (from B3), `.cmd` keep-list update, dead-code report note, and the `is_admin` "column kept" line → "column dropped".

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md README.md
git commit -m "docs(p5): correct CI/CMD/is_admin/env notes; drop analytics-server reference"
```

---

## Task Group F: Phase 5 — A11y + perf

**Owns (wave 1):** `app/{portal,admin}/tickets/*` + their components.

### Task F1: Keyboard + ARIA audit of ticket UIs

**Files:**
- Read + modify: `app/portal/tickets/page.tsx`, `app/portal/tickets/[id]/page.tsx`, `app/admin/tickets/page.tsx`, `app/admin/tickets/[id]/page.tsx`, and any `components/{portal,admin}/*ticket*` / create-modal components they use.

- [ ] **Step 1: Read each ticket file and list interactive controls**

For each page/component, enumerate buttons, links, the create modal, the file dropzone, status badges, and tables.

- [ ] **Step 2: Apply fixes (per control)**
  - Create-ticket modal: `role="dialog"`, `aria-labelledby` pointing at its title, focus trapped while open, focus restored to the trigger on close, `Escape` closes.
  - "Accept Quote" button: accessible name includes the amount, e.g. `aria-label={`Accept quote of ${formatCurrency(cents)}`}`.
  - Status badges: ensure the status word is text content (not color-only); if icon-only, add `<span className="sr-only">`.
  - File dropzone: ensure a real keyboard-focusable `<input type="file">` exists (label-wrapped) as the fallback to drag-drop.
  - Tables: add `<caption className="sr-only">` and `scope="col"` on headers.
  - Every interactive element has a visible focus ring (`focus-visible:ring-2 focus-visible:ring-ring`).

- [ ] **Step 3: Manual axe + keyboard pass**

Run the dev server, open each ticket page, run axe DevTools, and tab through every control. Fix any violations surfaced.

- [ ] **Step 4: Verify + commit**

Run: `pnpm type-check && pnpm lint`

```bash
git add app/portal/tickets app/admin/tickets components
git commit -m "fix(a11y): keyboard + ARIA on ticket UIs"
```

### Task F2: Lighthouse ≥90 verification

- [ ] **Step 1:** Run Lighthouse (Chrome DevTools or `pnpm dlx @lhci/cli autorun` if configured) against `/` and `/portal` on a production build (`pnpm build && pnpm start`).
- [ ] **Step 2:** If any category < 90, fix the specific regression (lazy-load heavy embeds, confirm consent-gated scripts aren't render-blocking). Record the four scores per page in the PR description.
- [ ] **Step 3 (only if code changed): Commit**

```bash
git add -A
git commit -m "perf: restore Lighthouse >=90 on landing + portal"
```

---

## Task Group G: Operational close-out (FINAL — after A,B,D,E,F; C soaked)

**Owns:** merge commit, `scripts/post-merge-smoke.md` (checklist).

### Task G1: Stripe webhook registration verification (USER + verify)

- [ ] **Step 1 (USER):** In the Stripe Dashboard, confirm an endpoint for `https://dobeu.net/api/webhooks/stripe` subscribed to `invoice.paid`, `invoice.payment_failed`, `invoice.finalized`, and that its signing secret matches `STRIPE_WEBHOOK_SECRET` in Vercel.
- [ ] **Step 2:** Send a Stripe test event (Dashboard → "Send test webhook") for `invoice.paid`; confirm a 200 in the endpoint logs and that an invoice row flips status.

### Task G2: End-to-end operational smoke (manual)

- [ ] **Step 1:** Create `scripts/post-merge-smoke.md` documenting the manual path: client submits a ticket (with a file) → admin quotes → client accepts → admin "Create Stripe Invoice" → client pays via the Stripe-hosted page → webhook flips status to `paid` → both portal + admin reflect it. Use a $1 live invoice for the final live check.
- [ ] **Step 2: Commit**

```bash
git add scripts/post-merge-smoke.md
git commit -m "docs(ops): post-merge end-to-end smoke checklist"
```

### Task G3: Merge `test/coverage` → `main`

- [ ] **Step 1: Full local verify**

Run: `pnpm verify`
Expected: type-check + lint + `test:ci` + build all green.

- [ ] **Step 2: Update branch + open PR**

```bash
git push -u origin test/coverage
gh pr create --base main --title "Phases 4-5 + legacy cutover: auth hardening, hygiene, production-ready" --body "$(cat <<'EOF'
## Summary
- Phase 4: Supabase TOTP MFA (admin AAL2 gate) + Intercom HMAC identity verification
- Phase 5: dead-code removal, drop profiles.is_admin, .cmd cleanup, a11y on ticket UIs, ticket-flow E2E, Lighthouse >=90
- Legacy db-dobeutech-unified cutover complete + soaked (or noted if deferred)
- Docs corrected (CI runs tests; env table; is_admin dropped)

## Test plan
- [ ] pnpm verify green
- [ ] CI green on the PR
- [ ] Admin /admin requires TOTP step-up
- [ ] Intercom rejects mismatched user_hash
- [ ] Ticket-flow E2E passes
- [ ] Stripe webhook test event flips invoice status
EOF
)"
```

- [ ] **Step 3:** After CI green + review, merge via the PR (no force-push to main). Run the `scripts/post-merge-smoke.md` checklist against production.

---

## Task Group H: Parallel dispatch map

Each row maps a task group to an independent agent. See the design doc §7 for the full file-touch overlap analysis.

| Agent | Task Group | Primary files owned | Overlap risk | Wave |
|---|---|---|---|---|
| 1 | A — MFA | `lib/utils.ts`, `lib/supabase/middleware.ts`, `components/portal/Mfa*.tsx`, `app/portal/settings/**`, `app/admin/layout.tsx` (banner) | shares `app/admin/layout.tsx` + `lib/utils.ts` with B/E | 1 |
| 2 | D — CI/E2E | `e2e/tickets.spec.ts` | none (reports CLAUDE.md CI note to E) | 1 |
| 3 | E — Dead code/hygiene | `.cmd` files, `supabase/migrations/*_drop_is_admin.sql`, `lib/database.types.ts`, `lib/*` exports, `CLAUDE.md`, `README.md` | `lib/utils.ts` (defer to wave 2), `CLAUDE.md` sole owner | 1 |
| 4 | F — A11y/perf | `app/{portal,admin}/tickets/**` + ticket components | none | 1 |
| 1 | B — Intercom HMAC | `lib/intercom-hmac.ts(.test)`, `app/portal/layout.tsx`, `app/admin/layout.tsx` | `app/admin/layout.tsx` (run after A5) | 2 |
| — | C — Legacy cutover | `.agent/migration/**`, `lib/database.types.ts` (post-cutover) | `lib/database.types.ts` after E2 | gated on user |
| — | G — Close-out | merge, `scripts/post-merge-smoke.md` | depends on all | final |

**Dispatch rules:**
- **Wave 1 (4 parallel agents):** A, D, E (skipping `lib/utils.ts` + the CLAUDE.md CI-note until handed off), F. C's inventory runs on the user's clock concurrently.
- **Wave 2:** Agent 1 continues with B (touches `app/admin/layout.tsx` after A5 committed). E finishes `CLAUDE.md` (folding in B3's env row + D1's CI correction) and the deferred `lib/utils.ts#sleep` removal.
- **`lib/database.types.ts` single-writer rule:** E2 regenerates after dropping `is_admin`; C's post-cutover regen is the final authoritative run. No hand edits.
- **`CLAUDE.md` single-owner rule:** Task Group E owns all CLAUDE.md edits; B and D report their doc changes to E.
- **Final:** G after A, B, D, E, F merged and C soaked (or C explicitly deferred with a note).

---

## Self-Review

**1. Spec coverage** — every design-doc section maps to a task group:
- §4.1 MFA → Group A (A1 helper, A2 middleware gate, A3 components, A4 step-up+settings, A5 bootstrap banner). ✔
- §4.2 Intercom HMAC → Group B (B1 helper+test, B2 wire layouts, B3 env doc). ✔
- §4.3 rate-limit → accepted-risk doc note folded into E4 CLAUDE.md edits. ✔
- §5 legacy cutover → Group C (C1 user inventory, C2 mapping SQL, C3 execute). ✔
- §6.1 CI (already done) → D1 doc correction. ✔  §6.2 dead code → E1. §6.3 drop is_admin → E2. §6.4 .cmd → E3. §6.5 a11y → F1. §6.6 E2E → D2. §6.7 Lighthouse → F2. §6.8 analytics-server → E4. ✔
- §7 parallel map → Group H. §9 success criteria → G1–G3 + per-task verifies. ✔

**2. Placeholder scan** — no "TBD/implement later/add error handling" left as instructions. Every code step has complete code. The two `(USER)` steps (C1, G1) are genuine human actions, labeled, not placeholders. The E1/E2 deletions are conditional-on-verification by design (delete only confirmed-dead exports) with the exact grep commands given, not vague "remove dead code." ✔

**3. Type consistency** — `requiresAal2Stepup({ currentLevel, nextLevel })` signature identical in A1 (def), A2 (use), design §4.1, §9. `intercomUserHash(userId: string): string | undefined` identical in B1 (def), B2 (use), design §4.2, §9. `IntercomIdentify` `user_hash?: string` prop matches the verified component signature. `formatCurrency(cents)` matches `lib/utils.ts`. Migration filename `20260616000000_phase5_drop_is_admin.sql` consistent between E2 and H. ✔

**4. Cross-group file-collision check** — `app/admin/layout.tsx` (A5 + B2): B2 sequenced wave 2. `lib/utils.ts` (A1 + E1): E defers. `lib/database.types.ts` (E2 + C): single-writer rule. `CLAUDE.md` (B3 + D1 + E4): single-owner (E). All collisions resolved in Group H, no two wave-1 agents share a file. ✔

---

## Addendum — Post-merge auth hardening (2026-06-17)

After the `test/coverage` → `main` merge (PR #80) shipped to production, magic-link sign-in on
`https://dobeu.net` redirected users to `http://localhost:3000/?code=…`. Root cause was two-layered:

1. **Code (fixed + now deployed):** `LoginForm` originally derived `emailRedirectTo` from the live
   browser origin without forcing the production custom domain. Commits `d2e29ec` (redirect fix via
   `buildAuthCallbackUrl` / `resolveAuthOrigin`) and `e44cfd1` (60s double-submit guard) fixed this
   but **had not been deployed** — the live Vercel build predated both commits.
2. **Supabase config (operator-only):** A `?code=` on the **root** path (not `/auth/callback`) is the
   signature of Supabase appending the code to the **Site URL** because the requested `redirect_to`
   wasn't in the **Redirect URLs allowlist**. If Site URL is localhost, the link lands on localhost.

**Shipped in this round (app-side, automatic after deploy):**
- **Defensive `?code=` forwarder** in `lib/supabase/middleware.ts` — any stray auth code on a
  non-`/auth/callback` path is 307-redirected to `/auth/callback` (preserves `next`). Self-heals the
  Site-URL-root fallback (same host). Tested in `lib/supabase/middleware.test.ts`.
- **Password sign-in fallback** on `/login` (`app/login/LoginForm.tsx` "Sign in with a password
  instead" toggle → `signInWithPassword`) for cutover when email is down.
- **`scripts/set-user-password.mjs`** — operator service-role script to set/create a password with
  **no email round-trip** (password from env or prompt; never CLI arg / git).

**Operator must still set in Supabase Dashboard (project `ipmjokuezeuukhrilduq`):** Site URL =
`https://dobeu.net`, Redirect URLs allowlist, Resend SMTP, raised rate limits, and enable the
Email+Password provider for the fallback. See `docs/DEPLOYMENT.md` Phase 2 steps 7–9 and
`.agent/migration/cutover-execute.md` → "Auth troubleshooting (cutover)".
