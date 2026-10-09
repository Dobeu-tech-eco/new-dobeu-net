"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { HERO_COPY } from "@/lib/jeremy-data";

const LeadForm = dynamic(
  () => import("@/components/landing/LeadForm").then((m) => m.LeadForm),
  { loading: () => <p className="text-sm text-muted-foreground py-4">Loading form…</p> }
);

const BookingTab = dynamic(
  () => import("@/components/landing/BookingTab").then((m) => m.BookingTab),
  { ssr: false, loading: () => <p className="text-sm text-muted-foreground py-4">Loading scheduler…</p> }
);

type Tab = "book" | "form" | "email";

interface LightboxCtx {
  open: (tab?: Tab) => void;
  close: () => void;
}

const Ctx = React.createContext<LightboxCtx | null>(null);

export function useLightbox(): LightboxCtx {
  const ctx = React.useContext(Ctx);
  if (!ctx) throw new Error("useLightbox must be used inside <LightboxProvider>");
  return ctx;
}

const COPY: Record<Tab, { title: string; description: string }> = {
  book: {
    title: "Book a call",
    description: "Thirty minutes. I come back with a price band.",
  },
  form: {
    title: "Send the job",
    description: HERO_COPY.estimateHint,
  },
  email: {
    title: "Send a note",
    description: "Email is enough. I reply with a price band if the job is a fit.",
  },
};

function DialogBody({ tab, onClose }: { tab: Tab; onClose: () => void }) {
  switch (tab) {
    case "book":
      return <BookingTab onClose={onClose} />;
    case "form":
      return <LeadForm source="form" onSuccess={onClose} />;
    case "email":
      return <LeadForm source="email" onSuccess={onClose} />;
    default: {
      const unreachable: never = tab;
      return unreachable;
    }
  }
}

export function LightboxProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [tab, setTab] = React.useState<Tab>("book");

  const open = React.useCallback((next: Tab = "book") => {
    setTab(next);
    setIsOpen(true);
  }, []);

  const close = React.useCallback(() => setIsOpen(false), []);

  // ⚡ Bolt: Memoize context value to prevent unnecessary re-renders of consuming components
  // when internal state (like isOpen or tab) changes.
  const value = React.useMemo(() => ({ open, close }), [open, close]);
  const copy = COPY[tab];

  return (
    <Ctx.Provider value={value}>
      {children}

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-2xl max-h-[92dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{copy.title}</DialogTitle>
            <DialogDescription>{copy.description}</DialogDescription>
          </DialogHeader>

          <DialogBody tab={tab} onClose={close} />
        </DialogContent>
      </Dialog>
    </Ctx.Provider>
  );
}
