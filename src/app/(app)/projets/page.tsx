import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { CreateProjectDialog } from "@/components/modules/projet/CreateProjectDialog"
import { ProjectCard } from "@/components/modules/projet/ProjectCard"
import { Layers } from "lucide-react"

export default async function ProjetsPage() {
  const session = await auth()
  const userId = session!.user.id

  const [projects, clients] = await Promise.all([
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
  ])

  const projectsWithStats = projects.map((p) => ({
    ...p,
    tasksDone: p.tasks.filter((t) => t.status === "DONE").length,
  }))

  const active = projectsWithStats.filter((p) => p.status === "ACTIVE")
  const others = projectsWithStats.filter((p) => p.status !== "ACTIVE")

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Projets</h1>
          <p className="text-sm text-muted-foreground">
            {projects.length} projet{projects.length !== 1 ? "s" : ""}
          </p>
        </div>
        <CreateProjectDialog userId={userId} clients={clients} />
      </div>

      {projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-20 text-center">
          <Layers className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="font-medium">Aucun projet pour le moment</p>
          <p className="text-sm text-muted-foreground mt-1">
            Créez votre premier projet pour commencer
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {active.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                En cours
              </h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {active.map((p) => (
                  <ProjectCard key={p.id} project={p} />
                ))}
              </div>
            </section>
          )}
          {others.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                Autres
              </h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {others.map((p) => (
                  <ProjectCard key={p.id} project={p} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  )
}
