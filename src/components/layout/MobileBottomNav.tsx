"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, Plus } from "lucide-react"
import { cn } from "@/lib/utils"
import { useModules, type ModuleId } from "@/hooks/use-modules"
import { QuickAddSheet } from "@/components/layout/QuickAddSheet"

// Modules donnant lieu à une saisie express — le « + » n'apparaît que si au
// moins l'un d'eux est actif (miroir des actions de QuickAddSheet).
const QUICK_ADD_MODULES: ModuleId[] = ["depenses", "taches", "prospection", "revenus"]

/**
 * Navigation mobile flottante. Plus de barre d'onglets : le dashboard mobile
 * (grille de modules + recherche) EST la navigation — la barre ne faisait que
 * la dupliquer (retour de Pierre). Restent deux boutons flottants :
 * - « + » (bas droite) : saisies express — se cache quand on scrolle vers le
 *   bas (lecture), réapparaît dès qu'on remonte ou qu'on est près du haut.
 * - « Accueil » (bas gauche) : retour au menu, sur toutes les pages sauf le
 *   dashboard — indispensable en PWA standalone où Safari n'affiche aucun
 *   bouton de navigation.
 */
export function MobileBottomNav() {
  const pathname = usePathname()
  const { isActive } = useModules()
  const [quickAddOpen, setQuickAddOpen] = useState(false)
  const [hidden, setHidden] = useState(false)
  const lastScrollTop = useRef(0)

  const showQuickAdd = QUICK_ADD_MODULES.some(id => isActive(id))
  const showHome = pathname !== "/"

  // Cache/montre au scroll du conteneur principal (le <main> du layout —
  // c'est lui qui scrolle, pas window).
  useEffect(() => {
    const main = document.getElementById("app-main")
    if (!main) return

    function onScroll() {
      const top = main!.scrollTop
      const delta = top - lastScrollTop.current
      // Près du haut → toujours visible ; sinon on suit la direction
      // (seuil de 8px pour ignorer le jitter du scroll élastique iOS)
       
      if (top < 60) setHidden(false)
      else if (delta > 8) setHidden(true)
      else if (delta < -8) setHidden(false)
      lastScrollTop.current = top
    }

    main.addEventListener("scroll", onScroll, { passive: true })
    return () => main.removeEventListener("scroll", onScroll)
  }, [])

  return (
    <>
      {/* Accueil — bas gauche */}
      {showHome && (
        <Link
          href="/"
          aria-label="Retour à l'accueil"
          className={cn(
            "sm:hidden fixed bottom-5 left-4 z-50 flex h-12 w-12 items-center justify-center rounded-full border border-border bg-background/95 text-muted-foreground shadow-lg backdrop-blur-sm transition-all duration-200 active:scale-95",
            hidden && "translate-y-24 opacity-0 pointer-events-none"
          )}
        >
          <Home className="h-5 w-5" />
        </Link>
      )}

      {/* Ajout rapide — bas droite */}
      {showQuickAdd && (
        <button
          type="button"
          onClick={() => setQuickAddOpen(true)}
          aria-label="Ajout rapide"
          className={cn(
            "sm:hidden fixed bottom-5 right-4 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 transition-all duration-200 active:scale-95",
            hidden && "translate-y-24 opacity-0 pointer-events-none"
          )}
        >
          <Plus className="h-6 w-6" />
        </button>
      )}

      {showQuickAdd && <QuickAddSheet open={quickAddOpen} onOpenChange={setQuickAddOpen} />}
    </>
  )
}
