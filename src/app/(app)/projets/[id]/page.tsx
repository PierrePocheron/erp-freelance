import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { notFound } from "next/navigation"
import { Calendar, Clock, CheckSquare, BookOpen } from "lucide-react"

export default async function ProjectOverviewPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const session = await auth()

  const project = await prisma.project.findFirst({
    where: { id, userId: session!.user.id },
    include: {
      tasks: { where: { parentTaskId: null }, select: { status: true } },
      milestones: { orderBy: { date: "asc" } },
      deliverables: true,
      journalEntries: { orderBy: { createdAt: "desc" }, take: 3 },
    },
  })

  if (!project) notFound()

  const totalTasks = project.tasks.length
  const doneTasks = project.tasks.filter((t) => t.status === "DONE").length
  const inProgressTasks = project.tasks.filter((t) => t.status === "IN_PROGRESS").length

  const nextMilestone = project.milestones
    .filter((m) => m.status !== "DONE")
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0]

  return (
    <div className="space-y-6">
      {/* Bento stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-xl border border-border/50 bg-card p-4 space-y-1">
          <div className="flex items-center gap-2 text-muted-foreground text-xs">
            <CheckSquare className="h-3.5 w-3.5" />
            Tâches
          </div>
          <p className="text-2xl font-bold">{doneTasks}<span className="text-sm font-normal text-muted-foreground">/{totalTasks}</span></p>
          <p className="text-xs text-muted-foreground">{inProgressTasks} en cours</p>
        </div>

        <div className="rounded-xl border border-border/50 bg-card p-4 space-y-1">
          <div className="flex items-center gap-2 text-muted-foreground text-xs">
            <Clock className="h-3.5 w-3.5" />
            Heures estimées
          </div>
          <p className="text-2xl font-bold">{project.estimatedHours ?? "—"}</p>
          <p className="text-xs text-muted-foreground">heures prévues</p>
        </div>

        <div className="rounded-xl border border-border/50 bg-card p-4 space-y-1">
          <div className="flex items-center gap-2 text-muted-foreground text-xs">
            <Calendar className="h-3.5 w-3.5" />
            Prochain jalon
          </div>
          {nextMilestone ? (
            <>
              <p className="text-sm font-semibold leading-tight">{nextMilestone.name}</p>
              <p className="text-xs text-muted-foreground">
                {new Date(nextMilestone.date).toLocaleDateString("fr-FR", {
                  day: "numeric", month: "short",
                })}
              </p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Aucun jalon</p>
          )}
        </div>

        <div className="rounded-xl border border-border/50 bg-card p-4 space-y-1">
          <div className="flex items-center gap-2 text-muted-foreground text-xs">
            <BookOpen className="h-3.5 w-3.5" />
            Livrables
          </div>
          <p className="text-2xl font-bold">
            {project.deliverables.filter((d) => d.status === "VALIDATED").length}
            <span className="text-sm font-normal text-muted-foreground">/{project.deliverables.length}</span>
          </p>
          <p className="text-xs text-muted-foreground">validés</p>
        </div>
      </div>

      {/* Dates */}
      {(project.startDate || project.endDate) && (
        <div className="rounded-xl border border-border/50 bg-card p-5 flex gap-8">
          {project.startDate && (
            <div>
              <p className="text-xs text-muted-foreground mb-1">Début</p>
              <p className="text-sm font-medium">
                {new Date(project.startDate).toLocaleDateString("fr-FR", {
                  day: "numeric", month: "long", year: "numeric",
                })}
              </p>
            </div>
          )}
          {project.endDate && (
            <div>
              <p className="text-xs text-muted-foreground mb-1">Fin estimée</p>
              <p className="text-sm font-medium">
                {new Date(project.endDate).toLocaleDateString("fr-FR", {
                  day: "numeric", month: "long", year: "numeric",
                })}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Journal récent */}
      {project.journalEntries.length > 0 && (
        <div className="rounded-xl border border-border/50 bg-card p-5 space-y-3">
          <h2 className="text-sm font-semibold">Journal récent</h2>
          <div className="space-y-3">
            {project.journalEntries.map((entry) => (
              <div key={entry.id} className="border-l-2 border-border pl-3">
                <p className="text-xs text-muted-foreground mb-0.5">
                  {new Date(entry.createdAt).toLocaleDateString("fr-FR", {
                    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
                  })}
                </p>
                <p className="text-sm">{entry.content}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
