import type { MetadataRoute } from "next"

// Manifest PWA — servi sur /manifest.webmanifest par Next. Rend l'app
// installable sur l'écran d'accueil (iOS/Android) en plein écran, sans barre
// de navigateur. Icônes générées par scripts/generate-pwa-icons.sh.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ERP Freelance",
    short_name: "ERP",
    description: "Centralisez votre activité freelance",
    start_url: "/",
    display: "standalone",
    background_color: "#0a0a0a",
    theme_color: "#0a0a0a",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      // Plein cadre avec glyphe en zone sûre → utilisable aussi en maskable
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  }
}
