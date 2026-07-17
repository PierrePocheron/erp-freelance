"use client"

import { usePathname } from "next/navigation"
import { LogOut } from "lucide-react"
import { navItems } from "@/components/layout/Sidebar"
import { Button } from "@/components/ui/button"

/**
 * Header d'application fixe (desktop) : titre du module courant dérivé de la
 * route, cloche de notifications (passée en children par le layout serveur)
 * et bouton de déconnexion. Comme la sidebar, il ne défile pas — seul le
 * contenu de <main> scrolle. Masqué en mobile (accueil épuré + bottom nav).
 */
export function AppHeader({
  logoutAction,
  children,
}: {
  logoutAction: () => Promise<void>
  children?: React.ReactNode
}) {
  const pathname = usePathname()
  // Item de navigation le plus spécifique pour la route courante
  const current = navItems
    .filter((n) => (n.href === "/" ? pathname === "/" : pathname === n.href || pathname.startsWith(n.href + "/")))
    .sort((a, b) => b.href.length - a.href.length)[0]
  const Icon = current?.icon

  return (
    <header className="hidden sm:flex h-12 shrink-0 items-center justify-between gap-3 border-b border-border/50 bg-background/80 px-4 sm:px-6 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex items-center gap-2 min-w-0">
        {Icon && <Icon className="h-4 w-4 text-muted-foreground shrink-0" />}
        <span className="text-sm font-semibold truncate">{current?.label ?? "ERP"}</span>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        {children}
        <form action={logoutAction}>
          <Button
            type="submit"
            variant="ghost"
            size="sm"
            className="gap-1.5 text-muted-foreground hover:text-foreground"
            title="Se déconnecter"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden md:inline">Déconnexion</span>
          </Button>
        </form>
      </div>
    </header>
  )
}
