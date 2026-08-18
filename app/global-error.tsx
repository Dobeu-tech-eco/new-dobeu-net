"use client";

import { useEffect } from "react";
import { RefreshCw } from "lucide-react";

/** Catches errors in the root layout itself — must include its own html/body. */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[dobeu] global error:", error);
  }, [error]);

  return (
    <html lang="en" className="bg-[#111120]">
      <body className="min-h-screen flex items-center justify-center px-6 py-20 text-[#FAFAFA] font-sans">
        <div className="max-w-md w-full text-center space-y-7">
          {/* Inline mark — no external component since layout may be broken */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 500 500"
            className="h-12 w-12 mx-auto"
            role="img"
            aria-label="Dobeu mark"
          >
            <defs>
              <mask id="ge-cutA" maskUnits="userSpaceOnUse" x="0" y="0" width="500" height="500">
                <rect width="500" height="500" fill="#fff" />
                <circle cx="315" cy="235" r="78" fill="#000" />
              </mask>
              <mask id="ge-cutC1" maskUnits="userSpaceOnUse" x="0" y="0" width="500" height="500">
                <rect width="500" height="500" fill="#fff" />
                <circle cx="175" cy="248" r="122" fill="#000" />
              </mask>
              <mask id="ge-cutC1A" maskUnits="userSpaceOnUse" x="0" y="0" width="500" height="500">
                <rect width="500" height="500" fill="#fff" />
                <circle cx="175" cy="248" r="122" fill="#000" />
                <circle cx="315" cy="235" r="78" fill="#000" />
              </mask>
            </defs>
            <circle cx="322" cy="258" r="105" fill="#4A3FA8" mask="url(#ge-cutC1A)" />
            <circle cx="175" cy="248" r="122" fill="#6B5CE7" mask="url(#ge-cutA)" />
            <circle cx="315" cy="235" r="78" fill="#F4A261" mask="url(#ge-cutC1)" />
          </svg>

          <div className="space-y-2">
            <h1 style={{ fontSize: "1.5rem", fontWeight: 700, letterSpacing: "-0.02em" }}>
              Critical error
            </h1>
            <p style={{ fontSize: "0.875rem", color: "#9A9AB0", lineHeight: 1.6, maxWidth: "20rem", margin: "0 auto" }}>
              The application encountered a fatal error and could not recover. Please refresh the page.
            </p>
            {error.digest && (
              <p style={{ fontFamily: "monospace", fontSize: "0.75rem", color: "#4A4A68", marginTop: "0.25rem" }}>
                {error.digest}
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={reset}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.5rem",
              padding: "0.625rem 1.25rem",
              borderRadius: "999px",
              fontSize: "0.875rem",
              fontWeight: 600,
              background: "#F59555",
              color: "#111120",
              border: "none",
              cursor: "pointer",
            }}
          >
            <RefreshCw size={16} aria-hidden="true" />
            Reload page
          </button>
        </div>
      </body>
    </html>
  );
}
