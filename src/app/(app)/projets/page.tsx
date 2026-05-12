import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { ProjetsListView } from "@/components/modules/projet/ProjetsListView"

export default async function ProjetsPage() {
  const session = await auth()
  const userId = session!.user.id

  const [projects, clients, projectTags] = await Promise.all([
    prisma.project.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: {
        client: { select: { name: true, company: true, type: true } },
        _count: { select: { tasks: true } },
        tasks: { select: { status: true }, where: { parentTaskId: null } },
      },
    }),
    prisma.client.findMany({
      where: { userId },
      orderBy: [{ type: "asc" }, { name: "asc" }],
      select: { id: true, name: true, company: true, type: true },
    }),
    prisma.project.findMany({
      where: { userId },
      select: { id: true, tags: { select: { id: true, name: true, color: true } } },
    }).catch(() => [] as { id: string; tags: { id: string; name: string; color: string }[] }[]),
  ])

  const tagsById = Object.fromEntries(projectTags.map((p) => [p.id, p.tags]))

  const projectsWithStats = projects.map((p) => ({
    ...p,
    tags: tagsById[p.id] ?? [],
    tasksDone: p.tasks.filter((t) => t.status === "DONE").length,
  }))

  return <ProjetsListView userId={userId} projects={projectsWithStats} clients={clients} />
}
