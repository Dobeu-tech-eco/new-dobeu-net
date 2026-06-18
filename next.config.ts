import type { NextConfig } from "next";

// Build CSP from arrays so each line stays short enough for git diff to
// recognize the file as text (git treats lines >~700 chars as binary).
const csp = {
  default: ["'self'"],
  script: [
    "'self'",
    "'unsafe-inline'",
    "'unsafe-eval'",
    "https://*.posthog.com",
    "https://app.posthog.com",
    "https://cdn.mxpnl.com",
    "https://*.googletagmanager.com",
    "https://www.google-analytics.com",
    "https://js.stripe.com",
    "https://embed.typeform.com",
    "https://*.apollo.io",
    "https://assets.calendly.com",
    "https://www.datadoghq-browser-agent.com",
    "https://va.vercel-scripts.com",
    "https://widget.intercom.io",
    "https://js.intercomcdn.com"
  ],
  connect: [
    "'self'",
    "https://*.supabase.co",
    "wss://*.supabase.co",
    "https://*.posthog.com",
    "https://app.posthog.com",
    "https://api.mixpanel.com",
    "https://api-js.mixpanel.com",
    "https://*.mixpanel.com",
    "https://*.google-analytics.com",
    "https://*.analytics.google.com",
    "https://api.stripe.com",
    "https://m.stripe.network",
    "https://api.apollo.io",
    "https://*.typeform.com",
    "https://api.calendly.com",
    "https://calendly.com",
    "https://browser-intake-datadoghq.com",
    "https://*.browser-intake-datadoghq.com",
    "https://browser-intake-us5-datadoghq.com",
    "https://*.browser-intake-us5-datadoghq.com",
    "https://vitals.vercel-insights.com",
    "https://vercel.live",
    "https://api.intercom.io",
    "https://api-iam.intercom.io",
    "https://api-iam.eu.intercom.io",
    "https://api-ping.intercom.io",
    "https://nexus-websocket-a.intercom.io",
    "https://nexus-websocket-b.intercom.io",
    "https://nexus-europe-websocket.intercom.io",
    "wss://nexus-websocket-a.intercom.io",
    "wss://nexus-websocket-b.intercom.io",
    "https://uploads.intercomcdn.com",
    "https://uploads.intercomusercontent.com"
  ],
  img: ["'self'", "data:", "blob:", "https:"],
  font: [
    "'self'",
    "https://fonts.gstatic.com",
    "data:",
    "https://js.intercomcdn.com",
    "https://fonts.intercomcdn.com"
  ],
  style: [
    "'self'",
    "'unsafe-inline'",
    "https://fonts.googleapis.com",
    "https://embed.typeform.com",
    "https://assets.calendly.com"
  ],
  // frame-src: typeform's embed iframe is hosted on form.typeform.com (not
  // embed.typeform.com — that's just the SDK loader). Wildcard covers both.
  frame: [
    "'self'",
    "https://js.stripe.com",
    "https://hooks.stripe.com",
    "https://*.typeform.com",
    "https://*.apollo.io",
    "https://calendly.com",
    "https://*.calendly.com",
    "https://*.intercom.io",
    "https://*.intercom.com",
    "https://*.intercomcdn.com"
  ]
};

const ContentSecurityPolicy = [
  `default-src ${csp.default.join(" ")}`,
  `script-src ${csp.script.join(" ")}`,
  `connect-src ${csp.connect.join(" ")}`,
  `img-src ${csp.img.join(" ")}`,
  `font-src ${csp.font.join(" ")}`,
  `style-src ${csp.style.join(" ")}`,
  `frame-src ${csp.frame.join(" ")}`,
  "media-src 'self'",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests"
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: ContentSecurityPolicy },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "X-DNS-Prefetch-Control", value: "on" }
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Build is a real verifier again: type-check + lint both pass, so failures
  // here should block the build rather than ship silently. (Was temporarily
  // disabled during Phase-1 launch.)
  typescript: {
    ignoreBuildErrors: false
  },
  eslint: {
    ignoreDuringBuilds: false
  },
  experimental: {
    optimizePackageImports: ["lucide-react", "motion", "@radix-ui/react-dialog", "@radix-ui/react-tabs"]
  },
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      { protocol: "https", hostname: "**.supabase.co" },
      { protocol: "https", hostname: "images.unsplash.com" }
    ]
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders
      }
    ];
  },
  async redirects() {
    return [{ source: "/home", destination: "/", permanent: true }];
  }
};

export default nextConfig;
