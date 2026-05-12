"use client"

import { useState } from "react"
import Link from "next/link"
import { LayoutGrid, List, Layers, Calendar, CheckSquare } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { ProjectCard } from "./ProjectCard"
import { CreateProjectDialog } from "./CreateProjectDialog"

const statusConfig = {
  ACTIVE:    { label: "Actif",    cls: "bg-emerald-500/15 text-emerald-600 border-emerald-500/20" },
  PAUSED:    { label: "Pausé",    cls: "bg-amber-500/15 text-amber-600 border-amber-500/20" },
  COMPLETED: { label: "Terminé", cls: "bg-blue-500/15 text-blue-600 border-blue-500/20" },
  ARCHIVED:  { label: "Archivé", cls: "bg-muted text-muted-foreground border-border" },
}

type Project = {
  id: string
  name: string
  description: string | null
  status: keyof typeof statusConfig
  endDate: Date | null
  estimatedHours: number | null
  client: { name: string; company: string | null; type: string }
  _count: { tasks: number }
  tasksDone: number
  tags: { id: string; name: string; color: string }[]
}

type Client = { id: string; name: string; company: string | null; type: string }

export function ProjetsListView({
  userId,
  projects,
  clients,
}: {
  userId: string
  projects: Project[]
  clients: Client[]
}) {
  const [view, setView] = useState<"cards" | "list">("cards")

  const active = projects.filter((p) => p.status === "ACTIVE")
  const others = projects.filter((p) => p.status !== "ACTIVE")

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Projets</h1>
          <p className="text-sm text-muted-foreground">
            {projects.length} projet{projects.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
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
          <CreateProjectDialog userId={userId} clients={clients} />
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
                {active.map((p) => <ProjectCard key={p.id} project={p} />)}
              </div>
            </section>
          )}
          {others.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Autres</h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {others.map((p) => <ProjectCard key={p.id} project={p} />)}
              </div>
            </section>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-border/50 bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground">
                <th className="px-4 py-3 text-left font-medium">Projet</th>
                <th className="px-4 py-3 text-left font-medium">Client</th>
                <th className="px-4 py-3 text-left font-medium">Statut</th>
                <th className="px-4 py-3 text-left font-medium">Tâches</th>
                <th className="px-4 py-3 text-left font-medium">Fin estimée</th>
              </tr>
            </thead>
            <tbody>
              {[...active, ...others].map((p) => {
                const st = statusConfig[p.status]
                const progress = p._count.tasks > 0 ? Math.round((p.tasksDone / p._count.tasks) * 100) : 0
                const clientLabel = p.client.type === "SELF" ? "Perso" : p.client.company || p.client.name
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
                    <td className="px-4 py-3 text-muted-foreground">{clientLabel}</td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className={`text-xs ${st.cls}`}>{st.label}</Badge>
                    </td>
                    <td className="px-4 py-3">
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
                    <td className="px-4 py-3 text-xs text-muted-foreground">
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
