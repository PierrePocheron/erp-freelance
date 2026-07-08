import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import { Toaster } from "sonner";
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
            <script> brut (pas next/script) : c'est le premier enfant de <body>, donc il
            s'exécute dès son parsing, avant le reste du contenu — pas besoin de la file
            d'attente beforeInteractive de next/script pour ça. Pas de nonce non plus :
            contenu statique autorisé en CSP via un hash (src/proxy.ts) plutôt qu'un nonce,
            ce qui évite le mismatch d'hydratation React sur l'attribut `nonce` (vidé côté
            client par le navigateur une fois le script inséré — cf. THEME_INIT_SCRIPT). */}
        <script
          suppressHydrationWarning
          dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }}
        />
        {children}
        <Toaster position="bottom-right" richColors />
      </body>
    </html>
  );
}
