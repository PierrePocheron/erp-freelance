import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import { Toaster } from "sonner";
import Script from "next/script";
import { THEME_INIT_SCRIPT } from "@/lib/theme-init-script";
import "./globals.css";

const poppins = Poppins({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "ERP Freelance",
  description: "Centralisez votre activité freelance",
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
        {/* Script de thème inliné — doit s'exécuter avant tout rendu pour éviter le flash.
            Un <script> JSX brut ici déclenche "Encountered a script tag while rendering" côté
            React 19/Turbopack dev (le nœud n'est pas hydraté, il est recréé côté client) — donc
            next/script (beforeInteractive) reste nécessaire malgré le mismatch nonce résiduel
            ci-dessous (cosmétique : next/script source son propre nonce depuis le contexte
            HeadManagerContext de Next, disponible seulement en SSR — suppressHydrationWarning
            ne peut pas l'atteindre, next/script ne le transmet pas à l'élément réellement rendu
            pour un script beforeInteractive inline). Sans conséquence fonctionnelle. */}
        <Script
          id="theme-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }}
        />
        {children}
        <Toaster position="bottom-right" richColors />
      </body>
    </html>
  );
}
