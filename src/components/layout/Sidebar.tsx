"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import pkg from "../../../package.json"
import {
  LayoutDashboard,
  Users,
  FileText,
  Code2,
  Calendar,
  CheckSquare,
  Server,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Building2,
  Wallet,
  Network,
  Heart,
  Briefcase,
  Landmark,
  TrendingDown,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { ThemeToggle } from "./ThemeToggle"
import { useModules, type ModuleId } from "@/hooks/use-modules"

type NavItem = {
  href:     string
  icon:     React.ElementType
  label:    string
  moduleId?: ModuleId   // si absent → toujours visible (Dashboard, Paramètres)
}

const navItems: NavItem[] = [
  { href: "/",           icon: LayoutDashboard, label: "Dashboard" },
  { href: "/contacts",   icon: Users,           label: "Contacts",   moduleId: "contacts"    },
  { href: "/societes",   icon: Building2,       label: "Sociétés",   moduleId: "societes"    },
  { href: "/facturation",icon: FileText,         label: "Facturation",moduleId: "facturation" },
  { href: "/revenus",    icon: Wallet,           label: "Revenus",    moduleId: "revenus"     },
  { href: "/depenses",   icon: TrendingDown,     label: "Dépenses",   moduleId: "depenses"    },
  { href: "/impots",     icon: Landmark,         label: "Impôts",     moduleId: "impots"      },
  { href: "/projets",    icon: Code2,            label: "Projets",    moduleId: "projets"     },
  { href: "/taches",     icon: CheckSquare,      label: "Tâches",     moduleId: "taches"      },
  { href: "/calendrier", icon: Calendar,         label: "Calendrier", moduleId: "calendrier"  },
  { href: "/graph",      icon: Network,          label: "Graph",      moduleId: "graph"       },
  { href: "/sante",      icon: Heart,            label: "Santé",      moduleId: "sante"       },
  { href: "/entretiens", icon: Briefcase,        label: "Entretiens", moduleId: "entretien"   },
  { href: "/settings",   icon: Settings,         label: "Paramètres" },
]

const STORAGE_KEY = "erp-sidebar-expanded"

export function Sidebar() {
  const pathname = usePathname()
  const [expanded, setExpanded] = useState(false)
  const [mounted, setMounted] = useState(false)
  const { isActive } = useModules()

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (stored !== null) setExpanded(stored === "true")
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true)
  }, [])

  function toggle() {
    setExpanded((v) => {
      localStorage.setItem(STORAGE_KEY, String(!v))
      return !v
    })
  }

  // Évite le flash de contenu avant hydratation
  if (!mounted) return <aside className="hidden sm:block w-16 h-screen shrink-0 border-r border-border/50" />

  // Filtrer selon les modules actifs (les items sans moduleId sont toujours visibles)
  const visibleItems = navItems.filter(item =>
    !item.moduleId || isActive(item.moduleId)
  )

  return (
    <aside
      className={cn(
        "hidden sm:flex relative z-20 h-screen shrink-0 flex-col border-r border-border/50 bg-background/80 backdrop-blur-sm transition-all duration-200",
        expanded ? "w-52" : "w-16"
      )}
    >
      {/* Logo */}
      <div className="px-2 pt-4 pb-2">
        <button
          onClick={toggle}
          className={cn(
            "flex h-10 items-center gap-3 rounded-xl cursor-pointer transition-colors hover:bg-accent",
            expanded ? "w-full px-2.5" : "w-10 justify-center"
          )}
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary">
            <Server className="h-5 w-5 text-primary-foreground" />
          </div>
          {expanded && (
            <span className="font-semibold text-sm truncate">ERP Freelance</span>
          )}
        </button>
      </div>

      {/* Nav */}
      <nav className="flex flex-1 flex-col gap-1 px-2 overflow-y-auto min-h-0">
        {visibleItems.map(({ href, icon: Icon, label }) => {
          const isActive = href === "/" ? pathname === "/" : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              title={expanded ? undefined : label}
              className={cn(
                "group flex h-10 items-center gap-3 rounded-xl px-2.5 transition-colors",
                expanded ? "w-full" : "w-10 justify-center",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              <Icon className="h-5 w-5 shrink-0" />
              {expanded && (
                <span className="text-sm font-medium truncate">{label}</span>
              )}
              {/* Tooltip uniquement en mode réduit */}
              {!expanded && (
                <span className="pointer-events-none absolute left-16 z-[999] hidden whitespace-nowrap rounded-md bg-popover px-2 py-1 text-xs text-popover-foreground shadow-md group-hover:block">
                  {label}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* Recherche Cmd+K */}
      <div className="px-2 pb-1">
        <button
          onClick={() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true }))}
          className={cn(
            "flex h-9 items-center gap-3 rounded-xl px-2.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground w-full",
            expanded ? "" : "w-10 justify-center"
          )}
          title="Recherche (⌘K)"
        >
          <Search className="h-4 w-4 shrink-0" />
          {expanded && (
            <span className="flex-1 text-sm text-left truncate">Recherche</span>
          )}
          {expanded && (
            <kbd className="text-xs bg-muted border border-border px-1.5 py-0.5 rounded font-mono shrink-0">⌘K</kbd>
          )}
        </button>
      </div>

      {/* Toggle + version */}
      <div className={cn("px-2 pb-5 space-y-1", expanded ? "" : "flex flex-col items-center")}>
        <ThemeToggle expanded={expanded} />
        <button
          onClick={toggle}
          className={cn(
            "flex h-9 items-center gap-3 rounded-xl px-2.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
            expanded ? "w-full" : "w-10 justify-center"
          )}
          title={expanded ? "Réduire" : "Agrandir"}
        >
          {expanded
            ? <PanelLeftClose className="h-4 w-4 shrink-0" />
            : <PanelLeftOpen className="h-4 w-4 shrink-0" />
          }
          {expanded && <span className="text-sm truncate">Réduire</span>}
        </button>
        {expanded && (
          <p className="px-2.5 pt-1 text-[10px] text-muted-foreground/40 font-mono select-none">v{pkg.version}</p>
        )}
      </div>
    </aside>
  )
}
