import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Calendar, Clock, CheckSquare } from "lucide-react"
import { TagBadge } from "./TagBadge"
import { PRIORITY_CONFIG, type ProjectPriority } from "./ProjectInlineEdit"

function fmtEur(n: number) {
  return n.toLocaleString("fr-FR", { maximumFractionDigits: 0 }) + " €"
}

const statusConfig = {
  ACTIVE:    { label: "Actif",      className: "bg-emerald-500/15 text-emerald-600 border-emerald-500/20" },
  PAUSED:    { label: "En pause",   className: "bg-amber-500/15 text-amber-600 border-amber-500/20"       },
  COMPLETED: { label: "Terminé",    className: "bg-blue-500/15 text-blue-600 border-blue-500/20"          },
  ARCHIVED:  { label: "Archivé",    className: "bg-muted text-muted-foreground border-border"             },
}

type Props = {
  project: {
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
  showBilling?: boolean
}

export function ProjectCard({ project, showBilling = false }: Props) {
  const { label, className } = statusConfig[project.status]
  const firstContact = project.contactLinks[0]?.client
  const clientLabel = project.company?.name ?? firstContact?.name ?? "—"
  const priority = project.priority ?? "MEDIUM"
  const priorityCfg = PRIORITY_CONFIG[priority]

  return (
    <Link href={`/projets/${project.id}`}>
      <div className="group rounded-xl border border-border/50 bg-card p-5 hover:border-border hover:shadow-md transition-all cursor-pointer space-y-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground mb-1">{clientLabel}</p>
            <h3 className="font-semibold leading-tight group-hover:text-primary transition-colors">
              {project.name}
            </h3>
            {project.description && (
              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                {project.description}
              </p>
            )}
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <Badge variant="outline" className={`text-xs ${className}`}>
              {label}
            </Badge>
            {priority !== "MEDIUM" && (
              <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${priorityCfg.cls}`}>
                {priorityCfg.label}
              </span>
            )}
          </div>
        </div>

        {(project.tags?.length ?? 0) > 0 && (
          <div className="flex flex-wrap gap-1">
            {(project.tags ?? []).map((tag) => (
              <TagBadge key={tag.id} tag={tag} />
            ))}
          </div>
        )}

        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          {project.endDate && (
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {new Date(project.endDate).toLocaleDateString("fr-FR", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </span>
          )}
          {project.estimatedHours && (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {project.estimatedHours}h
            </span>
          )}
          {project._count.tasks > 0 && (
            <span className="flex items-center gap-1">
              <CheckSquare className="h-3 w-3" />
              {project.tasksDone}/{project._count.tasks}
            </span>
          )}
        </div>

        {showBilling && project.billing.totalFacture > 0 && (
          <div className="pt-3 border-t border-border/50 space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Facturation</span>
              <span>
                <span className="font-medium">{fmtEur(project.billing.totalEncaisse)}</span>
                <span className="text-muted-foreground"> / {fmtEur(project.billing.totalFacture)}</span>
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all"
                style={{ width: `${Math.min(100, (project.billing.totalEncaisse / project.billing.totalFacture) * 100)}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </Link>
  )
}
