/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      // Jeremy's LinkedIn headshot (fallback for external URL variant)
      {
        protocol: "https",
        hostname: "media.licdn.com",
      },
      // GitHub user avatars — used by /repos
      {
        protocol: "https",
        hostname: "avatars.githubusercontent.com",
      },
      {
        protocol: "https",
        hostname: "github.com",
      },
    ],
  },
  // Tie Next.js asset hashing to the Vercel deployment ID so Skew Protection
  // can detect stale clients and reload them automatically.
  generateBuildId: async () => {
    return process.env.VERCEL_DEPLOYMENT_ID ?? `local-${Date.now()}`;
  },
};

module.exports = nextConfig;
