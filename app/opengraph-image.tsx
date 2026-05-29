import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt =
  "Dobeu Tech Solutions — Ship the agent. Ship the app. Ship the brand.";

export default async function OGImage() {
  return new ImageResponse(
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
        color: "#FAFAFC",
        fontFamily: "ui-sans-serif, system-ui, sans-serif",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "16px",
          marginBottom: "32px",
        }}
      >
        <svg
          width="64"
          height="64"
          viewBox="0 0 64 64"
          xmlns="http://www.w3.org/2000/svg"
        >
          <circle cx="24" cy="32" r="18" fill="#4A3FA8" />
          <circle cx="40" cy="32" r="18" fill="#6B5CE7" opacity="0.9" />
          <path
            d="M28 17 a18 18 0 0 1 0 30 a14 14 0 0 0 0 -30 z"
            fill="#F4A261"
          />
        </svg>
        <span
          style={{ fontSize: 36, fontWeight: 700, letterSpacing: "-0.02em" }}
        >
          dobeu
        </span>
      </div>
      <div
        style={{
          fontSize: 72,
          fontWeight: 800,
          lineHeight: 1.05,
          letterSpacing: "-0.025em",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <span>Ship the agent.</span>
        <span>Ship the app.</span>
        <span>Ship the brand.</span>
      </div>
      <div style={{ fontSize: 24, marginTop: 40, opacity: 0.9 }}>
        One operator. Modern stack. Production-grade.
      </div>
    </div>,
    { ...size },
  );
}
