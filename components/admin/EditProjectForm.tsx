"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateProject } from "@/lib/actions/projects";

interface ProjectInput {
  id: string;
  title: string;
  description: string | null;
  status: "proposed" | "active" | "delivered" | "closed";
  total_cents: number;
}

export function EditProjectForm({ project }: { project: ProjectInput }) {
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  async function handleSubmit(formData: FormData) {
    setError(null);
    setSaved(false);
    const payload = {
      id: project.id,
      title: String(formData.get("title") ?? ""),
      description: String(formData.get("description") ?? "") || null,
      status: String(formData.get("status") ?? project.status) as ProjectInput["status"],
      total_cents: Number(formData.get("total_cents") ?? 0)
    };
    startTransition(async () => {
      const result = await updateProject(payload);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSaved(true);
    });
  }

  return (
    <form action={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="title">Title</Label>
        <Input
          id="title"
          name="title"
          required
          minLength={2}
          maxLength={160}
          defaultValue={project.title}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          name="description"
          maxLength={8000}
          rows={4}
          defaultValue={project.description ?? ""}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="status">Status</Label>
          <select
            id="status"
            name="status"
            defaultValue={project.status}
            className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-base shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="proposed">Proposed</option>
            <option value="active">Active</option>
            <option value="delivered">Delivered</option>
            <option value="closed">Closed</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="total_cents">Value (cents)</Label>
          <Input
            id="total_cents"
            name="total_cents"
            type="number"
            min={0}
            defaultValue={project.total_cents}
          />
        </div>
      </div>
      {error && (
        <p className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {error}
        </p>
      )}
      {saved && (
        <p className="rounded-md border border-primary/30 bg-primary/5 p-3 text-sm text-primary">
          Saved.
        </p>
      )}
      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
