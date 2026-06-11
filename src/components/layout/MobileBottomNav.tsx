"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard, Users, FileText, Code2, CheckSquare,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useModules, type ModuleId } from "@/hooks/use-modules"

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

export function MobileBottomNav() {
  const pathname = usePathname()
  const { isActive } = useModules()

  const visibleItems = bottomItems.filter(item => !item.moduleId || isActive(item.moduleId))

  return (
    <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-50 flex items-stretch border-t border-border/70 bg-background/95 backdrop-blur-sm supports-[backdrop-filter]:bg-background/80">
      {visibleItems.map(({ href, icon: Icon, label }) => {
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
      })}
    </nav>
  )
}
