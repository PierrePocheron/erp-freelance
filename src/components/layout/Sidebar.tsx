"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import pkg from "../../../package.json"
import {
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
  Target,
  Brain,
  LineChart,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { OPEN_COMMAND_PALETTE_EVENT } from "./CommandPalette"
import { useModules, type ModuleId } from "@/hooks/use-modules"

type NavGroup = "crm" | "finances" | "travail" | "perso"

const GROUP_LABELS: Record<NavGroup, string> = {
  crm: "CRM",
  finances: "Finances",
  travail: "Travail",
  perso: "Perso",
}

type NavItem = {
  href:     string
  icon:     React.ElementType
  label:    string
  moduleId?: ModuleId   // si absent → toujours visible (Dashboard, Paramètres)
  group?:    NavGroup   // regroupement visuel ; les items sans groupe restent isolés (Dashboard en haut, Paramètres en bas)
}

// Exporté : source de vérité route + icône + module, réutilisée par MobileHome.
export const navItems: NavItem[] = [
  { href: "/contacts",   icon: Users,           label: "Contacts",   moduleId: "contacts",    group: "crm" },
  { href: "/prospection",icon: Target,          label: "Prospection",moduleId: "prospection", group: "crm" },
  { href: "/societes",   icon: Building2,       label: "Sociétés",   moduleId: "societes",    group: "crm" },
  { href: "/facturation",icon: FileText,         label: "Facturation",moduleId: "facturation", group: "crm" },
  { href: "/revenus",    icon: Wallet,           label: "Revenus",    moduleId: "revenus",     group: "finances" },
  { href: "/depenses",   icon: TrendingDown,     label: "Dépenses",   moduleId: "depenses",    group: "finances" },
  { href: "/impots",     icon: Landmark,         label: "Impôts",     moduleId: "impots",      group: "finances" },
  { href: "/investissements", icon: LineChart,   label: "Investissements", moduleId: "investissements", group: "finances" },
  { href: "/projets",    icon: Code2,            label: "Projets",    moduleId: "projets",     group: "travail" },
  { href: "/taches",     icon: CheckSquare,      label: "Tâches",     moduleId: "taches",      group: "travail" },
  { href: "/graph",      icon: Network,          label: "Graph",      moduleId: "graph",       group: "travail" },
  { href: "/entretiens", icon: Briefcase,        label: "Entretiens", moduleId: "entretien",   group: "travail" },
  { href: "/competences",icon: Brain,            label: "Compétences",moduleId: "competences", group: "travail" },
  { href: "/sante",      icon: Heart,            label: "Santé",      moduleId: "sante",       group: "perso" },
  { href: "/calendrier", icon: Calendar,         label: "Calendrier", moduleId: "calendrier",  group: "perso" },
  { href: "/settings",   icon: Settings,         label: "Paramètres" },
]

const STORAGE_KEY = "erp-sidebar-expanded"

export function Sidebar() {
  const pathname = usePathname()
  const [expanded, setExpanded] = useState(false)
  const [mounted, setMounted] = useState(false)
  const { isActive } = useModules()
  const asideRef = useRef<HTMLElement>(null)
  // Infobulle au survol en mode replié : nom du module, ancrée à droite de la sidebar.
  const [tip, setTip] = useState<{ label: string; top: number; left: number } | null>(null)

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (stored !== null) setExpanded(stored === "true")
    setMounted(true)
  }, [])

  function toggle() {
    setExpanded((v) => {
      localStorage.setItem(STORAGE_KEY, String(!v))
      return !v
    })
  }

  // Infobulle au survol (uniquement en mode replié) : positionne le nom du bouton à droite
  // de la sidebar, aligné verticalement sur l'icône survolée.
  const tipHandlers = (label: string) =>
    expanded
      ? {}
      : {
          onMouseEnter: (e: React.MouseEvent<HTMLElement>) => {
            const r = e.currentTarget.getBoundingClientRect()
            const a = asideRef.current?.getBoundingClientRect()
            setTip({ label, top: r.top + r.height / 2, left: (a?.right ?? 96) + 8 })
          },
          onMouseLeave: () => setTip(null),
        }

  // Évite le flash de contenu avant hydratation
  if (!mounted) return <aside className="hidden sm:block w-24 h-screen shrink-0 border-r border-border/50" />

  // Filtrer selon les modules actifs (les items sans moduleId sont toujours visibles)
  const visibleItems = navItems.filter(item =>
    !item.moduleId || isActive(item.moduleId)
  )

  // Regrouper en segments contigus par groupe : chaque groupe (CRM, Finances…) forme un
  // bloc ; les items sans groupe (Dashboard, Paramètres) restent des segments isolés.
  const segments: { group?: NavGroup; items: NavItem[] }[] = []
  for (const item of visibleItems) {
    const last = segments[segments.length - 1]
    if (last && last.group === item.group) last.items.push(item)
    else segments.push({ group: item.group, items: [item] })
  }

  return (
    <aside
      ref={asideRef}
      className={cn(
        "hidden sm:flex relative z-20 h-screen shrink-0 flex-col border-r border-border/50 bg-background/80 backdrop-blur-sm transition-all duration-200",
        expanded ? "w-52" : "w-24"
      )}
    >
      {/* Logo → accueil (le Dashboard n'a plus de bouton dédié, c'est la page home) */}
      <div className={cn("px-2 pt-4 pb-2", !expanded && "flex justify-center")}>
        <Link
          href="/"
          aria-label="Accueil"
          {...tipHandlers("Accueil")}
          className={cn(
            "flex h-10 items-center gap-3 rounded-xl transition-colors hover:bg-accent",
            // px-0.5 déplié = même retrait (2px) que le centrage du logo 36px dans
            // le bouton 40px replié → l'icône ne bouge pas d'un pixel au toggle.
            expanded ? "w-full px-0.5" : "w-10 justify-center"
          )}
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary">
            <Server className="h-5 w-5 text-primary-foreground" />
          </div>
          {expanded && (
            <span className="font-semibold text-sm truncate">ERP Freelance</span>
          )}
        </Link>
      </div>
      {/* Trait qui isole le logo de la navigation */}
      <div aria-hidden className="mx-3 mb-1 h-px bg-border/60" />

      {/* Nav — groupée par section ; repliée = grille 2 colonnes, dépliée = liste labellisée.
          Page active = surbrillance douce (fond léger) ; nom des icônes réduites via `title`. */}
      <nav data-tour="sidebar" className="flex flex-1 flex-col gap-1 px-2 overflow-y-auto min-h-0">
        {segments.map((seg, si) => (
          <div key={si} className="flex flex-col">
            {si > 0 && <div aria-hidden className="my-1 h-px bg-border/60" />}
            {seg.group && (
              <div className={cn(
                "pb-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground/70",
                expanded ? "px-2.5 pt-1" : "px-1 pt-0.5 text-center",
              )}>
                {GROUP_LABELS[seg.group]}
              </div>
            )}
            <div className={cn(
              expanded ? "flex flex-col gap-0.5"
              : seg.items.length > 1 ? "grid grid-cols-2 justify-items-center gap-1"
              : "flex justify-center",
            )}>
              {seg.items.map(({ href, icon: Icon, label }) => {
                // Route active courante — distincte du isActive(moduleId) du hook useModules.
                const isCurrent = href === "/" ? pathname === "/" : pathname.startsWith(href)
                return (
                  <Link
                    key={href}
                    href={href}
                    data-tour={href === "/settings" ? "settings" : undefined}
                    data-active={isCurrent || undefined}
                    aria-current={isCurrent ? "page" : undefined}
                    aria-label={!expanded ? label : undefined}
                    {...tipHandlers(label)}
                    className={cn(
                      "flex items-center rounded-xl transition-colors",
                      expanded ? "h-9 w-full gap-3 px-2.5" : "h-9 w-9 justify-center",
                      isCurrent
                        ? "bg-accent font-medium text-foreground"
                        : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                    )}
                  >
                    <Icon className="h-5 w-5 shrink-0" />
                    {expanded && <span className="text-sm font-medium truncate">{label}</span>}
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Recherche Cmd+K */}
      <div className={cn("px-2 pb-1", !expanded && "flex justify-center")}>
        <button
          data-tour="search"
          onClick={() => window.dispatchEvent(new CustomEvent(OPEN_COMMAND_PALETTE_EVENT))}
          {...tipHandlers("Recherche (⌘K)")}
          className={cn(
            "flex h-9 items-center rounded-xl text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
            expanded ? "w-full gap-3 px-2.5" : "w-9 justify-center"
          )}
          title="Recherche (⌘K)"
          aria-label="Recherche (⌘K)"
        >
          <Search className="h-5 w-5 shrink-0" />
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
        <button
          onClick={toggle}
          {...tipHandlers(expanded ? "Réduire" : "Agrandir")}
          className={cn(
            "flex h-9 items-center rounded-xl text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
            expanded ? "w-full gap-3 px-2.5" : "w-9 justify-center"
          )}
          title={expanded ? "Réduire" : "Agrandir"}
          aria-label={expanded ? "Réduire le menu" : "Agrandir le menu"}
        >
          {expanded
            ? <PanelLeftClose className="h-5 w-5 shrink-0" />
            : <PanelLeftOpen className="h-5 w-5 shrink-0" />
          }
          {expanded && <span className="text-sm truncate">Réduire</span>}
        </button>
        {expanded && (
          <p className="px-2.5 pt-1 text-[10px] text-muted-foreground/40 font-mono select-none">v{pkg.version}</p>
        )}
      </div>

      {/* Infobulle de survol (mode replié) — ancrée à droite de la sidebar, alignée sur l'icône */}
      {tip && !expanded && (
        <div
          className="pointer-events-none fixed z-[999] -translate-y-1/2 whitespace-nowrap rounded-md border border-border bg-popover px-2 py-1 text-xs text-popover-foreground shadow-md"
          style={{ left: tip.left, top: tip.top }}
        >
          {tip.label}
        </div>
      )}
    </aside>
  )
}
