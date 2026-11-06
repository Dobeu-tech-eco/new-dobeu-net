"use client";

import { useRef, useState, useTransition, useMemo } from "react";
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
import { adminErrorMessage } from "@/lib/admin-status";
import { linkFailedNotice } from "@/components/admin/AdminInvoiceNotices";

interface UserOption {
  id: string;
  label: string;
}

interface ProjectOption {
  id: string;
  label: string;
  ownerUserId: string;
}

interface WorkOrderOption {
  id: string;
  label: string;
  clientUserId: string;
}

type LockKind = "stripe" | "link";

function amountCents(value: string): number | null {
  const dollars = Number(value);
  return value.trim() !== "" && Number.isFinite(dollars) && dollars > 0
    ? Math.round(dollars * 100)
    : null;
}

const selectClassName =
  "flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-base shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function NewInvoiceDialog({
  users,
  projects,
  workOrders
}: {
  users: UserOption[];
  projects: ProjectOption[];
  workOrders: WorkOrderOption[];
}) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [selectedWorkOrderId, setSelectedWorkOrderId] = useState("");
  const [amount, setAmount] = useState("");
  // Locks survive close/reopen for the page session (UX only; the server guard
  // in createInvoice is authoritative). "stripe": a "Stripe error:" came back,
  // so the local row already exists. "link": the invoice exists but could not
  // be linked to its work order. Keys are `wo:<id>` and `amt:<client>:<cents>`.
  const [locks, setLocks] = useState<ReadonlyMap<string, LockKind>>(new Map());
  // Id of the invoice that failed to link, by `wo:<id>` key, for the notice.
  const [linkedInvoiceIds, setLinkedInvoiceIds] = useState<
    ReadonlyMap<string, string>
  >(new Map());

  // No recipient, no options: picking a project or work order first would be
  // silently wiped as soon as the recipient changes.
  const userProjects = useMemo(
    () => (selectedUserId ? projects.filter((p) => p.ownerUserId === selectedUserId) : []),
    [projects, selectedUserId]
  );
  const userWorkOrders = useMemo(
    () => (selectedUserId ? workOrders.filter((w) => w.clientUserId === selectedUserId) : []),
    [workOrders, selectedUserId]
  );

  const cents = amountCents(amount);
  const lock: LockKind | null =
    (selectedWorkOrderId ? locks.get(`wo:${selectedWorkOrderId}`) : undefined) ??
    (selectedUserId && cents !== null
      ? locks.get(`amt:${selectedUserId}:${cents}`)
      : undefined) ??
    null;
  const stripeFailed = lock === "stripe";
  const linkFailed = lock === "link";
  const linkedInvoiceId = selectedWorkOrderId
    ? linkedInvoiceIds.get(`wo:${selectedWorkOrderId}`)
    : undefined;

  function addLocks(kind: LockKind, keys: string[]) {
    setLocks((prev) => {
      const next = new Map(prev);
      for (const key of keys) next.set(key, kind);
      return next;
    });
  }

  function changeOpen(nextOpen: boolean) {
    setOpen(nextOpen);
    if (nextOpen) {
      setSelectedUserId("");
      setSelectedProjectId("");
      setSelectedWorkOrderId("");
      setAmount("");
      setError(null);
    }
  }

  function handleClientChange(value: string) {
    setSelectedUserId(value);
    setSelectedProjectId("");
    setSelectedWorkOrderId("");
  }

  async function handleSubmit(formData: FormData) {
    if (lock) return;
    setError(null);
    const dollars = Number(formData.get("amount") ?? 0);
    const description = (String(formData.get("description") ?? "").trim() || null) as string | null;
    if (!selectedUserId) {
      setError("Pick a recipient.");
      return;
    }
    if (!Number.isFinite(dollars) || dollars <= 0) {
      setError("Amount must be a positive dollar value.");
      return;
    }
    const submittedCents = Math.round(dollars * 100);
    const submittedUserId = selectedUserId;
    const submittedWorkOrderId = selectedWorkOrderId;
    const payload = {
      user_id: selectedUserId,
      amount_cents: submittedCents,
      description,
      ...(selectedProjectId ? { project_id: selectedProjectId } : {}),
      ...(selectedWorkOrderId ? { work_order_id: selectedWorkOrderId } : {}),
    };
    startTransition(async () => {
      try {
        const result = await createInvoice(payload);
        if (!result.ok) {
          if (result.error.startsWith("Stripe error:")) {
            // The local row was already inserted: lock the form so a retry
            // cannot duplicate the customer invoice.
            addLocks("stripe", [
              `amt:${submittedUserId}:${submittedCents}`,
              ...(submittedWorkOrderId ? [`wo:${submittedWorkOrderId}`] : []),
            ]);
          } else {
            setError(
              result.error === "company_suspended" ||
                result.error === "company_check_failed"
                ? adminErrorMessage(result.error)
                : result.error
            );
          }
          return;
        }
        if (result.data.linkFailed) {
          if (submittedWorkOrderId) {
            addLocks("link", [`wo:${submittedWorkOrderId}`]);
            setLinkedInvoiceIds((prev) =>
              new Map(prev).set(`wo:${submittedWorkOrderId}`, result.data.id)
            );
          }
          return;
        }
        setOpen(false);
      } catch {
        setError("Unable to create invoice. Try again.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger asChild>
        <Button
          ref={triggerRef}
          disabled={users.length === 0}
        >
          {users.length === 0 ? "No users yet" : "New invoice"}
        </Button>
      </DialogTrigger>
      <DialogContent
        className="max-h-[90dvh] overflow-y-auto"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          triggerRef.current?.focus();
        }}
      >
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
              value={selectedUserId}
              onChange={(e) => handleClientChange(e.target.value)}
              className={selectClassName}
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
            <Label htmlFor="project_id">Project (optional)</Label>
            <select
              id="project_id"
              name="project_id"
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              disabled={!selectedUserId}
              className={selectClassName}
            >
              <option value="">No project</option>
              {userProjects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="work_order_id">Work order (optional)</Label>
            <select
              id="work_order_id"
              name="work_order_id"
              value={selectedWorkOrderId}
              onChange={(e) => setSelectedWorkOrderId(e.target.value)}
              disabled={!selectedUserId}
              className={selectClassName}
            >
              <option value="">No work order</option>
              {userWorkOrders.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.label}
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
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
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
            <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              {error}
            </p>
          )}

          {stripeFailed && (
            <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              Invoice saved, but Stripe failed. It is listed with no Stripe link. Do not submit again; fix the Stripe configuration and use the Void unsent button on its row in /admin/invoices if it should not stand (it has no Stripe invoice).
            </p>
          )}

          <p
            role="status"
            className={
              linkFailed
                ? "rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-sm"
                : undefined
            }
          >
            {linkFailed ? linkFailedNotice(linkedInvoiceId ?? null) : null}
          </p>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              {linkFailed ? "Done" : "Cancel"}
            </Button>
            <Button type="submit" disabled={pending || stripeFailed || linkFailed}>
              {pending ? "Creating in Stripe…" : "Create Stripe invoice"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
