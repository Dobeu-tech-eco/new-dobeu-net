"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { createWorkOrderForClient } from "@/lib/actions/work-orders";

interface ProjectOption {
  id: string;
  title: string;
  owner_user_id: string;
  company_id: string | null;
}

const selectClassName =
  "flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-base shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function NewWorkOrderForClientDialog({
  clients,
  companies,
  projects,
  disabled = false,
}: {
  clients: { id: string; label: string }[];
  companies: { id: string; name: string }[];
  projects: ProjectOption[];
  disabled?: boolean;
}) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const submittedRef = useRef(false);
  const pendingFocusRef = useRef(false);
  const [open, setOpen] = useState(false);
  const [clientId, setClientId] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [quoteFailedId, setQuoteFailedId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const availableProjects = clientId
    ? projects.filter(
        (project) =>
          project.owner_user_id === clientId ||
          (companyId && project.company_id === companyId),
      )
    : [];

  useEffect(() => {
    if (!open && !pending && pendingFocusRef.current) {
      triggerRef.current?.focus();
      pendingFocusRef.current = false;
    }
  }, [open, pending]);

  function changeOpen(nextOpen: boolean) {
    setOpen(nextOpen);
    if (nextOpen) {
      submittedRef.current = false;
      setClientId("");
      setCompanyId("");
      setProjectId("");
      setError(null);
      setQuoteFailedId(null);
    }
  }

  async function handleSubmit(formData: FormData) {
    if (submittedRef.current) return;
    submittedRef.current = true;
    setError(null);
    const quote = String(formData.get("quote_dollars") ?? "").trim();
    const payload = {
      client_user_id: clientId,
      company_id: companyId || null,
      project_id: projectId || null,
      service_type: String(formData.get("service_type") ?? "other"),
      title: String(formData.get("title") ?? ""),
      description: String(formData.get("description") ?? "") || null,
      priority: String(formData.get("priority") ?? "normal"),
      ...(quote
        ? { quoted_amount_cents: Math.round(Number(quote) * 100) }
        : {}),
    };
    startTransition(async () => {
      try {
        const result = await createWorkOrderForClient(payload);
        if (!result.ok) {
          submittedRef.current = false;
          setError(result.error);
          return;
        }
        if (result.data.quoteFailed) {
          setQuoteFailedId(result.data.id);
        } else {
          pendingFocusRef.current = true;
          setOpen(false);
        }
      } catch {
        submittedRef.current = false;
        setError("Unable to post work. Try again.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger asChild>
        <Button
          ref={triggerRef}
          disabled={disabled || clients.length === 0 || pending}
        >
          Post work
        </Button>
      </DialogTrigger>
      <DialogContent
        className="max-h-[90dvh] overflow-y-auto"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          const trigger = triggerRef.current;
          if (trigger && !trigger.disabled) {
            trigger.focus();
            pendingFocusRef.current = false;
          } else {
            // Trigger is still disabled (submit pending); the effect below
            // restores focus as soon as it re-enables.
            pendingFocusRef.current = true;
          }
        }}
      >
        <DialogHeader>
          <DialogTitle>Post work for a client</DialogTitle>
          <DialogDescription>
            The work appears in the client’s portal. Add a quote to notify them
            by email.
          </DialogDescription>
        </DialogHeader>
        {quoteFailedId ? (
          <div className="space-y-4">
            <p role="status" className="text-sm">
              Work order posted; the quote could not be saved — open the ticket
              to quote it
            </p>
            <Link
              href={`/admin/tickets/${quoteFailedId}`}
              className="text-sm underline"
            >
              Open ticket
            </Link>
            <DialogFooter>
              <Button type="button" onClick={() => setOpen(false)}>
                Done
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <form action={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="post_work_client">Client</Label>
              <select
                id="post_work_client"
                name="client_user_id"
                required
                value={clientId}
                onChange={(event) => {
                  setClientId(event.target.value);
                  setCompanyId("");
                  setProjectId("");
                }}
                className={selectClassName}
              >
                <option value="" disabled>
                  Pick a client…
                </option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="post_work_company">Company</Label>
                <select
                  id="post_work_company"
                  name="company_id"
                  value={companyId}
                  onChange={(event) => {
                    setCompanyId(event.target.value);
                    setProjectId("");
                  }}
                  className={selectClassName}
                >
                  <option value="">No company</option>
                  {companies.map((company) => (
                    <option key={company.id} value={company.id}>
                      {company.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="post_work_project">Project</Label>
                <select
                  id="post_work_project"
                  name="project_id"
                  value={projectId}
                  onChange={(event) => setProjectId(event.target.value)}
                  className={selectClassName}
                >
                  <option value="">No project</option>
                  {availableProjects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="post_work_service">Service type</Label>
              <select
                id="post_work_service"
                name="service_type"
                defaultValue="other"
                className={selectClassName}
              >
                <option value="logo">Logo</option>
                <option value="website_update">Website update</option>
                <option value="data_export">Data export</option>
                <option value="consulting">Business systems</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="post_work_title">Title</Label>
              <Input
                id="post_work_title"
                name="title"
                required
                minLength={2}
                maxLength={160}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="post_work_notes">Notes</Label>
              <Textarea
                id="post_work_notes"
                name="description"
                maxLength={8000}
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="post_work_priority">Priority</Label>
                <select
                  id="post_work_priority"
                  name="priority"
                  defaultValue="normal"
                  className={selectClassName}
                >
                  <option value="low">Low</option>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="post_work_quote">Quote (USD, optional)</Label>
                <Input
                  id="post_work_quote"
                  name="quote_dollars"
                  type="number"
                  min="0.01"
                  max="10000000"
                  step="0.01"
                />
              </div>
            </div>
            {error && (
              <p
                role="alert"
                className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
              >
                {error}
              </p>
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Posting…" : "Post work for client"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
