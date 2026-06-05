import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Authenticated file download.
 *
 * Both the portal "Files" list and the per-project file list POST here. We:
 *   1. Look up the project_files row via the RLS-bound server client. RLS
 *      already scopes to the owner (or admin), so a 404 here means "you can't
 *      see this file" without leaking whether it exists.
 *   2. Create a 60s signed URL against the `project-files` bucket (also
 *      RLS-protected per the migration's storage policies).
 *   3. 303 redirect to the signed URL.
 *
 * Form posts (not GET) so a leaked log line never lands on a usable URL.
 */
async function issueSignedUrl(id: string, origin: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL(`/login?next=/portal/files`, origin));
  }

  const { data: file, error } = await supabase
    .from("project_files")
    .select("id,storage_path,filename")
    .eq("id", id)
    .single();
  if (error || !file) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const signed = await supabase.storage
    .from("project-files")
    .createSignedUrl(file.storage_path, 60, { download: file.filename });
  if (signed.error || !signed.data?.signedUrl) {
    return NextResponse.json({ error: "signed_url_failed" }, { status: 500 });
  }

  return NextResponse.redirect(signed.data.signedUrl, 303);
}

export async function POST(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  return issueSignedUrl(id, new URL(request.url).origin);
}

// Allow GET too for direct links from emails / future admin tools — same auth check.
export async function GET(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  return issueSignedUrl(id, new URL(request.url).origin);
}
