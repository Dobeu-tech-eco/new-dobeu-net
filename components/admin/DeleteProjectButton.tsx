"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { deleteProject } from "@/lib/actions/projects";

/**
 * Two-step confirm: first click arms the button, second click within ~5s deletes.
 * Avoids a dependency on a confirmation modal primitive for one button.
 */
export function DeleteProjectButton({ id, title }: { id: string; title: string }) {
  const router = useRouter();
  const [armed, setArmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleArm() {
    setError(null);
    setArmed(true);
    setTimeout(() => setArmed(false), 5000);
  }

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteProject({ id });
      if (!result.ok) {
        setError(result.error);
        setArmed(false);
        return;
      }
      router.push("/admin/projects");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-2">
      {!armed ? (
        <Button type="button" variant="destructive" onClick={handleArm}>
          Delete project
        </Button>
      ) : (
        <div className="flex gap-2 items-center">
          <p className="text-sm text-destructive font-medium">
            Confirm delete &ldquo;{title}&rdquo;?
          </p>
          <Button type="button" variant="destructive" disabled={pending} onClick={handleDelete}>
            {pending ? "Deleting…" : "Yes, delete"}
          </Button>
          <Button type="button" variant="ghost" onClick={() => setArmed(false)}>
            Cancel
          </Button>
        </div>
      )}
      {error && (
        <p className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
