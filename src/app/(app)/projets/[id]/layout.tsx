import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { notFound } from "next/navigation"
import Link from "next/link"
import { ChevronLeft } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { ProjectTabs } from "@/components/modules/projet/ProjectTabs"
import { ProjectDateBadge } from "@/components/modules/projet/ProjectDateBadge"
import { ProjectNameEdit, ProjectDescriptionEdit, ProjectHoursEdit } from "@/components/modules/projet/ProjectInlineEdit"
import { TagSelector } from "@/components/modules/projet/TagSelector"

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

  const userId = session!.user.id

  const [project, allTags, projectTagIds] = await Promise.all([
    prisma.project.findFirst({
      where: { id, userId },
      include: {
        client: { select: { name: true, company: true, type: true } },
      },
    }),
    prisma.tag.findMany({
      where: { userId },
      orderBy: { name: "asc" },
      select: { id: true, name: true, color: true },
    }).catch(() => [] as { id: string; name: string; color: string }[]),
    prisma.project.findFirst({
      where: { id, userId },
      select: { tags: { select: { id: true } } },
    }).catch(() => null),
  ])

  if (!project) notFound()

  const { label, className } = statusConfig[project.status]
  const clientLabel =
    project.client.type === "SELF"
      ? "Perso"
      : project.client.company || project.client.name
  const selectedTagIds = projectTagIds?.tags?.map((t) => t.id) ?? []

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
            <ProjectNameEdit projectId={id} value={project.name} />
            <ProjectDescriptionEdit projectId={id} value={project.description} />

            {/* Badges dates + heures — tous éditables au clic */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <ProjectDateBadge projectId={id} field="startDate" value={project.startDate} label="Début" />
              <ProjectDateBadge projectId={id} field="endDate" value={project.endDate} label="Fin estimée" />
              <ProjectHoursEdit projectId={id} value={project.estimatedHours} />
            </div>

            {/* Tags */}
            <TagSelector
              projectId={id}
              userId={userId}
              availableTags={allTags}
              selectedTagIds={selectedTagIds}
            />
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
