"use client";

import * as React from "react";
import type { LightboxTab } from "@/components/landing/LightboxDialog";

type Tab = LightboxTab;
type DialogComponent = typeof import("@/components/landing/LightboxDialog").LightboxDialog;

// The dialog is closed on first paint, so its code (Radix Dialog + form/booking
// loaders) is fetched on first intent instead of during landing-page hydration.
let dialogModule: Promise<typeof import("@/components/landing/LightboxDialog")> | null = null;
function loadDialog() {
  if (!dialogModule) {
    dialogModule = import("@/components/landing/LightboxDialog").catch((error) => {
      dialogModule = null;
      throw error;
    });
  }
  return dialogModule;
}

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
  const [Dialog, setDialog] = React.useState<DialogComponent | null>(null);
  const [pending, setPending] = React.useState(false);
  const [tab, setTab] = React.useState<Tab>("book");
  const pendingRef = React.useRef(false);

  // Warm the chunk on the first sign of intent (pointer/touch/focus/key) so the
  // click that opens the dialog rarely waits. Nothing is fetched during load.
  React.useEffect(() => {
    const events = ["pointerover", "touchstart", "focusin", "keydown"] as const;
    const prefetch = () => {
      events.forEach((type) => window.removeEventListener(type, prefetch, true));
      loadDialog().catch(() => {});
    };
    events.forEach((type) => window.addEventListener(type, prefetch, { capture: true, passive: true }));
    return () => events.forEach((type) => window.removeEventListener(type, prefetch, true));
  }, []);

  // While the chunk is still loading, Escape cancels the pending open.
  React.useEffect(() => {
    if (!pending) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      pendingRef.current = false;
      setPending(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [pending]);

  const open = React.useCallback((next: Tab = "book") => {
    setTab(next);
    pendingRef.current = true;
    setPending(true);
    loadDialog().then(
      (mod) => {
        setDialog(() => mod.LightboxDialog);
        if (!pendingRef.current) return; // cancelled while loading
        pendingRef.current = false;
        setPending(false);
        setIsOpen(true);
      },
      () => {
        pendingRef.current = false;
        setPending(false);
      },
    );
  }, []);

  const close = React.useCallback(() => setIsOpen(false), []);

  // ⚡ Bolt: Memoize context value to prevent unnecessary re-renders of consuming components
  // when internal state (like isOpen or tab) changes.
  const value = React.useMemo(() => ({ open, close }), [open, close]);

  return (
    <Ctx.Provider value={value}>
      {children}

      {pending ? (
        <div role="status" className="sr-only">
          Opening dialog. Press Escape to cancel.
        </div>
      ) : null}
      {Dialog ? <Dialog open={isOpen} onOpenChange={setIsOpen} tab={tab} onClose={close} /> : null}
    </Ctx.Provider>
  );
}
