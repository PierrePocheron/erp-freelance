import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Calendar, Clock, CheckSquare } from "lucide-react"
import { TagBadge } from "./TagBadge"

const statusConfig = {
  ACTIVE: { label: "Actif", className: "bg-emerald-500/15 text-emerald-600 border-emerald-500/20" },
  PAUSED: { label: "Pausé", className: "bg-amber-500/15 text-amber-600 border-amber-500/20" },
  COMPLETED: { label: "Terminé", className: "bg-blue-500/15 text-blue-600 border-blue-500/20" },
  ARCHIVED: { label: "Archivé", className: "bg-muted text-muted-foreground border-border" },
}

type Props = {
  project: {
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
}

export function ProjectCard({ project }: Props) {
  const { label, className } = statusConfig[project.status]
  const clientLabel =
    project.client.type === "SELF"
      ? "Perso"
      : project.client.company || project.client.name

  return (
    <Link href={`/projets/${project.id}`}>
      <div className="group rounded-xl border border-border/50 bg-card p-5 hover:border-border hover:shadow-md transition-all cursor-pointer space-y-4">
        <div className="flex items-start justify-between gap-2">
          <div>
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
          <Badge variant="outline" className={`shrink-0 text-xs ${className}`}>
            {label}
          </Badge>
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
      </div>
    </Link>
  )
}
