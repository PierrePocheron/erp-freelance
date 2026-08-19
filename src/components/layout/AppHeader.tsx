"use client"

import { AppBreadcrumbs } from "@/components/layout/AppBreadcrumbs"
import { AmountsPrivacyToggle } from "@/components/ui/amounts-privacy-toggle"

/**
 * Header d'application fixe (desktop) : fil d'Ariane cliquable du module/page
 * courant, bouton « Masquer les montants » et cloche de notifications (passée en
 * children par le layout serveur). La déconnexion vit dans Réglages (plus dans le
 * header). Comme la sidebar, il ne défile pas — seul le contenu de <main> scrolle.
 * Masqué en mobile (accueil épuré + bottom nav).
 */
export function AppHeader({ children }: { children?: React.ReactNode }) {
  return (
    <header className="hidden sm:flex h-12 shrink-0 items-center justify-between gap-3 border-b border-border/50 bg-background/80 px-4 sm:px-6 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex items-center gap-2 min-w-0">
        <AppBreadcrumbs />
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <AmountsPrivacyToggle />
        {children}
      </div>
    </header>
  )
}
