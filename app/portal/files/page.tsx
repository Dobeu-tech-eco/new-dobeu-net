import { createClient } from "@/lib/supabase/server";

export default async function FilesPage() {
  const supabase = await createClient();
  const { data: files } = await supabase
    .from("project_files")
    .select("id,filename,mime,size_bytes,uploaded_at,retention_until,project_id,storage_path")
    .order("uploaded_at", { ascending: false });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl font-bold tracking-tight">Files</h1>
        <p className="text-muted-foreground mt-1">
          All deliverables. Stored encrypted, kept for 3 years from upload.
        </p>
      </header>

      {!files || files.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center">
          <p className="font-semibold">No files yet</p>
        </div>
      ) : (
        <ul className="rounded-lg border border-border divide-y divide-border">
          {files.map((f) => (
            <li key={f.id} className="p-4 grid grid-cols-[1fr_auto] items-center gap-3">
              <div>
                <p className="font-medium">{f.filename}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {f.mime ?? "file"} · {f.size_bytes ? `${(f.size_bytes / 1024).toFixed(1)} KB` : "—"} ·
                  retained until {new Date(f.retention_until).toLocaleDateString()}
                </p>
              </div>
              <form action={`/api/files/${f.id}/download`} method="post">
                <button type="submit" className="text-sm font-medium text-primary hover:underline">
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
