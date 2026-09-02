"use client"

import { useState, useMemo, useRef, useEffect } from "react"
import Link from "next/link"
import { LayoutGrid, List, Layers, Calendar, CheckSquare, Search, TrendingUp, ChevronDown, Check, SlidersHorizontal } from "lucide-react"
import { useSortState, cmp } from "@/hooks/use-sortable"
import { Th } from "@/components/ui/sortable-header"
import { Badge } from "@/components/ui/badge"
import { BillingBar } from "@/components/modules/billing/BillingBar"
import { ProjectCard } from "./ProjectCard"
import { CreateProjectDialog } from "./CreateProjectDialog"
import { PRIORITY_CONFIG, type ProjectPriority } from "./ProjectInlineEdit"
import { CATEGORY_CONFIG, ALL_CATEGORIES } from "./category-config"
import type { ProjectCategory } from "@/generated/prisma/enums"
import { cn } from "@/lib/utils"

const PRIORITY_ORDER: Record<ProjectPriority, number> = {
  URGENT: 4, HIGH: 3, MEDIUM: 2, LOW: 1,
}

const statusConfig = {
  ACTIVE:    { label: "Actif",      cls: "bg-emerald-500/15 text-emerald-600 border-emerald-500/20" },
  PAUSED:    { label: "En pause",   cls: "bg-amber-500/15 text-amber-600 border-amber-500/20"       },
  COMPLETED: { label: "Terminé",    cls: "bg-blue-500/15 text-blue-600 border-blue-500/20"          },
  ARCHIVED:  { label: "Archivé",    cls: "bg-muted text-muted-foreground border-border"             },
  CANCELLED: { label: "Annulé",     cls: "bg-red-500/15 text-red-600 border-red-500/20 line-through" },
}

type ProjectStatusKey = keyof typeof statusConfig
const ALL_STATUSES = Object.keys(statusConfig) as ProjectStatusKey[]

/** Menu déroulant de filtre compact, multi-sélection, avec pastille colorée par option. */
function FilterDropdown<T extends string>({
  label, icon, options, selected, onToggle, onClear,
}: {
  label: string
  icon: React.ReactNode
  options: { value: T; label: string; count: number; swatch: React.ReactNode }[]
  selected: Set<T>
  onToggle: (v: T) => void
  onClear: () => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") setOpen(false) }
    document.addEventListener("mousedown", onDocClick)
    document.addEventListener("keydown", onKey)
    return () => { document.removeEventListener("mousedown", onDocClick); document.removeEventListener("keydown", onKey) }
  }, [open])

  const active = selected.size > 0
  const summary = selected.size === 0
    ? "Tous"
    : selected.size === 1
    ? options.find((o) => selected.has(o.value))?.label ?? "1"
    : `${selected.size} sélectionnés`

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-xs font-medium border transition-colors",
          active
            ? "bg-primary/10 text-primary border-primary/25"
            : "text-muted-foreground border-border hover:bg-muted/50 hover:text-foreground"
        )}
      >
        {icon}
        <span className="hidden sm:inline">{label} :</span>
        <span className={active ? "font-semibold" : ""}>{summary}</span>
        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="absolute right-0 z-30 mt-1 min-w-[14rem] rounded-xl border border-border bg-card shadow-xl p-1">
          {options.map((o) => {
            const on = selected.has(o.value)
            return (
              <button
                key={o.value}
                type="button"
                onClick={() => onToggle(o.value)}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs hover:bg-accent transition-colors"
              >
                <span className="w-3.5 shrink-0 flex justify-center text-primary">{on && <Check className="h-3.5 w-3.5" />}</span>
                {o.swatch}
                <span className="flex-1 text-left truncate">{o.label}</span>
                <span className="text-[10px] text-muted-foreground tabular-nums">{o.count}</span>
              </button>
            )
          })}
          {active && (
            <>
              <div className="my-1 border-t border-border/60" />
              <button
                type="button"
                onClick={onClear}
                className="w-full rounded-lg px-2 py-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground transition-colors text-left"
              >
                Réinitialiser
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}

type Project = {
  id: string
  name: string
  description: string | null
  status: keyof typeof statusConfig
  category?: ProjectCategory
  priority?: ProjectPriority
  endDate: Date | null
  estimatedHours: number | null
  company: { id: string; name: string } | null
  contactLinks: { client: { id: string; name: string; company: string | null } }[]
  _count: { tasks: number }
  tasksDone: number
  tags: { id: string; name: string; color: string }[]
  skills?: { name: string }[]
  billing: { totalFacture: number; totalEncaisse: number }
  revenue: { totalRevenu: number; revenuRecu: number }
  lastActivityAt: number // ms — date d'activité la plus récente (créé / modifié / utilisé)
}

type Company = { id: string; name: string; city: string | null }
type Contact = { id: string; name: string; company: string | null; companyId: string | null }
type JobApp = { id: string; position: string; companyName: string }

function byPriority(a: Project, b: Project) {
  const pa = PRIORITY_ORDER[a.priority ?? "MEDIUM"]
  const pb = PRIORITY_ORDER[b.priority ?? "MEDIUM"]
  return pb - pa  // plus haute priorité d'abord
}

// Tri par défaut : activité la plus récente d'abord (créé / modifié / utilisé), priorité en second.
function byActivity(a: Project, b: Project) {
  return b.lastActivityAt - a.lastActivityAt || byPriority(a, b)
}

export function ProjetsListView({
  userId,
  projects,
  companies,
  contacts,
  jobApplications = [],
}: {
  userId: string
  projects: Project[]
  companies: Company[]
  contacts: Contact[]
  jobApplications?: JobApp[]
}) {
  const [view, setView] = useState<"cards" | "list">("cards")
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<Set<ProjectStatusKey>>(new Set())
  const [categoryFilter, setCategoryFilter] = useState<Set<ProjectCategory>>(new Set())
  const [showBilling, setShowBilling] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)
  // Groupes de projets terminés dépliés (par catégorie) — repliés par défaut
  const [openCompleted, setOpenCompleted] = useState<Set<ProjectCategory>>(new Set())
  const { sortCol, sortDir, toggle } = useSortState("activity", "desc")

  // Raccourci ⌘F / Ctrl+F : focalise la recherche projets (remplace le « rechercher dans la page » natif)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && (e.key === "f" || e.key === "F")) {
        e.preventDefault()
        searchRef.current?.focus()
        searchRef.current?.select()
      }
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [])

  function toggleCompletedGroup(c: ProjectCategory) {
    setOpenCompleted((prev) => {
      const next = new Set(prev)
      if (next.has(c)) next.delete(c)
      else next.add(c)
      return next
    })
  }

  function toggleStatus(s: ProjectStatusKey) {
    setStatusFilter((prev) => {
      const next = new Set(prev)
      if (next.has(s)) next.delete(s); else next.add(s)
      return next
    })
  }
  function toggleCategory(c: ProjectCategory) {
    setCategoryFilter((prev) => {
      const next = new Set(prev)
      if (next.has(c)) next.delete(c); else next.add(c)
      return next
    })
  }

  const filtered = projects.filter((p) => {
    const matchStatus = statusFilter.size === 0 || statusFilter.has(p.status)
    const matchCategory = categoryFilter.size === 0 || categoryFilter.has(p.category ?? "AUTRE")
    const firstContactName = p.contactLinks[0]?.client?.name ?? ""
    const matchSearch = !search.trim() || p.name.toLowerCase().includes(search.toLowerCase()) || (p.company?.name ?? firstContactName).toLowerCase().includes(search.toLowerCase())
    return matchStatus && matchCategory && matchSearch
  })

  const active    = [...filtered.filter((p) => p.status === "ACTIVE")].sort(byActivity)
  const completed = [...filtered.filter((p) => p.status === "COMPLETED")].sort(byActivity)
  const others    = [...filtered.filter((p) => p.status !== "ACTIVE" && p.status !== "COMPLETED")].sort(byActivity)

  const listItems = useMemo(() => {
    const all = [...active, ...completed, ...others]
    if (!sortCol) return all
    return [...all].sort((a, b) => {
      switch (sortCol) {
        case "name":     return cmp(a.name, b.name, sortDir)
        case "company":  return cmp(a.company?.name ?? null, b.company?.name ?? null, sortDir)
        case "priority": return cmp(PRIORITY_ORDER[a.priority ?? "MEDIUM"], PRIORITY_ORDER[b.priority ?? "MEDIUM"], sortDir)
        case "status":   return cmp(a.status, b.status, sortDir)
        case "endDate":  return cmp(a.endDate ? new Date(a.endDate) : null, b.endDate ? new Date(b.endDate) : null, sortDir)
        case "activity": return cmp(a.lastActivityAt, b.lastActivityAt, sortDir)
        default: return 0
      }
    })
  }, [active, completed, others, sortCol, sortDir])

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="sm:hidden text-2xl font-bold tracking-tight">Projets</h1>
          <p className="text-sm text-muted-foreground">
            {filtered.length}{filtered.length !== projects.length ? `/${projects.length}` : ""} projet{projects.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Filtre Type (catégorie) — sélecteur compact multi-choix, couleurs + motifs des bannières */}
          <FilterDropdown
            label="Type"
            icon={<SlidersHorizontal className="h-3.5 w-3.5" />}
            options={ALL_CATEGORIES.map((c) => ({
              value: c,
              label: CATEGORY_CONFIG[c].label,
              count: projects.filter((p) => (p.category ?? "AUTRE") === c).length,
              swatch: <span className={cn("inline-block h-3 w-4 rounded-sm shrink-0", CATEGORY_CONFIG[c].bannerCls)} style={CATEGORY_CONFIG[c].pattern} />,
            }))}
            selected={categoryFilter}
            onToggle={toggleCategory}
            onClear={() => setCategoryFilter(new Set())}
          />

          {/* Filtre Statut — même sélecteur compact */}
          <FilterDropdown
            label="Statut"
            icon={<CheckSquare className="h-3.5 w-3.5" />}
            options={ALL_STATUSES.map((s) => ({
              value: s,
              label: statusConfig[s].label,
              count: projects.filter((p) => p.status === s).length,
              swatch: <span className={cn("inline-block h-3 w-4 rounded-sm shrink-0 border", statusConfig[s].cls)} />,
            }))}
            selected={statusFilter}
            onToggle={toggleStatus}
            onClear={() => setStatusFilter(new Set())}
          />

          {/* Recherche — agrandie + raccourci ⌘F */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              ref={searchRef}
              type="search"
              aria-label="Rechercher un projet"
              placeholder="Rechercher un projet…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 pl-8 pr-12 rounded-lg border border-border bg-transparent text-sm focus:outline-none focus:ring-1 focus:ring-ring w-56 sm:w-72"
            />
            <kbd className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 hidden sm:flex items-center rounded border border-border/60 bg-muted/60 px-1 py-0.5 text-[10px] font-mono text-muted-foreground/70">⌘F</kbd>
          </div>

          {/* Toggle facturation */}
          <button
            onClick={() => setShowBilling((v) => !v)}
            className={cn(
              "flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-xs font-medium border transition-colors",
              showBilling
                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20"
                : "text-muted-foreground border-border hover:bg-muted/50 hover:text-foreground"
            )}
            title="Afficher la facturation et les revenus"
          >
            <TrendingUp className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Facturation & revenus</span>
          </button>

          {/* Vue */}
          <div className="flex rounded-lg border border-border overflow-hidden">
            <button
              type="button"
              onClick={() => setView("cards")}
              className={`px-2.5 py-1.5 transition-colors ${view === "cards" ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              title="Vue cartes"
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setView("list")}
              className={`px-2.5 py-1.5 border-l border-border transition-colors ${view === "list" ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              title="Vue liste"
            >
              <List className="h-4 w-4" />
            </button>
          </div>
          <CreateProjectDialog userId={userId} companies={companies} contacts={contacts} jobApplications={jobApplications} />
        </div>
      </div>

      {projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-20 text-center">
          <Layers className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="font-medium">Aucun projet pour le moment</p>
          <p className="text-sm text-muted-foreground mt-1">Créez votre premier projet pour commencer</p>
        </div>
      ) : view === "cards" ? (
        <div className="space-y-6">
          {active.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">En cours</h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {active.map((p) => <ProjectCard key={p.id} project={p} showBilling={showBilling} />)}
              </div>
            </section>
          )}
          {completed.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                Terminé <span className="normal-case tracking-normal">({completed.length})</span>
              </h2>
              {/* Sous-menus dépliants par catégorie (repliés par défaut) */}
              <div className="space-y-2">
                {ALL_CATEGORIES.map((c) => {
                  const group = completed.filter((p) => (p.category ?? "AUTRE") === c)
                  if (group.length === 0) return null
                  const cfg = CATEGORY_CONFIG[c]
                  const isOpen = openCompleted.has(c)
                  return (
                    <div key={c} className="rounded-xl border border-border/50 overflow-hidden">
                      <button
                        type="button"
                        onClick={() => toggleCompletedGroup(c)}
                        className="flex w-full items-center gap-2.5 px-4 py-2.5 bg-card hover:bg-muted/40 transition-colors text-left"
                      >
                        {/* Échantillon couleur + motif de la catégorie */}
                        <span
                          className={cn("inline-block h-3.5 w-6 rounded-sm shrink-0", cfg.bannerCls)}
                          style={cfg.pattern}
                        />
                        <span className="text-sm font-medium">{cfg.label}</span>
                        <span className="text-xs text-muted-foreground">({group.length})</span>
                        <ChevronDown
                          className={cn(
                            "ml-auto h-4 w-4 text-muted-foreground transition-transform",
                            isOpen && "rotate-180"
                          )}
                        />
                      </button>
                      {isOpen && (
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 p-4 border-t border-border/50 bg-muted/10">
                          {group.map((p) => <ProjectCard key={p.id} project={p} showBilling={showBilling} />)}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </section>
          )}
          {others.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Autres</h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {others.map((p) => <ProjectCard key={p.id} project={p} showBilling={showBilling} />)}
              </div>
            </section>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-border/50 bg-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <Th label="Projet"      col="name"     sortCol={sortCol} sortDir={sortDir} onSort={toggle} className="px-4 py-3" />
                <Th label="Société"     col="company"  sortCol={sortCol} sortDir={sortDir} onSort={toggle} className="px-4 py-3 hidden sm:table-cell" />
                <Th label="Priorité"    col="priority" sortCol={sortCol} sortDir={sortDir} onSort={toggle} className="px-4 py-3" />
                <Th label="Statut"      col="status"   sortCol={sortCol} sortDir={sortDir} onSort={toggle} className="px-4 py-3" />
                <th className="px-4 py-3 text-left font-medium text-xs text-muted-foreground hidden md:table-cell">Tâches</th>
                {showBilling && <th className="px-4 py-3 text-left font-medium text-xs text-muted-foreground hidden md:table-cell">Facturation / Revenus</th>}
                <Th label="Fin estimée" col="endDate"  sortCol={sortCol} sortDir={sortDir} onSort={toggle} className="px-4 py-3 hidden lg:table-cell" />
                <Th label="Dernière activité" col="activity" sortCol={sortCol} sortDir={sortDir} onSort={toggle} className="px-4 py-3 hidden lg:table-cell" />
              </tr>
            </thead>
            <tbody>
              {listItems.map((p) => {
                const st = statusConfig[p.status]
                const progress = p._count.tasks > 0 ? Math.round((p.tasksDone / p._count.tasks) * 100) : 0
                const clientLabel = p.company?.name ?? p.contactLinks[0]?.client?.name ?? "—"
                const priority = p.priority ?? "MEDIUM"
                const priorityCfg = PRIORITY_CONFIG[priority]
                const cat = CATEGORY_CONFIG[p.category ?? "AUTRE"]
                return (
                  <tr key={p.id} className="border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-stretch gap-3">
                        {/* Liseré catégorie — même couleur + motif que la bannière des cartes */}
                        <span
                          className={cn("w-1.5 rounded-full shrink-0", cat.bannerCls)}
                          style={cat.pattern}
                          title={cat.label}
                        />
                        <div className="min-w-0">
                          <Link href={`/projets/${p.id}`} className="font-medium hover:text-primary transition-colors">
                            {p.name}
                          </Link>
                          {p.description && (
                            <p className="text-xs text-muted-foreground truncate max-w-xs mt-0.5">{p.description}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">{clientLabel}</td>
                    <td className="px-4 py-3">
                      <span className={cn("rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap", priorityCfg.cls)}>
                        {priorityCfg.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className={`text-xs ${st.cls}`}>{st.label}</Badge>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      {p._count.tasks > 0 ? (
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
                          </div>
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <CheckSquare className="h-3 w-3" />
                            {p.tasksDone}/{p._count.tasks}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    {showBilling && (
                      <td className="px-4 py-3 hidden md:table-cell">
                        <BillingBar
                          totalFacture={p.billing.totalFacture}
                          totalEncaisse={p.billing.totalEncaisse}
                          totalRevenu={p.revenue.totalRevenu}
                          revenuRecu={p.revenue.revenuRecu}
                        />
                      </td>
                    )}
                    <td className="px-4 py-3 text-xs text-muted-foreground hidden lg:table-cell">
                      {p.endDate ? (
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(p.endDate).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}
                        </span>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground hidden lg:table-cell whitespace-nowrap">
                      {new Date(p.lastActivityAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
