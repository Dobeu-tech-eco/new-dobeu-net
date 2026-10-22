"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import type { LightboxTab } from "@/components/landing/LightboxDialog";

// The dialog is closed on first paint, so its code (Radix Dialog + form/booking
// loaders) is fetched on first open instead of during landing-page hydration.
const LightboxDialog = dynamic(
  () => import("@/components/landing/LightboxDialog").then((m) => m.LightboxDialog),
  { ssr: false }
);

type Tab = LightboxTab;

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
  const [hasOpened, setHasOpened] = React.useState(false);
  const [tab, setTab] = React.useState<Tab>("book");

  const open = React.useCallback((next: Tab = "book") => {
    setTab(next);
    setHasOpened(true);
    setIsOpen(true);
  }, []);

  const close = React.useCallback(() => setIsOpen(false), []);

  // ⚡ Bolt: Memoize context value to prevent unnecessary re-renders of consuming components
  // when internal state (like isOpen or tab) changes.
  const value = React.useMemo(() => ({ open, close }), [open, close]);

  return (
    <Ctx.Provider value={value}>
      {children}

      {hasOpened ? (
        <LightboxDialog open={isOpen} onOpenChange={setIsOpen} tab={tab} onClose={close} />
      ) : null}
    </Ctx.Provider>
  );
}
