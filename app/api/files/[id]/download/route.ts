import { NextResponse } from "next/server";
import { requireUser, AuthError } from "@/lib/actions/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SIGNED_URL_TTL_SECONDS = 60;

/**
 * Authenticated file download. POST from the portal "Files" / per-project forms;
 * GET for direct links (emails / future admin tools). Both share one path:
 *   1. Assert an authenticated user (requireUser) — anonymous callers get a clean
 *      401 instead of an RLS-masked 404.
 *   2. Look up the project_files row via the RLS-bound client (RLS scopes to
 *      owner/admin; a missing/unauthorized id 404s without leaking existence).
 *   3. Issue a 60s signed URL against the `project-files` bucket and 303-redirect.
 */
async function issueSignedUrl(id: string) {
  let supabase;
  try {
    ({ supabase } = await requireUser());
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw error;
  }

  if (!id) return NextResponse.json({ error: "Missing file id" }, { status: 400 });

  const { data: file, error: fileError } = await supabase
    .from("project_files")
    .select("id,storage_path")
    .eq("id", id)
    .single();

  if (fileError || !file?.storage_path) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  const { data: signed, error: signedError } = await supabase.storage
    .from("project-files")
    .createSignedUrl(file.storage_path, SIGNED_URL_TTL_SECONDS);

  if (signedError || !signed?.signedUrl) {
    return NextResponse.json({ error: "Could not create download URL" }, { status: 500 });
  }

  return NextResponse.redirect(signed.signedUrl, 303);
}

export async function POST(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return issueSignedUrl(id);
}

// Allow GET too for direct links from emails / future admin tools — same auth check.
export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return issueSignedUrl(id);
}
