"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateUser } from "@/lib/actions/users";

interface UserInput {
  id: string;
  full_name: string | null;
  company: string | null;
}

export function EditUserForm({ user }: { user: UserInput }) {
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  async function handleSubmit(formData: FormData) {
    setError(null);
    setSaved(false);
    const payload = {
      id: user.id,
      full_name: String(formData.get("full_name") ?? "") || null,
      company: String(formData.get("company") ?? "") || null
    };
    startTransition(async () => {
      const result = await updateUser(payload);
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
        <Label htmlFor="full_name">Full name</Label>
        <Input
          id="full_name"
          name="full_name"
          minLength={1}
          maxLength={160}
          defaultValue={user.full_name ?? ""}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="company">Company</Label>
        <Input id="company" name="company" maxLength={160} defaultValue={user.company ?? ""} />
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
