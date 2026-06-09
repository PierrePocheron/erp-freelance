import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { notFound } from "next/navigation"
import Link from "next/link"
import { ChevronLeft, Users } from "lucide-react"
import { ProjectTabs } from "@/components/modules/projet/ProjectTabs"
import { ProjectDateBadge } from "@/components/modules/projet/ProjectDateBadge"
import { ProjectNameEdit, ProjectDescriptionEdit, ProjectHoursEdit, ProjectStatusEdit } from "@/components/modules/projet/ProjectInlineEdit"
import { TagSelector } from "@/components/modules/projet/TagSelector"
import { ProjectSettingsDialog } from "@/components/modules/projet/ProjectSettingsDialog"
import { ProjectContactSelect } from "@/components/modules/projet/ProjectContactSelect"
import { updateProjectContact, updateProjectCompany } from "@/actions/projet"

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

  const [project, allTags, projectTagIds, contacts] = await Promise.all([
    prisma.project.findFirst({
      where: {
        id,
        OR: [{ userId }, { members: { some: { userId } } }],
      },
      include: {
        company: { select: { id: true, name: true } },
        contact: { select: { id: true, name: true, company: true } },
        members: {
          include: { user: { select: { name: true, email: true, image: true } } },
          orderBy: { createdAt: "asc" },
        },
        user: { select: { name: true, email: true, image: true } },
      },
    }),
    prisma.tag.findMany({
      where: { userId },
      orderBy: { name: "asc" },
      select: { id: true, name: true, color: true },
    }).catch(() => [] as { id: string; name: string; color: string }[]),
    prisma.project.findFirst({
      where: { id, OR: [{ userId }, { members: { some: { userId } } }] },
      select: { tags: { select: { id: true } } },
    }).catch(() => null),
    prisma.client.findMany({
      where: { userId },
      orderBy: [{ name: "asc" }],
      select: { id: true, name: true, company: true },
    }),
  ])

  if (!project) notFound()

  const isOwner = project.userId === userId
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
            {project.company ? (
              <Link
                href={`/societes/${project.company.id}`}
                className="text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                {project.company.name}
              </Link>
            ) : (
              <span className="text-sm text-muted-foreground italic">Sans société</span>
            )}
            <ProjectNameEdit projectId={id} value={project.name} />
            <ProjectDescriptionEdit projectId={id} value={project.description} />
            <ProjectContactSelect
              contacts={contacts}
              currentId={project.contact?.id ?? null}
              action={async (contactId) => {
                "use server"
                await updateProjectContact(id, contactId)
              }}
            />

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <ProjectDateBadge projectId={id} field="startDate" value={project.startDate} label="Début" />
              <ProjectDateBadge projectId={id} field="endDate" value={project.endDate} label="Fin estimée" />
              <ProjectHoursEdit projectId={id} value={project.estimatedHours} />
            </div>

            <TagSelector
              projectId={id}
              userId={userId}
              availableTags={allTags}
              selectedTagIds={selectedTagIds}
            />
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {/* Avatars collaborateurs */}
            {(project.members.length > 0) && (
              <div className="flex items-center gap-2">
                <div className="flex items-center -space-x-1.5">
                  {project.user.image ? (
                    <img
                      src={project.user.image}
                      alt={project.user.name ?? project.user.email ?? ""}
                      title={`${project.user.name ?? project.user.email} (propriétaire)`}
                      className="h-6 w-6 rounded-full border-2 border-background object-cover"
                    />
                  ) : (
                    <div
                      title={`${project.user.name ?? project.user.email} (propriétaire)`}
                      className="h-6 w-6 rounded-full border-2 border-background bg-primary/20 text-primary text-[9px] font-semibold flex items-center justify-center"
                    >
                      {(project.user.name ?? project.user.email ?? "?").slice(0, 1).toUpperCase()}
                    </div>
                  )}
                  {project.members.map((m) =>
                    m.user.image ? (
                      <img
                        key={m.userId}
                        src={m.user.image}
                        alt={m.user.name ?? m.user.email ?? ""}
                        title={`${m.user.name ?? m.user.email} (${m.role === "VIEWER" ? "lecteur" : "membre"})`}
                        className="h-6 w-6 rounded-full border-2 border-background object-cover"
                      />
                    ) : (
                      <div
                        key={m.userId}
                        title={`${m.user.name ?? m.user.email} (${m.role === "VIEWER" ? "lecteur" : "membre"})`}
                        className="h-6 w-6 rounded-full border-2 border-background bg-muted text-muted-foreground text-[9px] font-semibold flex items-center justify-center"
                      >
                        {(m.user.name ?? m.user.email ?? "?").slice(0, 1).toUpperCase()}
                      </div>
                    )
                  )}
                </div>
                <span className="text-xs text-muted-foreground hidden sm:inline">
                  {project.members.length + 1} <Users className="h-3 w-3 inline" />
                </span>
              </div>
            )}

            <ProjectStatusEdit projectId={id} value={project.status} />
            {isOwner && (
              <ProjectSettingsDialog
                projectId={id}
                userId={userId}
                projectName={project.name}
                members={project.members}
                ownerName={project.user.name}
                ownerEmail={project.user.email}
                ownerImage={project.user.image}
              />
            )}
          </div>
        </div>
      </div>

      <ProjectTabs projectId={id} />

      {children}
    </div>
  )
}
