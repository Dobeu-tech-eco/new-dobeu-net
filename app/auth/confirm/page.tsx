import { redirect } from "next/navigation";
import { sanitizeNextPath } from "@/lib/utils";
import { otpParamsSchema } from "./schema";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(v: string | string[] | undefined): string {
  return Array.isArray(v) ? (v[0] ?? "") : (v ?? "");
}

export default async function ConfirmPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const parsed = otpParamsSchema.safeParse({
    token_hash: first(sp.token_hash),
    type: first(sp.type),
  });
  if (!parsed.success) redirect("/login?error=auth_callback_failed");
  const next = sanitizeNextPath(first(sp.next), "/portal");

  return (
    <main className="mx-auto max-w-sm p-8 text-center space-y-4">
      <h1 className="font-display text-2xl font-bold tracking-tight">Continue signing in</h1>
      <form method="post" action="/auth/confirm">
        <input type="hidden" name="token_hash" value={parsed.data.token_hash} />
        <input type="hidden" name="type" value={parsed.data.type} />
        <input type="hidden" name="next" value={next} />
        <button
          type="submit"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Continue signing in
        </button>
      </form>
    </main>
  );
}
