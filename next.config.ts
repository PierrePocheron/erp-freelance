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
  // Les TTF Poppins du template PDF (src/lib/pdf-fonts.ts) sont lus via fs à
  // l'exécution : on force leur inclusion dans les fonctions serverless
  // (routes /api/pdf/*, /api/export/archive et server actions de facturation
  // — d'où le glob large). Sans ça, Vercel ne les embarque pas et le rendu
  // retomberait silencieusement sur Helvetica.
  outputFileTracingIncludes: {
    "/**": ["./public/fonts/*.ttf"],
  },
}

export default nextConfig;
