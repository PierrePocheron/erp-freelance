import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { notFound } from "next/navigation"
import Link from "next/link"
import { ChevronLeft } from "lucide-react"
import { ProjectTabs } from "@/components/modules/projet/ProjectTabs"
import { ProjectDateBadge } from "@/components/modules/projet/ProjectDateBadge"
import { ProjectNameEdit, ProjectDescriptionEdit, ProjectHoursEdit, ProjectStatusEdit } from "@/components/modules/projet/ProjectInlineEdit"
import { TagSelector } from "@/components/modules/projet/TagSelector"
import { ProjectDeleteButton } from "@/components/modules/projet/ProjectDeleteButton"

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

          <ProjectStatusEdit projectId={id} value={project.status} />
        </div>
      </div>

      <ProjectTabs projectId={id} />

      {children}

      <div className="pt-4 border-t border-border/50 flex justify-end">
        <ProjectDeleteButton projectId={id} userId={userId} projectName={project.name} />
      </div>
    </div>
  )
}
