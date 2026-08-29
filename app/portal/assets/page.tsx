import { listEntitledAssets } from "@/lib/actions/assets";

// Depends on the authed user (RLS-scoped entitlements); never pre-render.
export const dynamic = "force-dynamic";

export default async function AssetsPage() {
  const result = await listEntitledAssets();
  const assets = result.ok ? result.data : [];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl font-bold tracking-tight">My assets</h1>
        <p className="text-muted-foreground mt-1">
          Digital products you&apos;ve purchased. Download links are signed and expire
          after 10 minutes.
        </p>
      </header>

      {!result.ok ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center">
          <p className="font-semibold">Couldn&apos;t load your assets</p>
          <p className="text-sm text-muted-foreground mt-1">Please try again shortly.</p>
        </div>
      ) : assets.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center">
          <p className="font-semibold">No assets yet</p>
          <p className="text-sm text-muted-foreground mt-1">
            Purchased downloads will appear here.
          </p>
        </div>
      ) : (
        <ul className="rounded-lg border border-border divide-y divide-border">
          {assets.map((a) => (
            <li
              key={a.id}
              className="p-4 grid grid-cols-[1fr_auto] items-center gap-3"
            >
              <div>
                <p className="font-medium">{a.title}</p>
                {a.description ? (
                  <p className="text-sm text-muted-foreground mt-0.5">{a.description}</p>
                ) : null}
                <p className="text-xs text-muted-foreground mt-0.5">
                  Purchased{" "}
                  {a.granted_at
                    ? new Date(a.granted_at).toLocaleDateString()
                    : "—"}
                </p>
              </div>
              <form action={`/api/assets/${a.id}/download`} method="post">
                <button
                  type="submit"
                  className="text-sm font-medium text-primary hover:underline"
                >
                  Download →
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
