"use client";

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

const TypeformTab = dynamic(
  () => import("@/components/landing/TypeformTab").then((m) => m.TypeformTab),
  { ssr: false, loading: () => <p className="py-4 text-sm text-muted-foreground">Loading project intake…</p> }
);

export type LightboxTab = "book" | "form" | "email" | "intake";

const COPY: Record<LightboxTab, { title: string; description: string }> = {
  intake: {
    title: "Tell us about your operation",
    description:
      "This project intake goes to admin review. It does not generate an automatic quote or customer email.",
  },
  book: {
    title: "Meet Jeremy",
    description: "Let's talk about what you're building and where our interests meet.",
  },
  form: {
    title: "Explore a collaboration",
    description: HERO_COPY.estimateHint,
  },
  email: {
    title: "Send a note",
    description: "Tell me what's on your mind. I read every note myself.",
  },
};

function DialogBody({ tab, onClose }: { tab: LightboxTab; onClose: () => void }) {
  switch (tab) {
    case "intake":
      return <TypeformTab />;
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

/**
 * The lightbox dialog itself. Split out of LightboxProvider so the Radix
 * Dialog stack (focus scope, scroll lock, aria-hidden) is only downloaded
 * once a visitor actually opens the lightbox — it is never visible on first
 * paint, so it should not cost hydration time on the landing page.
 */
export function LightboxDialog({
  open,
  onOpenChange,
  tab,
  onClose,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tab: LightboxTab;
  onClose: () => void;
}) {
  const copy = COPY[tab];
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[92dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>{copy.description}</DialogDescription>
        </DialogHeader>

        <DialogBody tab={tab} onClose={onClose} />
      </DialogContent>
    </Dialog>
  );
}
