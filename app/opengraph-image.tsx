import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Dobeu Tech Solutions — Custom software, AI agents, and design systems.";

/**
 * OG image — v3 design system.
 * Void dark canvas (#111120), Deep Violet mark, Coral Amber accent rule.
 * No gradient. Clean editorial layout: mark + wordmark top-left,
 * headline mid-left, descriptor bottom, amber rule separating the two columns.
 */
export default async function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: "#111120",
          color: "#FAFAFA",
          fontFamily: "ui-sans-serif, system-ui, -apple-system, sans-serif",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Subtle glow — top-left violet */}
        <div
          style={{
            position: "absolute",
            top: -200,
            left: -200,
            width: 700,
            height: 700,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(91,79,217,0.18) 0%, transparent 70%)",
          }}
        />
        {/* Subtle glow — bottom-right amber */}
        <div
          style={{
            position: "absolute",
            bottom: -150,
            right: -100,
            width: 500,
            height: 500,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(245,149,85,0.12) 0%, transparent 70%)",
          }}
        />

        {/* Left column — main content */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: "72px 64px 72px 72px",
            position: "relative",
            zIndex: 1,
          }}
        >
          {/* Wordmark row */}
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            {/* Dobeu mark — three masked circles */}
            <svg width="56" height="56" viewBox="0 0 500 500" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <mask id="og-cutA" maskUnits="userSpaceOnUse" x="0" y="0" width="500" height="500">
                  <rect width="500" height="500" fill="#fff" />
                  <circle cx="315" cy="235" r="78" fill="#000" />
                </mask>
                <mask id="og-cutC1" maskUnits="userSpaceOnUse" x="0" y="0" width="500" height="500">
                  <rect width="500" height="500" fill="#fff" />
                  <circle cx="175" cy="248" r="122" fill="#000" />
                </mask>
                <mask id="og-cutC1A" maskUnits="userSpaceOnUse" x="0" y="0" width="500" height="500">
                  <rect width="500" height="500" fill="#fff" />
                  <circle cx="175" cy="248" r="122" fill="#000" />
                  <circle cx="315" cy="235" r="78" fill="#000" />
                </mask>
              </defs>
              <circle cx="322" cy="258" r="105" fill="#4A42A0" mask="url(#og-cutC1A)" />
              <circle cx="175" cy="248" r="122" fill="#5B4FD9" mask="url(#og-cutA)" />
              <circle cx="315" cy="235" r="78" fill="#F59555" mask="url(#og-cutC1)" />
            </svg>
            <span
              style={{
                fontSize: 32,
                fontWeight: 800,
                letterSpacing: "-0.02em",
                lineHeight: 1,
                color: "#FAFAFA",
              }}
            >
              dobeu.net
            </span>
          </div>

          {/* Headline */}
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {/* Amber rule */}
            <div
              style={{
                width: 56,
                height: 4,
                borderRadius: 2,
                background: "#F59555",
                marginBottom: 28,
              }}
            />
            <div
              style={{
                fontSize: 68,
                fontWeight: 800,
                letterSpacing: "-0.03em",
                lineHeight: 1.05,
                color: "#FAFAFA",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <span>Ship the agent.</span>
              <span>Ship the app.</span>
              <span style={{ color: "#F59555" }}>Ship the brand.</span>
            </div>
          </div>

          {/* Descriptor */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ fontSize: 20, color: "#9A9AB0", letterSpacing: "-0.01em" }}>
              Custom software · AI agents · Design systems
            </span>
            <span style={{ fontSize: 16, color: "#4A4A68" }}>
              One operator. Production-grade. New York, NY.
            </span>
          </div>
        </div>

        {/* Right column — decorative grid of service labels */}
        <div
          style={{
            width: 340,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            padding: "72px 56px 72px 0",
            gap: 16,
            position: "relative",
            zIndex: 1,
          }}
        >
          {[
            "Next.js & React",
            "AI Agent Eng.",
            "TypeScript",
            "Design Systems",
            "Growth Eng.",
            "Supabase / Postgres",
          ].map((label) => (
            <div
              key={label}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 16px",
                borderRadius: 10,
                background: "rgba(91,79,217,0.10)",
                border: "1px solid rgba(91,79,217,0.22)",
                color: "#BEBEF0",
                fontSize: 15,
                fontWeight: 500,
                letterSpacing: "-0.01em",
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: "#5B4FD9",
                  flexShrink: 0,
                }}
              />
              {label}
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size }
  );
}
