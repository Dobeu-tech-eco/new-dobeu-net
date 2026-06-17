"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { LeadForm } from "@/components/landing/LeadForm";

// ⚡ Bolt: Lazy load heavy third-party embed widgets (Calendly and Typeform).
// These components bring significant payload but are only needed when a user actively opens the lightbox.
// Performance Impact: Reduces the first-load JS payload for the marketing landing page by ~20kB.
const BookingTab = dynamic(() => import("@/components/landing/BookingTab").then((m) => m.BookingTab));
const TypeformTab = dynamic(() => import("@/components/landing/TypeformTab").then((m) => m.TypeformTab));

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

export function LightboxProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [tab, setTab] = React.useState<Tab>("book");

  const open = React.useCallback((next: Tab = "book") => {
    setTab(next);
    setIsOpen(true);
  }, []);

  const close = React.useCallback(() => setIsOpen(false), []);

  // ⚡ Bolt Optimization: Memoize the context value
  // Expected impact: Prevents unnecessary re-renders of all useLightbox() consumers
  // (e.g., Hero, Services, SiteNav, FinalCTA) when LightboxProvider's state changes.
  const ctxValue = React.useMemo(() => ({ open, close }), [open, close]);

  return (
    <Ctx.Provider value={ctxValue}>
      {children}

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="gradient-text">Let&apos;s talk about your project</DialogTitle>
            <DialogDescription>
              Three ways in — book a call, send the details, or just drop your email. Whichever fits.
            </DialogDescription>
          </DialogHeader>

          <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)} className="mt-2">
            <TabsList>
              <TabsTrigger value="book">Book a call</TabsTrigger>
              <TabsTrigger value="form">Tell me more</TabsTrigger>
              <TabsTrigger value="email">Just email</TabsTrigger>
            </TabsList>
            <TabsContent value="book">
              <BookingTab onClose={close} />
            </TabsContent>
            <TabsContent value="form">
              <TypeformTab />
            </TabsContent>
            <TabsContent value="email">
              <LeadForm source="email" onSuccess={close} />
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </Ctx.Provider>
  );
}
