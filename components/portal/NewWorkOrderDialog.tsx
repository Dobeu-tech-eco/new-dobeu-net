"use client";

import { useState, useTransition, useRef, useId } from "react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";
import { submitWorkOrder, finalizeWorkOrderAttachment } from "@/lib/actions/work-orders";
import { createClient } from "@/lib/supabase/client";

const WO_BUCKET = "work-order-attachments";

const SERVICE_TYPES = [
  { value: "logo", label: "Logo / brand mark" },
  { value: "website_update", label: "Website update" },
  { value: "data_export", label: "Data export" },
  { value: "consulting", label: "Consulting" },
  { value: "other", label: "Other" }
] as const;

const MAX_FILES = 5;
const MAX_FILE_SIZE = 25 * 1024 * 1024;
const ALLOWED_MIME = new Set<string>([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/svg+xml",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "text/csv"
]);

export function NewWorkOrderDialog() {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const errorId = useId();

  async function handleSubmit(formData: FormData) {
    setError(null);

    const files = Array.from(fileInputRef.current?.files ?? []);
    if (files.length > MAX_FILES) {
      setError(`Max ${MAX_FILES} attachments.`);
      return;
    }
    for (const f of files) {
      if (f.size > MAX_FILE_SIZE) {
        setError(`"${f.name}" exceeds 25 MB.`);
        return;
      }
      if (!ALLOWED_MIME.has(f.type)) {
        setError(`"${f.name}" (${f.type || "unknown"}) is not an allowed file type.`);
        return;
      }
    }

    const payload = {
      service_type: String(formData.get("service_type") ?? "other") as
        | "logo"
        | "website_update"
        | "data_export"
        | "consulting"
        | "other",
      title: String(formData.get("title") ?? "").trim(),
      description: (String(formData.get("description") ?? "").trim() || null) as string | null,
      attachments: files.map((f) => ({
        filename: f.name,
        mime_type: f.type || "application/octet-stream",
        size_bytes: f.size
      }))
    };

    startTransition(async () => {
      const result = await submitWorkOrder(payload);
      if (!result.ok) {
        setError(result.error);
        return;
      }

      // Upload bytes to each signed URL, THEN finalize the attachment row so a
      // failed PUT never leaves a dangling row whose signed-download link 404s.
      const targets = result.data.uploadTargets;
      if (targets.length > 0) {
        const supabase = createClient();
        const failures: string[] = [];
        for (const t of targets) {
          const file = files.find((f) => f.name === t.filename && f.size === t.size_bytes);
          if (!file) {
            failures.push(t.filename);
            continue;
          }
          const { error: uploadErr } = await supabase.storage
            .from(WO_BUCKET)
            .uploadToSignedUrl(t.storage_path, t.token, file, {
              contentType: t.mime_type || "application/octet-stream"
            });
          if (uploadErr) {
            failures.push(t.filename);
            continue;
          }
          const fin = await finalizeWorkOrderAttachment({
            work_order_id: result.data.id,
            storage_path: t.storage_path,
            filename: t.filename,
            mime_type: t.mime_type,
            size_bytes: t.size_bytes
          });
          if (!fin.ok) failures.push(t.filename);
        }
        if (failures.length > 0) {
          // The ticket itself was created — surface partial-upload failures
          // without discarding it.
          setError(
            `Ticket created, but these files failed to upload: ${failures.join(", ")}. You can re-attach them later.`
          );
          if (fileInputRef.current) fileInputRef.current.value = "";
          return;
        }
      }

      setOpen(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>New ticket</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Open a new ticket</DialogTitle>
          <DialogDescription>
            Tell me what you need. I&apos;ll review, quote, and reply within one business day.
          </DialogDescription>
        </DialogHeader>
        <form action={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="service_type">Service type</Label>
            <select
              id="service_type"
              name="service_type"
              required
              defaultValue=""
              className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-base shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="" disabled>
                Pick one…
              </option>
              {SERVICE_TYPES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              name="title"
              required
              minLength={2}
              maxLength={160}
              placeholder="e.g. New logo for storefront"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description">Notes</Label>
            <Textarea
              id="description"
              name="description"
              rows={4}
              maxLength={8000}
              placeholder="Anything I should know — references, deadlines, budgets…"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="attachments">Attachments (optional, max 5 × 25 MB)</Label>
            <input
              ref={fileInputRef}
              id="attachments"
              name="attachments"
              type="file"
              multiple
              accept=".png,.jpg,.jpeg,.webp,.gif,.svg,.pdf,.docx,.xlsx,.pptx,.txt,.csv"
              aria-describedby={error ? errorId : undefined}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-secondary-foreground"
            />
          </div>

          {error && (
            <p
              id={errorId}
              role="alert"
              className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
            >
              {error}
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {pending ? "Submitting…" : "Submit ticket"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
