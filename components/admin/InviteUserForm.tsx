"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { inviteUser } from "@/lib/actions/users";

export function InviteUserForm() {
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function handleSubmit(formData: FormData) {
    setError(null);
    setOkMsg(null);
    const payload = {
      email: String(formData.get("email") ?? ""),
      full_name: String(formData.get("full_name") ?? "") || null
    };
    startTransition(async () => {
      const result = await inviteUser(payload);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setOkMsg(`Invite sent to ${result.data.email}.`);
    });
  }

  return (
    <form action={handleSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="invite_email">Email</Label>
          <Input
            id="invite_email"
            name="email"
            type="email"
            required
            maxLength={254}
            placeholder="client@example.com"
            autoComplete="off"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="invite_full_name">Name (optional)</Label>
          <Input id="invite_full_name" name="full_name" maxLength={160} autoComplete="off" />
        </div>
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
          {pending ? "Sending…" : "Send invite"}
        </Button>
      </div>
    </form>
  );
}
