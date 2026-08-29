import { NextResponse } from "next/server";
import { getAssetDownloadUrl } from "@/lib/actions/assets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Authenticated digital-asset download. POST from the portal "My assets" page;
 * GET for direct links (emails / future tools). Both delegate the entitlement
 * gate + signed-URL minting to `getAssetDownloadUrl`, then 303-redirect the
 * browser to the short-lived signed URL.
 *
 * Error mapping mirrors `/api/files/[id]/download`: anonymous callers get 401,
 * non-entitled callers 403, everything else 404 — no RLS existence leak.
 */
async function issueSignedUrl(id: string): Promise<NextResponse> {
  const result = await getAssetDownloadUrl(id);
  if (!result.ok) {
    const status =
      result.error === "not_authenticated"
        ? 401
        : result.error === "not_entitled"
          ? 403
          : 404;
    return NextResponse.json({ error: result.error }, { status });
  }
  return NextResponse.redirect(result.data.url, 303);
}

export async function POST(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return issueSignedUrl(id);
}

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return issueSignedUrl(id);
}
