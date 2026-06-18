"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ThemeProviderProps } from "next-themes";

/**
 * next-themes wrapper. Supports Light / Dark / System with persistence.
 * Default theme = "light" per Design System v2 spec for dobeu.net (light-mode default
 * brand surface). Toggle + dark mode remain fully functional via `enableSystem`.
 */
export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="light"
      enableSystem
      disableTransitionOnChange
      {...props}
    >
      {children}
    </NextThemesProvider>
  );
}
