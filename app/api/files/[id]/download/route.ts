import { NextResponse } from "next/server";
import { requireUser, AuthError } from "@/lib/actions/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SIGNED_URL_TTL_SECONDS = 60;

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  // Explicit authn gate. RLS on `project_files` / storage is defense-in-depth,
  // but we assert an authenticated user up front so anonymous callers get a
  // clean 401 instead of a misleading 404 from an RLS-filtered empty result.
  let supabase;
  try {
    ({ supabase } = await requireUser());
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw error;
  }

  const { id } = await context.params;
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
