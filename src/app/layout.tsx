import type { Metadata, Viewport } from "next";
import { Poppins } from "next/font/google";
import { Toaster } from "sonner";
import { THEME_INIT_SCRIPT } from "@/lib/theme-init-script";
import { AMOUNTS_INIT_SCRIPT } from "@/lib/amounts-init-script";
import "./globals.css";

const poppins = Poppins({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "ERP Freelance",
  description: "Centralisez votre activité freelance",
  // PWA installée (iOS) : plein écran sans chrome Safari, titre sous l'icône
  appleWebApp: {
    capable: true,
    title: "ERP",
    statusBarStyle: "black-translucent",
  },
  icons: {
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  // Couleur de la barre système, alignée sur --background (light/dark)
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="fr"
      className={`${poppins.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="h-full overflow-hidden bg-background text-foreground" suppressHydrationWarning>
        {/* Script de thème anti-FOUC — 4e (et dernière) itération de ce bug, cf.
            9a80e29 puis 4e8fce4 : React 19 n'hydrate JAMAIS un élément <script>
            (il le saute puis le recrée côté client sans l'exécuter), donc tout
            <script> rendu dans l'arbre React — y compris celui que next/script
            beforeInteractive rend en app router depuis Next 16.2 — déclenche
            "Encountered a script tag while rendering React component".
            Solution : le script n'est plus un élément React. Il voyage dans le
            innerHTML d'un <div> inerte — streamé tel quel dans le HTML initial,
            le parseur du navigateur l'exécute avant de peindre le reste du body
            (anti-FOUC intact), et React n'hydrate qu'un <div>, sans jamais
            diff-er son contenu (dangerouslySetInnerHTML). Contenu 100% statique
            → autorisé en CSP par hash sha256 (src/proxy.ts), plus aucun nonce
            interpolé → plus rien qui puisse mismatcher. */}
        <div
          hidden
          dangerouslySetInnerHTML={{ __html: `<script>${THEME_INIT_SCRIPT}</script>` }}
        />
        {/* Même mécanisme anti-FOUC pour le masquage des montants : pose
            .hide-amounts sur <html> avant hydratation (cf. amounts-init-script). */}
        <div
          hidden
          dangerouslySetInnerHTML={{ __html: `<script>${AMOUNTS_INIT_SCRIPT}</script>` }}
        />
        {children}
        <Toaster position="bottom-right" richColors />
      </body>
    </html>
  );
}
