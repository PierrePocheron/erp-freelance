import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { notFound } from "next/navigation"
import Link from "next/link"
import { ChevronLeft, Clock } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { ProjectTabs } from "@/components/modules/projet/ProjectTabs"
import { ProjectDateBadge } from "@/components/modules/projet/ProjectDateBadge"

const statusConfig = {
  ACTIVE:    { label: "Actif",    className: "bg-emerald-500/15 text-emerald-600 border-emerald-500/20" },
  PAUSED:    { label: "Pausé",    className: "bg-amber-500/15 text-amber-600 border-amber-500/20" },
  COMPLETED: { label: "Terminé", className: "bg-blue-500/15 text-blue-600 border-blue-500/20" },
  ARCHIVED:  { label: "Archivé", className: "bg-muted text-muted-foreground border-border" },
}

export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const session = await auth()

  const project = await prisma.project.findFirst({
    where: { id, userId: session!.user.id },
    include: { client: { select: { name: true, company: true, type: true } } },
  })

  if (!project) notFound()

  const { label, className } = statusConfig[project.status]
  const clientLabel =
    project.client.type === "SELF"
      ? "Perso"
      : project.client.company || project.client.name

  return (
    <div className="space-y-5">
      <div>
        <Link
          href="/projets"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-3"
        >
          <ChevronLeft className="h-4 w-4" /> Projets
        </Link>

        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">{clientLabel}</p>
            <h1 className="text-2xl font-bold tracking-tight">{project.name}</h1>
            {project.description && (
              <p className="text-sm text-muted-foreground">{project.description}</p>
            )}

            {/* Badges dates + heures — éditables au clic */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <ProjectDateBadge
                projectId={id}
                field="startDate"
                value={project.startDate}
                label="Début"
              />
              <ProjectDateBadge
                projectId={id}
                field="endDate"
                value={project.endDate}
                label="Fin estimée"
              />
              {project.estimatedHours && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/50 px-2.5 py-0.5 text-xs">
                  <Clock className="h-3 w-3" />
                  {project.estimatedHours}h estimées
                </span>
              )}
            </div>
          </div>

          <Badge variant="outline" className={`shrink-0 ${className}`}>
            {label}
          </Badge>
        </div>
      </div>

      <ProjectTabs projectId={id} />

      {children}
    </div>
  )
}
