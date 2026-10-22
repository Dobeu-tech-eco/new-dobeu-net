"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Lightweight stand-in for <ThemeToggle /> in the marketing nav.
 *
 * The real toggle pulls in the Radix DropdownMenu stack (popper, focus scope,
 * dismissable layer — ~100KB of JS) that is only needed once someone reaches
 * for the menu. Until then this renders the exact same trigger markup. The
 * real toggle is mounted on first hover, focus, or press; the placeholder stays
 * in place until the real trigger commits (same frame, via layout effect), so
 * there is no flash or layout shift. A press that lands before the chunk
 * arrives is replayed as an Enter keydown so the menu still opens.
 */

const TriggerFace = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(
  function TriggerFace(props, ref) {
    return (
      <Button ref={ref} type="button" variant="ghost" size="icon" aria-label="Toggle theme" aria-haspopup="menu" aria-expanded={false} {...props}>
        <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
        <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
        <span className="sr-only">Toggle theme</span>
      </Button>
    );
  },
);

const loadThemeToggle = () => import("@/components/theme-toggle");

const RealThemeToggle = dynamic(
  () =>
    loadThemeToggle().then(({ ThemeToggle }) => {
      function LoadedThemeToggle({ onReady }: { onReady: () => void }) {
        React.useLayoutEffect(() => {
          onReady();
        }, [onReady]);
        return <ThemeToggle />;
      }
      return LoadedThemeToggle;
    }),
  { ssr: false, loading: () => null },
);

export function NavThemeToggle() {
  const [armed, setArmed] = React.useState(false);
  const [ready, setReady] = React.useState(false);
  const placeholderRef = React.useRef<HTMLButtonElement>(null);
  const wrapperRef = React.useRef<HTMLSpanElement>(null);
  const pendingOpen = React.useRef(false);
  const hadFocus = React.useRef(false);

  const arm = React.useCallback(() => setArmed(true), []);

  const onReady = React.useCallback(() => {
    hadFocus.current = document.activeElement === placeholderRef.current;
    setReady(true);
  }, []);

  React.useEffect(() => {
    if (!ready) return;
    const trigger = wrapperRef.current?.querySelector<HTMLButtonElement>("button[data-state]");
    if (!trigger) return;
    if (hadFocus.current || pendingOpen.current) trigger.focus();
    if (pendingOpen.current) {
      trigger.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
    }
    pendingOpen.current = false;
    hadFocus.current = false;
  }, [ready]);

  return (
    <span ref={wrapperRef} className="contents">
      {armed ? <RealThemeToggle onReady={onReady} /> : null}
      {ready ? null : (
        <TriggerFace
          ref={placeholderRef}
          onPointerEnter={arm}
          onFocus={arm}
          onClick={() => {
            pendingOpen.current = true;
            arm();
          }}
        />
      )}
    </span>
  );
}
