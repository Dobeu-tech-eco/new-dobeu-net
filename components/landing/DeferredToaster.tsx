"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";

const Toaster = dynamic(() => import("sonner").then((m) => m.Toaster));

// Routes that can fire a toast without a prior user gesture (e.g. /login shows
// an error toast from a query param on mount). These keep the eager Toaster.
const EAGER_PREFIXES = ["/login", "/auth", "/portal", "/admin", "/company"];

function isEagerRoute(pathname: string | null) {
  return EAGER_PREFIXES.some((prefix) => pathname === prefix || pathname?.startsWith(`${prefix}/`));
}

/**
 * Sonner's <Toaster /> renders nothing until a toast fires. On marketing pages
 * every toast follows a user action (lead form submit), so the Toaster — and
 * its JS — is only mounted after the first pointer, touch, or key interaction.
 * That keeps it out of the critical load window. App routes mount it eagerly.
 */
export function DeferredToaster() {
  const pathname = usePathname();
  const eager = isEagerRoute(pathname);
  const [interacted, setInteracted] = React.useState(false);

  React.useEffect(() => {
    if (eager || interacted) return;
    const events = ["pointerdown", "keydown", "touchstart"] as const;
    const onInteract = () => setInteracted(true);
    events.forEach((type) => window.addEventListener(type, onInteract, { once: true, passive: true, capture: true }));
    return () => events.forEach((type) => window.removeEventListener(type, onInteract, { capture: true }));
  }, [eager, interacted]);

  // Once mounted, stay mounted: leaving an eager route (e.g. /login) must not
  // tear down a toast that is still on screen.
  const latched = React.useRef(false);
  if (eager || interacted) latched.current = true;

  return latched.current ? <Toaster position="bottom-right" theme="system" richColors closeButton /> : null;
}
