"use client";

import { useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import {
  createDeliverableUploadUrl,
  recordDeliverable
} from "@/lib/actions/files";
import {
  MAX_DELIVERABLE_BYTES,
  EXTENSION_MIME,
  ALLOWED_EXTENSIONS_LABEL,
  MAX_FILENAME_LENGTH,
  filenameError,
  tooLargeMessage
} from "@/lib/deliverable-limits";

const BUCKET = "project-files";

export function DeliverableUpload({ projectId }: { projectId: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function handleSubmit(formData: FormData) {
    setError(null);
    setOkMsg(null);

    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      setError("Choose a file to upload.");
      return;
    }
    // Client-side pre-checks (server re-validates MIME on record).
    if (file.size > MAX_DELIVERABLE_BYTES) {
      setError(tooLargeMessage(file.size));
      return;
    }
    // Canonical MIME comes from the extension; the browser's file.type is ignored.
    const dot = file.name.lastIndexOf(".");
    const ext = dot < 0 ? "" : file.name.slice(dot + 1).toLowerCase();
    const mime = Object.prototype.hasOwnProperty.call(EXTENSION_MIME, ext) ? EXTENSION_MIME[ext] : undefined;
    if (!mime) {
      setError("Unsupported file type.");
      return;
    }

    const nameError = filenameError(file.name, mime);
    if (nameError) {
      setError(`${nameError}. Rename the file (letters, digits, dot, space, underscore, hyphen; max ${MAX_FILENAME_LENGTH} chars).`);
      return;
    }

    startTransition(async () => {
      // 1. Mint a signed upload URL (admin).
      const urlRes = await createDeliverableUploadUrl({
        project_id: projectId,
        filename: file.name,
        size_bytes: file.size,
        mime
      });
      if (!urlRes.ok) {
        setError(urlRes.error);
        return;
      }

      // 2. PUT the bytes directly to storage from the browser.
      const supabase = createClient();
      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .uploadToSignedUrl(urlRes.data.path, urlRes.data.token, file, {
          contentType: mime
        });
      if (uploadError) {
        const e = uploadError as { message: string; statusCode?: string | number; status?: number };
        const code = Number(e.statusCode ?? e.status);
        const tooBig = code === 413 || (Number.isNaN(code) && /exceed|too large/i.test(e.message));
        setError(tooBig ? tooLargeMessage(file.size) : e.message);
        return;
      }

      // 3. Record the project_files row (admin).
      const recordRes = await recordDeliverable({
        project_id: projectId,
        storage_path: urlRes.data.path,
        filename: file.name,
        mime,
        size_bytes: file.size
      });
      if (!recordRes.ok) {
        setError(recordRes.error);
        return;
      }

      setOkMsg(`Uploaded ${file.name}.`);
      if (inputRef.current) inputRef.current.value = "";
    });
  }

  return (
    <form action={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="deliverable_file">Deliverable file</Label>
        <input
          ref={inputRef}
          id="deliverable_file"
          name="file"
          type="file"
          className="block w-full text-sm text-muted-foreground file:mr-4 file:rounded-md file:border-0 file:bg-primary file:px-4 file:py-2 file:text-sm file:font-medium file:text-primary-foreground hover:file:opacity-90"
        />
        <p className="text-xs text-muted-foreground">Allowed: {ALLOWED_EXTENSIONS_LABEL}. 25MB max. Names: letters, digits, dot, space, underscore, hyphen.</p>
      </div>
      {error && (
        <p className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {error}
        </p>
      )}
      {okMsg && (
        <p className="rounded-md border border-primary/30 bg-primary/5 p-3 text-sm text-primary">
          {okMsg}
        </p>
      )}
      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? "Uploading…" : "Upload deliverable"}
        </Button>
      </div>
    </form>
  );
}
