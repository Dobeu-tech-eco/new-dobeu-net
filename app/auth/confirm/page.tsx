import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { sanitizeNextPath } from "@/lib/utils";
import { otpParamsSchema } from "./schema";
import { OTP_COOKIE } from "./cookie";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  referrer: "no-referrer",
  robots: { index: false, follow: false },
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function hasPendingOtp(raw: string | undefined): boolean {
  if (!raw) return false;
  try {
    return otpParamsSchema.safeParse(JSON.parse(decodeURIComponent(raw))).success;
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
          <form method="post" action="/auth/confirm">
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
