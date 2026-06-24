"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateProfile } from "@/lib/actions/profile";

interface InitialProfile {
  full_name: string;
  company: string;
  // Optional so the existing settings page (which only passes full_name +
  // company today) still compiles. CRITICAL: phone / notify_email controls are
  // rendered AND submitted only when the page actually supplies their initial
  // values. Otherwise a save would write phone=null / notify_email=true and
  // silently clobber columns the form never displayed. Once the page selects +
  // passes these columns, the controls appear and round-trip correctly.
  phone?: string;
  notify_email?: boolean;
}

export function SettingsForm({ initial }: { initial: InitialProfile }) {
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  // Only manage fields the page actually provided initial values for — see the
  // InitialProfile comment. Submitting an un-prefilled field would clobber it.
  const showPhone = initial.phone !== undefined;
  const showNotify = initial.notify_email !== undefined;

  async function handleSubmit(formData: FormData) {
    setError(null);
    setSaved(false);
    const payload: {
      full_name: string | null;
      company: string | null;
      phone?: string | null;
      notify_email?: boolean;
    } = {
      full_name: String(formData.get("full_name") ?? "") || null,
      company: String(formData.get("company") ?? "") || null
    };
    if (showPhone) payload.phone = String(formData.get("phone") ?? "") || null;
    // Unchecked checkboxes are absent from FormData -> false.
    if (showNotify) payload.notify_email = formData.get("notify_email") === "on";
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
      {showPhone && (
        <div className="space-y-1.5">
          <Label htmlFor="phone">Phone (optional)</Label>
          <Input
            id="phone"
            name="phone"
            type="tel"
            maxLength={40}
            defaultValue={initial.phone ?? ""}
            autoComplete="tel"
          />
        </div>
      )}
      {showNotify && (
        <div className="flex items-center gap-2">
          <input
            id="notify_email"
            name="notify_email"
            type="checkbox"
            defaultChecked={initial.notify_email ?? true}
            className="h-4 w-4 rounded border-input accent-primary"
          />
          <Label htmlFor="notify_email" className="font-normal">
            Email me account &amp; project notifications
          </Label>
        </div>
      )}
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
          {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {pending ? "Saving…" : "Save profile"}
        </Button>
      </div>
    </form>
  );
}
