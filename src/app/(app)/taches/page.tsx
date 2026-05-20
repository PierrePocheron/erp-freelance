import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { GlobalTasksView } from "@/components/modules/taches/GlobalTasksView"

export default async function TachesPage() {
  const session = await auth()
  const userId = session!.user.id

  const [tasks, projects, clients] = await Promise.all([
    prisma.task.findMany({
      where: {
        OR: [
          { project: { userId } },  // tâches projet
          { userId },               // tâches client / standalone
        ],
        isGroup: false,
        parentTaskId: null,
      },
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        priority: true,
        importance: true,
        order: true,
        estimatedHours: true,
        dueDate: true,
        startedAt: true,
        completedAt: true,
        project: {
          select: {
            id: true,
            name: true,
            client: { select: { id: true, name: true, company: true } },
          },
        },
        client: { select: { id: true, name: true, company: true } },
        taskTags: { select: { id: true, name: true, color: true } },
        timeEntries: {
          where: { userId },
          select: { id: true, duration: true },
        },
        _count: { select: { subTasks: true } },
      },
    }),
    prisma.project.findMany({
      where: { userId, status: { not: "ARCHIVED" } },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        client: { select: { id: true, name: true, company: true } },
      },
    }),
    prisma.client.findMany({
      where: { userId, type: { not: "SELF" } },
      orderBy: [{ company: "asc" }, { name: "asc" }],
      select: { id: true, name: true, company: true },
    }),
  ])

  // Collecter tous les tags uniques
  const allTagsMap = new Map<string, { id: string; name: string; color: string }>()
  for (const t of tasks) {
    for (const tag of t.taskTags) {
      allTagsMap.set(tag.id, tag)
    }
  }
  const allTags = Array.from(allTagsMap.values()).sort((a, b) => a.name.localeCompare(b.name))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Tâches</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Vue globale de toutes vos tâches — projets, clients et personnelles
        </p>
      </div>

      <GlobalTasksView
        tasks={tasks as never}
        projects={projects as never}
        clients={clients}
        allTags={allTags}
      />
    </div>
  )
}
