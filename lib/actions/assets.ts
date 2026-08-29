"use server";
/**
 * Purchased digital-asset portal actions (Phase 5).
 *
 * Entitlements are the source of truth for "may this caller download X". Both
 * actions run through the cookie-bound client so RLS is the enforcement layer:
 *   - digital_assets:     signed-in users read the ACTIVE catalog.
 *   - asset_entitlements: a row is visible only when user_id = caller OR the
 *     caller is an active member of company_id.
 *
 * So "is the caller entitled" collapses to "does the RLS-scoped query return a
 * row" — we never re-check ownership in application code.
 *
 * The generated stub types don't model the entitlement -> asset FK as an
 * embeddable relationship, so we resolve in two queries and join in memory
 * rather than a PostgREST nested select.
 *
 * Bucket is `digital-assets` (kebab-plural, matching `project-files` /
 * `work-order-attachments`).
 *
 * Server-only by transitive import of `@/lib/supabase/server` via `./auth`.
 */
import { z } from "zod";
import { requireUser, AuthError, type DBClient } from "@/lib/actions/auth";

const BUCKET = "digital-assets";

/** Signed download links live for 10 minutes. */
const SIGNED_URL_TTL_SECONDS = 60 * 10;

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

export interface EntitledAsset {
  id: string;
  title: string;
  description: string | null;
  granted_at: string;
  source: string;
}

const assetId = z.string().uuid("invalid asset id");

/**
 * List the assets the caller is entitled to (direct grant or via company
 * membership). RLS on `asset_entitlements` does the scoping; we join to the
 * catalog for display fields.
 */
export async function listEntitledAssets(): Promise<ActionResult<EntitledAsset[]>> {
  let supabase: DBClient;
  try {
    ({ supabase } = await requireUser());
  } catch (e) {
    if (e instanceof AuthError) return { ok: false, error: e.code };
    throw e;
  }

  const { data: entitlements, error: entErr } = await supabase
    .from("asset_entitlements")
    .select("asset_id,source,granted_at")
    .order("granted_at", { ascending: false });

  if (entErr) return { ok: false, error: entErr.message };
  if (!entitlements || entitlements.length === 0) return { ok: true, data: [] };

  // Keep the most-recent grant per asset (a caller can hold both a personal
  // grant and a company grant for the same asset).
  const grantByAsset = new Map<string, { source: string; granted_at: string }>();
  for (const e of entitlements) {
    if (!e.asset_id || grantByAsset.has(e.asset_id)) continue;
    grantByAsset.set(e.asset_id, { source: e.source, granted_at: e.granted_at });
  }

  const { data: assets, error: assetErr } = await supabase
    .from("digital_assets")
    .select("id,title,description")
    .in("id", [...grantByAsset.keys()]);

  if (assetErr) return { ok: false, error: assetErr.message };

  const result: EntitledAsset[] = (assets ?? []).map((a) => {
    const grant = grantByAsset.get(a.id);
    return {
      id: a.id,
      title: a.title,
      description: a.description,
      granted_at: grant?.granted_at ?? "",
      source: grant?.source ?? "stripe"
    };
  });

  // Newest grant first (the catalog `.in()` result has no guaranteed order).
  result.sort((x, y) => (x.granted_at < y.granted_at ? 1 : x.granted_at > y.granted_at ? -1 : 0));

  return { ok: true, data: result };
}

/**
 * Mint a short-lived signed download URL for an entitled asset. Returns
 * `not_entitled` when no RLS-visible entitlement row exists for the caller.
 */
export async function getAssetDownloadUrl(
  raw: unknown
): Promise<ActionResult<{ url: string }>> {
  const parsed = assetId.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.map((i) => i.message).join("; ") };
  }
  const id = parsed.data;

  let supabase: DBClient;
  try {
    ({ supabase } = await requireUser());
  } catch (e) {
    if (e instanceof AuthError) return { ok: false, error: e.code };
    throw e;
  }

  // Entitlement gate: RLS returns a row only if the caller is entitled
  // (direct grant or via an active company membership).
  const { data: entRows, error: entErr } = await supabase
    .from("asset_entitlements")
    .select("id")
    .eq("asset_id", id)
    .limit(1);

  if (entErr) return { ok: false, error: entErr.message };
  if (!entRows || entRows.length === 0) return { ok: false, error: "not_entitled" };

  // RLS on digital_assets also enforces `active` — an inactive asset 404s here.
  const { data: asset, error: assetErr } = await supabase
    .from("digital_assets")
    .select("storage_path")
    .eq("id", id)
    .single();

  if (assetErr || !asset?.storage_path) {
    return { ok: false, error: assetErr?.message ?? "asset not found" };
  }

  const { data: signed, error: signErr } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(asset.storage_path, SIGNED_URL_TTL_SECONDS);

  if (signErr || !signed?.signedUrl) {
    return { ok: false, error: signErr?.message ?? "could not create download url" };
  }

  return { ok: true, data: { url: signed.signedUrl } };
}
