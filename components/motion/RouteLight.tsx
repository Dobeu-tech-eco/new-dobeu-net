"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

export function RouteLight() {
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

    // Animate arrival without intercepting links or delaying the router.
    main.classList.remove("page-light-in");
    void main.offsetWidth;
    main.classList.add("page-light-in");

    const clear = () => main.classList.remove("page-light-in");
    main.addEventListener("animationend", clear, { once: true });
    return () => {
      main.removeEventListener("animationend", clear);
      clear();
    };
  }, [pathname]);

  return null;
}
