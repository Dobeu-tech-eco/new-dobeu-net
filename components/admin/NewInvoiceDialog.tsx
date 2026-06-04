"use client";

import { useState, useTransition, useMemo } from "react";
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
import { createInvoice } from "@/lib/actions/invoices";

interface UserOption {
  id: string;
  label: string;
}

interface ProjectOption {
  id: string;
  label: string;
  ownerUserId: string;
}

export function NewInvoiceDialog({
  users,
  projects
}: {
  users: UserOption[];
  projects: ProjectOption[];
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [selectedUserId, setSelectedUserId] = useState("");

  const userProjects = useMemo(
    () => projects.filter((p) => !selectedUserId || p.ownerUserId === selectedUserId),
    [projects, selectedUserId]
  );

  async function handleSubmit(formData: FormData) {
    setError(null);
    const user_id = String(formData.get("user_id") ?? "");
    const project_id = String(formData.get("project_id") ?? "");
    const dollars = Number(formData.get("amount") ?? 0);
    const description = (String(formData.get("description") ?? "").trim() || null) as string | null;
    if (!user_id) {
      setError("Pick a recipient.");
      return;
    }
    if (!project_id) {
      setError("Pick a project (invoices are project-scoped).");
      return;
    }
    if (!Number.isFinite(dollars) || dollars <= 0) {
      setError("Amount must be a positive dollar value.");
      return;
    }
    const payload = {
      user_id,
      project_id,
      amount_cents: Math.round(dollars * 100),
      description
    };
    startTransition(async () => {
      const result = await createInvoice(payload);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button disabled={users.length === 0}>
          {users.length === 0 ? "No users yet" : "New invoice"}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Stripe invoice</DialogTitle>
          <DialogDescription>
            Creates a Stripe-hosted invoice and emails the payment link to the recipient.
          </DialogDescription>
        </DialogHeader>
        <form action={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="user_id">Recipient</Label>
            <select
              id="user_id"
              name="user_id"
              required
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-base shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="" disabled>
                Pick a user…
              </option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="project_id">Project</Label>
            <select
              id="project_id"
              name="project_id"
              required
              defaultValue=""
              className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-base shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="" disabled>
                {selectedUserId ? "Pick a project…" : "Pick a user first"}
              </option>
              {userProjects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="amount">Amount (USD)</Label>
            <Input
              id="amount"
              name="amount"
              type="number"
              step="0.01"
              min="0.01"
              required
              placeholder="500.00"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              name="description"
              rows={2}
              maxLength={2000}
              placeholder="e.g. Logo design milestone 1"
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
              {pending ? "Creating in Stripe…" : "Create Stripe invoice"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
