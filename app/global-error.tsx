"use client";

// Root-layout error boundary. Must render its own <html>/<body> because the
// root layout itself failed. Keep dependencies minimal — no app CSS is
// guaranteed to have loaded here, so styles are inline.
export default function GlobalError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "1rem",
          fontFamily: "system-ui, sans-serif",
          background: "#ffffff",
          color: "#18181b",
          textAlign: "center",
          padding: "0 1.5rem"
        }}
      >
        <p style={{ fontFamily: "monospace", letterSpacing: "0.2em", color: "#71717a" }}>500</p>
        <h1 style={{ fontSize: "1.75rem", margin: 0 }}>Something went wrong</h1>
        <p style={{ maxWidth: "28rem", color: "#71717a" }}>
          A critical error occurred while loading the page.
          {error.digest ? (
            <span style={{ display: "block", marginTop: "0.5rem", fontFamily: "monospace", fontSize: "0.75rem" }}>
              Ref: {error.digest}
            </span>
          ) : null}
        </p>
        <button
          onClick={reset}
          style={{
            padding: "0.5rem 1.25rem",
            borderRadius: "0.5rem",
            border: "1px solid #d4d4d8",
            background: "#4f46e5",
            color: "#ffffff",
            cursor: "pointer",
            fontSize: "0.9rem"
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
