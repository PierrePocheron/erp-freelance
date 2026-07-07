import type { NextConfig } from "next";

// En-têtes statiques. La Content-Security-Policy est gérée par requête dans
// src/middleware.ts (CSP par nonce) pour supprimer 'unsafe-inline' côté scripts.
const securityHeaders = [
  { key: "X-DNS-Prefetch-Control", value: "on" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
]

const nextConfig: NextConfig = {
  headers: async () => [
    {
      source: "/:path*",
      headers: securityHeaders,
    },
  ],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.vercel-storage.com" },
    ],
  },
}

export default nextConfig;
