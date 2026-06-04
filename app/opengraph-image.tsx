import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Dobeu Tech Solutions — Ship the agent. Ship the app. Ship the brand.";

/**
 * OG card. Uses the official 3-circle mask SVG (uploads/dobeu-symbol.svg) inlined
 * via Satori. Indigo→amber gradient background stays on-brand.
 */
export default async function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          background:
            "linear-gradient(135deg, #6B5CE7 0%, #4A3FA8 55%, #F4A261 100%)",
          color: "#FFF8F0",
          fontFamily: "ui-sans-serif, system-ui, sans-serif"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "20px", marginBottom: "32px" }}>
          {/* Official Dobeu mark — three masked circles per Design System v2 */}
          <svg width="80" height="80" viewBox="0 0 500 500" xmlns="http://www.w3.org/2000/svg">
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
            <circle cx="322" cy="258" r="105" fill="#FFF8F0" mask="url(#og-cutC1A)" />
            <circle cx="175" cy="248" r="122" fill="#FFF8F0" mask="url(#og-cutA)" />
            <circle cx="315" cy="235" r="78" fill="#FFF8F0" mask="url(#og-cutC1)" />
          </svg>
          <span style={{ fontSize: 44, fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1 }}>
            <span>dobeu</span>
            <span style={{ fontWeight: 500, opacity: 0.75 }}>.net</span>
          </span>
        </div>
        <div
          style={{
            fontSize: 72,
            fontWeight: 800,
            lineHeight: 1.05,
            letterSpacing: "-0.025em",
            display: "flex",
            flexDirection: "column"
          }}
        >
          <span>Ship the agent.</span>
          <span>Ship the app.</span>
          <span>Ship the brand.</span>
        </div>
        <div style={{ fontSize: 24, marginTop: 40, opacity: 0.9 }}>
          One operator. Modern stack. Production-grade.
        </div>
      </div>
    ),
    { ...size }
  );
}
