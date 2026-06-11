import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { notFound } from "next/navigation"
import Link from "next/link"
import { ChevronLeft, Users } from "lucide-react"
import { ProjectTabs } from "@/components/modules/projet/ProjectTabs"
import { ProjectDateBadge } from "@/components/modules/projet/ProjectDateBadge"
import { ProjectNameEdit, ProjectDescriptionEdit, ProjectHoursEdit, ProjectStatusEdit, ProjectPriorityEdit } from "@/components/modules/projet/ProjectInlineEdit"
import { TagSelector } from "@/components/modules/projet/TagSelector"
import { ProjectSettingsDialog } from "@/components/modules/projet/ProjectSettingsDialog"
import { ProjectContactsManager } from "@/components/modules/projet/ProjectContactsManager"
import { addProjectContact, removeProjectContact, updateProjectCompany } from "@/actions/projet"
import { UserAvatar } from "@/components/ui/user-avatar"

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
        contactLinks: {
          select: { clientId: true, role: true, label: true, client: { select: { id: true, name: true, company: true } } },
          orderBy: { createdAt: "asc" },
        },
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
      select: { tags: { select: { id: true, name: true } } },
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
  const hasDevTag = (projectTagIds?.tags ?? []).some((t) => t.name.toLowerCase() === "dev")

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
            <ProjectContactsManager
              projectId={id}
              allContacts={contacts}
              projectContacts={project.contactLinks}
              onAdd={async (clientId, role, label) => {
                "use server"
                await addProjectContact(id, clientId, role, label)
              }}
              onRemove={async (clientId) => {
                "use server"
                await removeProjectContact(id, clientId)
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
                  <UserAvatar
                    name={project.user.name}
                    email={project.user.email}
                    image={project.user.image}
                    size="sm"
                    variant="primary"
                    withRing
                    title={`${project.user.name ?? project.user.email} (propriétaire)`}
                  />
                  {project.members.map((m) => (
                    <UserAvatar
                      key={m.userId}
                      name={m.user.name}
                      email={m.user.email}
                      image={m.user.image}
                      size="sm"
                      variant="muted"
                      withRing
                      title={`${m.user.name ?? m.user.email} (${m.role === "VIEWER" ? "lecteur" : "membre"})`}
                    />
                  ))}
                </div>
                <span className="text-xs text-muted-foreground hidden sm:inline">
                  {project.members.length + 1} <Users className="h-3 w-3 inline" />
                </span>
              </div>
            )}

            <ProjectPriorityEdit projectId={id} value={project.priority as "LOW" | "MEDIUM" | "HIGH" | "URGENT"} />
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

      <ProjectTabs projectId={id} hasDevTag={hasDevTag} />

      {children}
    </div>
  )
}
