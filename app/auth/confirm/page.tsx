import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { sanitizeNextPath } from "@/lib/utils";
import { otpParamsSchema } from "./schema";
import { OTP_COOKIE } from "./cookie";

export const dynamic = "force-dynamic";
// No page-level referrer override: `no-referrer` makes browsers send
// `Origin: null` on this page's form POST, which the submit route's CSRF
// check rejects. The URL holds only `next` (the token is in a cookie), so
// the site-wide origin-when-cross-origin policy is enough.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function hasPendingOtp(raw: string | undefined): boolean {
  if (!raw) return false;
  try {
    let value: unknown;
    try {
      value = JSON.parse(raw);
    } catch {
      value = JSON.parse(decodeURIComponent(raw));
    }
    return otpParamsSchema.safeParse(value).success;
  } catch {
    return false;
  }
}

export default async function ConfirmPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const nextRaw = Array.isArray(sp.next) ? sp.next[0] : sp.next;
  const next = sanitizeNextPath(nextRaw ?? "", "/portal");
  const jar = await cookies();
  const pending = hasPendingOtp(jar.get(OTP_COOKIE)?.value);

  return (
    <main className="mx-auto max-w-sm p-8 text-center space-y-4">
      {pending ? (
        <>
          <h1 className="font-display text-2xl font-bold tracking-tight">Continue signing in</h1>
          <form method="post" action="/auth/confirm/submit">
            <input type="hidden" name="next" value={next} />
            <button
              type="submit"
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            >
              Continue signing in
            </button>
          </form>
        </>
      ) : (
        <>
          <h1 className="font-display text-2xl font-bold tracking-tight">
            This sign-in link has expired or was already used
          </h1>
          <Link href="/login" className="text-sm font-medium text-primary hover:underline">
            Back to login
          </Link>
        </>
      )}
    </main>
  );
}
