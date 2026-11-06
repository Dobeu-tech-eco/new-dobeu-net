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
    "https://cdn.amplitude.com"
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
    "https://*.amplitude.com"
  ],
  img: ["'self'", "data:", "blob:", "https:"],
  font: [
    "'self'",
    "https://fonts.gstatic.com",
    "data:"
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
    "https://*.calendly.com"
  ]
};

type HeaderEnv = {
  NODE_ENV?: string;
  NEXT_PUBLIC_VERCEL_SUPABASE_URL?: string;
  VERCEL_SUPABASE_URL?: string;
};

// `pnpm dev` talks to a local Supabase stack (http://127.0.0.1:54321), which
// the browser CSP would otherwise block. Development only; production never
// gets these sources.
export function localSupabaseConnectSources(env: HeaderEnv): string[] {
  if (env.NODE_ENV !== "development") return [];
  const raw = env.NEXT_PUBLIC_VERCEL_SUPABASE_URL || env.VERCEL_SUPABASE_URL;
  if (!raw) return [];
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return [];
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return [];
  if (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) return [];
  const wsProtocol = url.protocol === "https:" ? "wss:" : "ws:";
  return [url.origin, `${wsProtocol}//${url.host}`];
}

export function buildSecurityHeaders(env: HeaderEnv): { key: string; value: string }[] {
  const isProduction = env.NODE_ENV === "production";
  const connect = [...csp.connect, ...localSupabaseConnectSources(env)];

  const ContentSecurityPolicy = [
    `default-src ${csp.default.join(" ")}`,
    `script-src ${csp.script.join(" ")}`,
    `connect-src ${connect.join(" ")}`,
    `img-src ${csp.img.join(" ")}`,
    `font-src ${csp.font.join(" ")}`,
    `style-src ${csp.style.join(" ")}`,
    `frame-src ${csp.frame.join(" ")}`,
    "media-src 'self'",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    ...(isProduction ? ["frame-ancestors 'none'", "upgrade-insecure-requests"] : [])
  ].join("; ");

  return [
    { key: "Content-Security-Policy", value: ContentSecurityPolicy },
    ...(isProduction
      ? [
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          { key: "X-Frame-Options", value: "DENY" }
        ]
      : []),
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "origin-when-cross-origin" },
    { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
    { key: "X-DNS-Prefetch-Control", value: "on" }
  ];
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Emit browser source maps so Datadog RUM stack traces deminify.
  // scripts/upload-sourcemaps.mjs uploads them to Datadog and then deletes
  // them from .next/static, so they are never served to the public.
  productionBrowserSourceMaps: true,
  // Skew Protection: tie the build ID to the Vercel deployment ID so the
  // client and server always agree on which deployment's assets to load.
  // Enabled via "skewProtection": true in vercel.json. Falls back to a
  // timestamp locally where VERCEL_DEPLOYMENT_ID is unset.
  generateBuildId: async () => process.env.VERCEL_DEPLOYMENT_ID ?? `local-${Date.now()}`,
  // Keep build-time type checks enabled. Next 16 runs lint separately via pnpm verify.
  typescript: {
    ignoreBuildErrors: false
  },
  experimental: {
    optimizePackageImports: ["lucide-react", "motion", "@radix-ui/react-dialog", "@radix-ui/react-tabs"]
  },
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      { protocol: "https", hostname: "**.supabase.co" },
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "media.licdn.com", pathname: "/dms/image/**" },
      { protocol: "https", hostname: "hebbkx1anhila5yf.public.blob.vercel-storage.com" },
      // Ported from the (now-removed) next.config.js — needed by /repos:
      { protocol: "https", hostname: "avatars.githubusercontent.com" },
      { protocol: "https", hostname: "github.com" }
    ]
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: buildSecurityHeaders(process.env)
      }
    ];
  },
  async redirects() {
    return [
      { source: "/home", destination: "/", permanent: true },
      { source: "/website-package", destination: "/", permanent: true },
      {
        source: "/services/ai-agents",
        destination: "/services/business-systems",
        permanent: true
      },
      ...["monty-ai", "unified-ai", "statminer", "dts-contract", "sales-funnel", "lastplate"].map((slug) => ({
        source: `/case-studies/${slug}`,
        destination: "/case-studies",
        permanent: true
      }))
    ];
  },
  async rewrites() {
    // Serve the Terms of Service at the canonical /tos URL (dobeu.net/tos)
    // in every environment (dev + preview + prod), independent of vercel.json.
    return [{ source: "/tos", destination: "/terms" }];
  }
};

export default nextConfig;
