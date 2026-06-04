"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateProfile } from "@/lib/actions/profile";

interface InitialProfile {
  full_name: string;
  company: string;
}

export function SettingsForm({ initial }: { initial: InitialProfile }) {
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  async function handleSubmit(formData: FormData) {
    setError(null);
    setSaved(false);
    const payload = {
      full_name: String(formData.get("full_name") ?? "") || null,
      company: String(formData.get("company") ?? "") || null,
      phone: String(formData.get("phone") ?? "") || null
    };
    startTransition(async () => {
      const result = await updateProfile(payload);
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
          defaultValue={initial.full_name}
          autoComplete="name"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="company">Company</Label>
        <Input
          id="company"
          name="company"
          maxLength={160}
          defaultValue={initial.company}
          autoComplete="organization"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="phone">Phone (optional)</Label>
        <Input id="phone" name="phone" type="tel" maxLength={40} autoComplete="tel" />
      </div>
      {error && (
        <p className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {error}
        </p>
      )}
      {saved && (
        <p className="rounded-md border border-primary/30 bg-primary/5 p-3 text-sm text-primary">
          Profile saved.
        </p>
      )}
      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save profile"}
        </Button>
      </div>
    </form>
  );
}
