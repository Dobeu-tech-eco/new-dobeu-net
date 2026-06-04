"use client";

import { useState, useTransition, useRef } from "react";
import { Button } from "@/components/ui/button";
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
import { submitWorkOrder } from "@/lib/actions/work-orders";

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
      // Phase 3 limitation: signed-URL upload + storage object PUT lands as a
      // follow-up. The rows + attachment records are already persisted.
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
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-secondary-foreground"
            />
          </div>

          {error && (
            <p className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              {error}
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Submitting…" : "Submit ticket"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
