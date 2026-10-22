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
 * arrives still opens the menu, but only if the user is still on the control
 * (focused or hovered) when it arrives; otherwise the swap is silent.
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
  const wantOpen = React.useRef(false);
  const pointerInside = React.useRef(false);
  const handoff = React.useRef({ focus: false, open: false });

  const arm = React.useCallback(() => setArmed(true), []);

  // Runs in the real toggle's layout effect, while the placeholder is still in
  // the DOM: decide what the user still wants before the swap happens.
  const onReady = React.useCallback(() => {
    const focused = document.activeElement === placeholderRef.current;
    handoff.current = { focus: focused, open: wantOpen.current && (focused || pointerInside.current) };
    wantOpen.current = false;
    setReady(true);
  }, []);

  // Layout effect: the placeholder unmounts in the same commit, so focus must
  // move to the real trigger before paint to avoid a focus-loss frame.
  React.useLayoutEffect(() => {
    if (!ready) return;
    const { focus, open } = handoff.current;
    handoff.current = { focus: false, open: false };
    if (!focus && !open) return;
    const trigger = wrapperRef.current?.querySelector<HTMLButtonElement>("button[data-state]");
    if (!trigger) return;
    if (focus) trigger.focus();
    if (open) {
      // Radix opens its trigger on Enter; only reached while the user is still
      // on the control, so it cannot steal focus from elsewhere.
      trigger.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
    }
  }, [ready]);

  return (
    <span ref={wrapperRef} className="contents">
      {armed ? <RealThemeToggle onReady={onReady} /> : null}
      {ready ? null : (
        <TriggerFace
          ref={placeholderRef}
          onPointerEnter={() => {
            pointerInside.current = true;
            arm();
          }}
          onPointerLeave={() => {
            pointerInside.current = false;
          }}
          onFocus={arm}
          // Activation is recorded on press, not click, so a swap between
          // mousedown and mouseup cannot lose it. Pressing also focuses the
          // button (Safari/iOS do not), so "still focused" is a reliable test.
          onPointerDown={(event) => {
            if (event.button > 0) return;
            wantOpen.current = true;
            placeholderRef.current?.focus();
            arm();
          }}
          onKeyDown={(event) => {
            if (event.key !== "Enter" && event.key !== " ") return;
            wantOpen.current = true;
            arm();
          }}
        />
      )}
    </span>
  );
}
