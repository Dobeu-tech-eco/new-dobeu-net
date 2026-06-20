/** @type {import('next').NextConfig} */
const nextConfig = {
  // Skew Protection: use the Vercel deployment ID as the build ID so that
  // Next.js can detect version skew between client and server assets.
  // When VERCEL_DEPLOYMENT_ID is not set (local dev), falls back to a timestamp.
  generateBuildId: async () => {
    return process.env.VERCEL_DEPLOYMENT_ID ?? `local-${Date.now()}`;
  },

  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "media.licdn.com",
        pathname: "/dms/image/**",
      },
      {
        protocol: "https",
        hostname: "hebbkx1anhila5yf.public.blob.vercel-storage.com",
      },
    ],
  },

  // Ensure the Vercel skew-protection cookie is forwarded on every response
  // by opting all routes into dynamic rendering when the header is present.
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          // Tell the CDN to vary on the deployment cookie so stale HTML
          // from a previous deployment is not served after a new deploy.
          {
            key: "Vary",
            value: "Cookie",
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
