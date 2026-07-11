"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard, Users, FileText, Code2, CheckSquare, Plus,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useModules, type ModuleId } from "@/hooks/use-modules"
import { QuickAddSheet } from "@/components/layout/QuickAddSheet"

type NavItem = {
  href: string
  icon: React.ElementType
  label: string
  moduleId?: ModuleId
}

const bottomItems: NavItem[] = [
  { href: "/",            icon: LayoutDashboard, label: "Dashboard"  },
  { href: "/contacts",    icon: Users,           label: "Contacts",    moduleId: "contacts"    },
  { href: "/facturation", icon: FileText,         label: "Factures",   moduleId: "facturation" },
  { href: "/projets",     icon: Code2,            label: "Projets",    moduleId: "projets"     },
  { href: "/taches",      icon: CheckSquare,      label: "Tâches",     moduleId: "taches"      },
]

// Modules donnant lieu à une saisie express — le « + » central n'apparaît que
// si au moins l'un d'eux est actif (miroir des actions de QuickAddSheet).
const QUICK_ADD_MODULES: ModuleId[] = ["depenses", "taches", "prospection", "revenus"]

export function MobileBottomNav() {
  const pathname = usePathname()
  const { isActive } = useModules()
  const [quickAddOpen, setQuickAddOpen] = useState(false)

  const visibleItems = bottomItems.filter(item => !item.moduleId || isActive(item.moduleId))
  const showQuickAdd = QUICK_ADD_MODULES.some(id => isActive(id))

  // Le « + » s'insère au milieu des items visibles
  const splitIndex = Math.ceil(visibleItems.length / 2)
  const leftItems = showQuickAdd ? visibleItems.slice(0, splitIndex) : visibleItems
  const rightItems = showQuickAdd ? visibleItems.slice(splitIndex) : []

  function renderItem({ href, icon: Icon, label }: NavItem) {
    const active = href === "/" ? pathname === "/" : pathname.startsWith(href)
    return (
      <Link
        key={href}
        href={href}
        className={cn(
          "flex flex-1 flex-col items-center justify-center gap-1 py-2.5 text-[10px] font-medium transition-colors",
          active ? "text-primary" : "text-muted-foreground hover:text-foreground"
        )}
      >
        <Icon className={cn("h-[18px] w-[18px] shrink-0", active && "text-primary")} />
        <span className="leading-none">{label}</span>
      </Link>
    )
  }

  return (
    <>
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-50 flex items-stretch border-t border-border/70 bg-background/95 backdrop-blur-sm supports-[backdrop-filter]:bg-background/80">
        {leftItems.map(renderItem)}
        {showQuickAdd && (
          <div className="flex flex-1 items-center justify-center">
            <button
              type="button"
              onClick={() => setQuickAddOpen(true)}
              aria-label="Ajout rapide"
              className="-mt-6 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 ring-4 ring-background transition-transform active:scale-95"
            >
              <Plus className="h-6 w-6" />
            </button>
          </div>
        )}
        {rightItems.map(renderItem)}
      </nav>
      {showQuickAdd && <QuickAddSheet open={quickAddOpen} onOpenChange={setQuickAddOpen} />}
    </>
  )
}
