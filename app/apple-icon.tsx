import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#1A1A2E"
        }}
      >
        <svg width="140" height="140" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
          <circle cx="24" cy="32" r="18" fill="#4A3FA8" />
          <circle cx="40" cy="32" r="18" fill="#6B5CE7" opacity="0.9" />
          <path d="M28 17 a18 18 0 0 1 0 30 a14 14 0 0 0 0 -30 z" fill="#F4A261" />
        </svg>
      </div>
    ),
    { ...size }
  );
}
