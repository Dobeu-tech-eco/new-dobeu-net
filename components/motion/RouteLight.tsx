"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { routeTransitionHref } from "@/lib/route-light";

const EXIT_MS = 160;

/**
 * Instrument light.
 * A page change dims and lifts `main` for a short exit, then the next page
 * arrives under a violet wash that settles into an offset shadow.
 * Scroll moves that same lamp. The live nav mark is outside `main`, so the
 * lockup does not travel with the light.
 */
export function RouteLight() {
  const router = useRouter();
  const pathname = usePathname();
  const firstPaint = useRef(true);

  useEffect(() => {
    if (firstPaint.current) {
      firstPaint.current = false;
      return;
    }
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const main = document.getElementById("main");
    if (!main) return;

    main.classList.remove("page-light-out");
    main.classList.remove("page-light-in");
    void main.offsetWidth;
    main.classList.add("page-light-in");

    const clear = () => main.classList.remove("page-light-in");
    main.addEventListener("animationend", clear, { once: true });
    return () => main.removeEventListener("animationend", clear);
  }, [pathname]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (event.button !== 0) return;
      const anchor = (event.target as Element | null)?.closest?.("a");
      if (!anchor) return;

      const next = routeTransitionHref({
        href: anchor.getAttribute("href"),
        currentHref: window.location.href,
        target: anchor.getAttribute("target"),
        download: anchor.hasAttribute("download"),
        modified: event.metaKey || event.ctrlKey || event.shiftKey || event.altKey,
        defaultPrevented: event.defaultPrevented,
        reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
        viewTransitions: true,
      });
      if (!next) return;

      // preventDefault is enough. Next's Link bails when the event is already
      // cancelled, after the caller's onClick (menu close, CTA tracking) runs.
      event.preventDefault();

      const main = document.getElementById("main");
      if (!main) {
        router.push(next);
        return;
      }

      main.classList.remove("page-light-in");
      main.classList.add("page-light-out");
      window.setTimeout(() => {
        main.classList.remove("page-light-out");
        router.push(next);
      }, EXIT_MS);
    };

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [router]);

  return <div aria-hidden="true" className="scroll-lamp" />;
}
