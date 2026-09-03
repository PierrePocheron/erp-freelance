"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

const TABS = [
  { label: "Aperçu",   suffix: "" },
  { label: "Dev",      suffix: "/dev" },
  { label: "Post-Dev", suffix: "/post-dev" },
]

/**
 * Onglets de la fiche projet — uniquement pour les projets « dev » (Aperçu / Dev / Post-Dev).
 * Sans tag dev il n'y a qu'un Aperçu → aucun onglet (une barre à un seul onglet n'apporte rien).
 * Le suivi du temps n'est plus un onglet : c'est une carte + modale en bas de l'Aperçu.
 * Pas d'`overflow-x-auto` ici : combiné au `-mb-px` des liens, il créait 1 px de débordement
 * → une scrollbar parasite apparaissait sous les onglets.
 */
export function ProjectTabs({
  projectId,
  hasDevTag = false,
}: {
  projectId: string
  hasDevTag?: boolean
}) {
  const pathname = usePathname()
  const base = `/projets/${projectId}`
  if (!hasDevTag) return null

  return (
    <div className="flex flex-wrap gap-1 border-b border-border">
      {TABS.map(({ label, suffix }) => {
        const href = base + suffix
        const isActive = suffix === "" ? pathname === base : pathname.startsWith(href)
        return (
          <Link
            key={suffix}
            href={href}
            className={cn(
              "px-4 py-2.5 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors",
              isActive
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {label}
          </Link>
        )
      })}
    </div>
  )
}
