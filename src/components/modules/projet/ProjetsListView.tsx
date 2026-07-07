"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { LayoutGrid, List, Layers, Calendar, CheckSquare, Search, TrendingUp } from "lucide-react"
import { useSortState, cmp } from "@/hooks/use-sortable"
import { Th } from "@/components/ui/sortable-header"
import { Badge } from "@/components/ui/badge"
import { BillingBar } from "@/components/modules/billing/BillingBar"
import { ProjectCard } from "./ProjectCard"
import { CreateProjectDialog } from "./CreateProjectDialog"
import { PRIORITY_CONFIG, type ProjectPriority } from "./ProjectInlineEdit"
import { cn } from "@/lib/utils"

const PRIORITY_ORDER: Record<ProjectPriority, number> = {
  URGENT: 4, HIGH: 3, MEDIUM: 2, LOW: 1,
}

const statusConfig = {
  ACTIVE:    { label: "Actif",      cls: "bg-emerald-500/15 text-emerald-600 border-emerald-500/20" },
  PAUSED:    { label: "En pause",   cls: "bg-amber-500/15 text-amber-600 border-amber-500/20"       },
  COMPLETED: { label: "Terminé",    cls: "bg-blue-500/15 text-blue-600 border-blue-500/20"          },
  ARCHIVED:  { label: "Archivé",    cls: "bg-muted text-muted-foreground border-border"             },
}

type Project = {
  id: string
  name: string
  description: string | null
  status: keyof typeof statusConfig
  priority?: ProjectPriority
  endDate: Date | null
  estimatedHours: number | null
  company: { id: string; name: string } | null
  contactLinks: { client: { id: string; name: string; company: string | null } }[]
  _count: { tasks: number }
  tasksDone: number
  tags: { id: string; name: string; color: string }[]
  billing: { totalFacture: number; totalEncaisse: number }
}

type Company = { id: string; name: string; city: string | null }
type Contact = { id: string; name: string; company: string | null; companyId: string | null }

function byPriority(a: Project, b: Project) {
  const pa = PRIORITY_ORDER[a.priority ?? "MEDIUM"]
  const pb = PRIORITY_ORDER[b.priority ?? "MEDIUM"]
  return pb - pa  // plus haute priorité d'abord
}

export function ProjetsListView({
  userId,
  projects,
  companies,
  contacts,
}: {
  userId: string
  projects: Project[]
  companies: Company[]
  contacts: Contact[]
}) {
  const [view, setView] = useState<"cards" | "list">("cards")
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("ALL")
  const [showBilling, setShowBilling] = useState(false)
  const { sortCol, sortDir, toggle } = useSortState()

  const STATUS_FILTERS = [
    { value: "ALL",       label: "Tous"      },
    { value: "ACTIVE",    label: "Actifs"    },
    { value: "PAUSED",    label: "En pause"  },
    { value: "COMPLETED", label: "Terminés"  },
    { value: "ARCHIVED",  label: "Archivés"  },
  ]

  const filtered = projects.filter((p) => {
    const matchStatus = statusFilter === "ALL" || p.status === statusFilter
    const firstContactName = p.contactLinks[0]?.client?.name ?? ""
    const matchSearch = !search.trim() || p.name.toLowerCase().includes(search.toLowerCase()) || (p.company?.name ?? firstContactName).toLowerCase().includes(search.toLowerCase())
    return matchStatus && matchSearch
  })

  const active    = [...filtered.filter((p) => p.status === "ACTIVE")].sort(byPriority)
  const completed = [...filtered.filter((p) => p.status === "COMPLETED")].sort(byPriority)
  const others    = [...filtered.filter((p) => p.status !== "ACTIVE" && p.status !== "COMPLETED")].sort(byPriority)

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
        default: return 0
      }
    })
  }, [active, completed, others, sortCol, sortDir])

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Projets</h1>
          <p className="text-sm text-muted-foreground">
            {filtered.length}{filtered.length !== projects.length ? `/${projects.length}` : ""} projet{projects.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Status filters — select on mobile, buttons on sm+ */}
          <select
            className="sm:hidden rounded-lg border border-border px-2.5 py-1.5 text-xs bg-background text-foreground"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            {STATUS_FILTERS.map((f) => (
              <option key={f.value} value={f.value}>{f.label}</option>
            ))}
          </select>
          <div className="hidden sm:flex rounded-lg border border-border overflow-hidden text-xs">
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => setStatusFilter(f.value)}
                className={`px-2.5 py-1.5 border-r last:border-r-0 border-border transition-colors ${
                  statusFilter === f.value ? "bg-accent font-medium" : "text-muted-foreground hover:bg-muted/50"
                }`}
              >
                {f.label}
                {f.value !== "ALL" && (
                  <span className="ml-1 text-[10px] opacity-60">
                    ({projects.filter((p) => p.status === f.value).length})
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="search"
              placeholder="Rechercher..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 pl-8 pr-3 rounded-lg border border-border bg-transparent text-sm focus:outline-none focus:ring-1 focus:ring-ring w-40"
            />
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
            title="Afficher la facturation"
          >
            <TrendingUp className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Facturation</span>
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
          <CreateProjectDialog userId={userId} companies={companies} contacts={contacts} />
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
              <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Terminé</h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {completed.map((p) => <ProjectCard key={p.id} project={p} showBilling={showBilling} />)}
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
                {showBilling && <th className="px-4 py-3 text-left font-medium text-xs text-muted-foreground hidden md:table-cell">Facturation</th>}
                <Th label="Fin estimée" col="endDate"  sortCol={sortCol} sortDir={sortDir} onSort={toggle} className="px-4 py-3 hidden lg:table-cell" />
              </tr>
            </thead>
            <tbody>
              {listItems.map((p) => {
                const st = statusConfig[p.status]
                const progress = p._count.tasks > 0 ? Math.round((p.tasksDone / p._count.tasks) * 100) : 0
                const clientLabel = p.company?.name ?? p.contactLinks[0]?.client?.name ?? "—"
                const priority = p.priority ?? "MEDIUM"
                const priorityCfg = PRIORITY_CONFIG[priority]
                return (
                  <tr key={p.id} className="border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <Link href={`/projets/${p.id}`} className="font-medium hover:text-primary transition-colors">
                        {p.name}
                      </Link>
                      {p.description && (
                        <p className="text-xs text-muted-foreground truncate max-w-xs mt-0.5">{p.description}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">{clientLabel}</td>
                    <td className="px-4 py-3">
                      <span className={cn("rounded-full border px-2 py-0.5 text-xs font-medium", priorityCfg.cls)}>
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
