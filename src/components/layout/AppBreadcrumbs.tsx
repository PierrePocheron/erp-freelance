"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChevronRight } from "lucide-react"
import { navItems } from "@/components/layout/Sidebar"
import { buildCrumbs } from "@/lib/breadcrumbs"
import { useBreadcrumbLabels } from "@/components/layout/BreadcrumbContext"

/**
 * Fil d'Ariane cliquable du header — dérivé de l'URL (voir `buildCrumbs`).
 * Tous les crumbs sauf le dernier sont des liens vers les pages parentes ;
 * le dernier (page courante) est en gras, non cliquable.
 */
export function AppBreadcrumbs() {
  const pathname = usePathname()
  const labels = useBreadcrumbLabels()
  const crumbs = buildCrumbs(pathname, navItems, labels)

  if (crumbs.length === 0) return <span className="text-sm font-semibold">ERP</span>

  const Icon = crumbs[0].icon

  return (
    <nav aria-label="Fil d'Ariane" className="flex items-center gap-1.5 min-w-0 text-sm">
      {Icon && <Icon className="h-4 w-4 text-muted-foreground shrink-0" />}
      {crumbs.map((c, i) => {
        const last = i === crumbs.length - 1
        return (
          <span key={`${c.href}-${i}`} className="flex items-center gap-1.5 min-w-0">
            {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />}
            {last ? (
              <span className="font-semibold truncate">{c.label}</span>
            ) : (
              <Link
                href={c.href}
                className="text-muted-foreground hover:text-foreground transition-colors truncate"
              >
                {c.label}
              </Link>
            )}
          </span>
        )
      })}
    </nav>
  )
}
