import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { notFound } from "next/navigation"
import { Clock, Timer, TrendingUp, AlertTriangle, Trash2, Download } from "lucide-react"
import { deleteTimeEntry } from "@/actions/timetracking"
import { AddTimeEntryDialog } from "@/components/modules/projet/AddTimeEntryDialog"

function fmtSeconds(s: number): string {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (h > 0) return `${h}h${String(m).padStart(2, "0")}`
  if (m > 0) return `${m}m`
  return `${s}s`
}

function fmtHours(h: number): string {
  const int = Math.floor(h)
  const min = Math.round((h - int) * 60)
  if (int > 0 && min > 0) return `${int}h${String(min).padStart(2, "0")}`
  if (int > 0) return `${int}h`
  return `${min}m`
}

export default async function ProjectTempsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const session = await auth()
  const userId = session!.user.id

  const project = await prisma.project.findFirst({
    where: { id, userId },
    include: {
      tasks: {
        where: { parentTaskId: null },
        orderBy: [{ status: "asc" }, { order: "asc" }],
        include: {
          subTasks: {
            include: {
              timeEntries: {
                where: { userId },
                orderBy: { startedAt: "desc" },
              },
            },
          },
          timeEntries: {
            where: { userId },
            orderBy: { startedAt: "desc" },
          },
        },
      },
    },
  })

  if (!project) notFound()

  // Calcul du temps total par tâche (y compris sous-tâches)
  const taskStats = project.tasks.map((task) => {
    const direct = task.timeEntries
      .filter((e) => e.endedAt && e.duration)
      .reduce((s, e) => s + (e.duration ?? 0), 0)
    const sub = task.subTasks.flatMap((st) =>
      st.timeEntries.filter((e) => e.endedAt && e.duration)
    ).reduce((s, e) => s + (e.duration ?? 0), 0)

    const runningDirect = task.timeEntries.find((e) => !e.endedAt)
    const runningSub = task.subTasks
      .flatMap((st) => st.timeEntries)
      .find((e) => !e.endedAt)
    const running = runningDirect ?? runningSub

    return {
      task,
      totalSeconds: direct + sub,
      estimatedHours: task.estimatedHours ?? null,
      isRunning: !!running,
      entries: task.timeEntries,
    }
  })

  // Liste plate (tâches + sous-tâches) pour le sélecteur du dialog d'ajout manuel
  const taskOptions = project.tasks.flatMap((t) => [
    { id: t.id, title: t.title },
    ...t.subTasks.map((st) => ({ id: st.id, title: `${t.title} → ${st.title}` })),
  ])

  const totalTrackedSeconds = taskStats.reduce((s, t) => s + t.totalSeconds, 0)
  const totalTrackedHours = totalTrackedSeconds / 3600
  const estimatedHours = project.estimatedHours ?? null
  const budgetPercent = estimatedHours
    ? Math.min(100, Math.round((totalTrackedHours / estimatedHours) * 100))
    : null
  const isOver = estimatedHours ? totalTrackedHours > estimatedHours : false

  return (
    <div className="space-y-6">

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-xl border border-border/50 bg-card p-4 space-y-1">
          <div className="flex items-center gap-2 text-muted-foreground text-xs">
            <Clock className="h-3.5 w-3.5" />
            Temps total
          </div>
          <p className="text-2xl font-bold">{fmtSeconds(totalTrackedSeconds)}</p>
          <p className="text-xs text-muted-foreground">toutes tâches</p>
        </div>

        <div className="rounded-xl border border-border/50 bg-card p-4 space-y-1">
          <div className="flex items-center gap-2 text-muted-foreground text-xs">
            <TrendingUp className="h-3.5 w-3.5" />
            Estimé
          </div>
          <p className="text-2xl font-bold">{estimatedHours ? fmtHours(estimatedHours) : "—"}</p>
          <p className="text-xs text-muted-foreground">budget initial</p>
        </div>

        <div className={`rounded-xl border p-4 space-y-1 ${
          isOver ? "border-red-500/30 bg-red-500/5" :
          budgetPercent && budgetPercent > 80 ? "border-amber-500/30 bg-amber-500/5" :
          "border-border/50 bg-card"
        }`}>
          <div className="flex items-center gap-2 text-muted-foreground text-xs">
            {isOver ? <AlertTriangle className="h-3.5 w-3.5 text-red-500" /> : <TrendingUp className="h-3.5 w-3.5" />}
            Utilisation
          </div>
          <p className={`text-2xl font-bold ${isOver ? "text-red-500" : ""}`}>
            {budgetPercent !== null ? `${budgetPercent}%` : "—"}
          </p>
          <p className="text-xs text-muted-foreground">
            {isOver
              ? `+${fmtHours(totalTrackedHours - (estimatedHours ?? 0))} de dépassement`
              : estimatedHours
              ? `${fmtHours(estimatedHours - totalTrackedHours)} restantes`
              : "pas d'estimé"}
          </p>
        </div>

        <div className="rounded-xl border border-border/50 bg-card p-4 space-y-1">
          <div className="flex items-center gap-2 text-muted-foreground text-xs">
            <Timer className="h-3.5 w-3.5" />
            En cours
          </div>
          <p className="text-2xl font-bold">
            {taskStats.filter((t) => t.isRunning).length > 0 ? "Actif" : "—"}
          </p>
          <p className="text-xs text-muted-foreground">
            {taskStats.filter((t) => t.isRunning).length > 0
              ? taskStats.find((t) => t.isRunning)?.task.title
              : "aucun chrono"}
          </p>
        </div>
      </div>

      {/* Tableau par tâche */}
      <div className="rounded-xl border border-border/50 bg-card overflow-x-auto">
        <div className="flex items-center gap-2 px-5 py-3 border-b border-border/50">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-semibold text-sm">Temps par tâche</h2>
        </div>

        {taskStats.length === 0 ? (
          <p className="p-5 text-sm text-muted-foreground">Aucune tâche</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50 text-xs text-muted-foreground">
                <th className="px-5 py-2.5 text-left font-medium">Tâche</th>
                <th className="px-5 py-2.5 text-left font-medium">Statut</th>
                <th className="px-5 py-2.5 text-right font-medium">Estimé</th>
                <th className="px-5 py-2.5 text-right font-medium">Passé</th>
                <th className="px-5 py-2.5 text-left font-medium w-40">Budget</th>
              </tr>
            </thead>
            <tbody>
              {taskStats.map(({ task, totalSeconds, estimatedHours: est, isRunning }) => {
                const tracked = totalSeconds / 3600
                const pct = est ? Math.min(100, Math.round((tracked / est) * 100)) : null
                const over = est ? tracked > est : false

                return (
                  <tr key={task.id} className="border-b border-border/50 last:border-0 hover:bg-muted/20">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        {isRunning && <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse shrink-0" />}
                        <span className={task.status === "DONE" ? "line-through text-muted-foreground" : ""}>
                          {task.title}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${
                        task.status === "DONE" ? "bg-emerald-500/15 text-emerald-600" :
                        task.status === "IN_PROGRESS" ? "bg-amber-500/15 text-amber-600" :
                        "bg-muted text-muted-foreground"
                      }`}>
                        {task.status === "DONE" ? "Terminé" : task.status === "IN_PROGRESS" ? "En cours" : "À faire"}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right text-muted-foreground">
                      {est ? fmtHours(est) : "—"}
                    </td>
                    <td className={`px-5 py-3 text-right font-medium ${over ? "text-red-500" : totalSeconds > 0 ? "" : "text-muted-foreground"}`}>
                      {totalSeconds > 0 ? fmtSeconds(totalSeconds) : "—"}
                    </td>
                    <td className="px-5 py-3">
                      {pct !== null ? (
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                            <div
                              className={`h-full rounded-full ${over ? "bg-red-500" : pct > 80 ? "bg-amber-500" : "bg-emerald-500"}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className={`text-xs w-8 text-right ${over ? "text-red-500 font-medium" : "text-muted-foreground"}`}>
                            {pct}%
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            {taskStats.length > 1 && (
              <tfoot>
                <tr className="border-t border-border bg-muted/20 text-xs font-medium">
                  <td className="px-5 py-2.5 text-muted-foreground" colSpan={2}>Total</td>
                  <td className="px-5 py-2.5 text-right text-muted-foreground">
                    {estimatedHours ? fmtHours(estimatedHours) : "—"}
                  </td>
                  <td className={`px-5 py-2.5 text-right ${isOver ? "text-red-500" : ""}`}>
                    {fmtSeconds(totalTrackedSeconds)}
                  </td>
                  <td className="px-5 py-2.5">
                    {budgetPercent !== null && (
                      <span className={isOver ? "text-red-500" : "text-muted-foreground"}>
                        {budgetPercent}%
                      </span>
                    )}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        )}
      </div>

      {/* Journal des entrées récentes */}
      <div className="rounded-xl border border-border/50 bg-card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Timer className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-semibold text-sm">Entrées récentes</h2>
          <div className="ml-auto flex items-center gap-3">
            <AddTimeEntryDialog projectId={id} tasks={taskOptions} />
            {totalTrackedSeconds > 0 && (
              <a
                href={`/api/export/temps/${id}`}
                download
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                title="Exporter en CSV"
              >
                <Download className="h-3.5 w-3.5" />
                Export CSV
              </a>
            )}
          </div>
        </div>

        {taskStats.every((t) => t.entries.length === 0) ? (
          <p className="text-sm text-muted-foreground">Aucune entrée de temps enregistrée</p>
        ) : (
          <div className="space-y-1">
            {taskStats
              .flatMap((t) => t.entries.filter((e) => e.endedAt && e.duration).map((e) => ({ ...e, taskTitle: t.task.title })))
              .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
              .slice(0, 20)
              .map((entry) => (
                <div key={entry.id} className="flex items-center gap-3 py-1.5 group hover:bg-muted/20 rounded px-2 -mx-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{entry.taskTitle}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(entry.startedAt).toLocaleDateString("fr-FR", {
                        day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
                      })}
                      {entry.endedAt && ` → ${new Date(entry.endedAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`}
                    </p>
                  </div>
                  <span className="text-sm font-medium tabular-nums">
                    {fmtSeconds(entry.duration ?? 0)}
                  </span>
                  <form action={async () => {
                    "use server"
                    await deleteTimeEntry(entry.id, userId, id)
                  }}>
                    <button
                      type="submit"
                      className="text-muted-foreground hover:text-destructive md:opacity-0 md:group-hover:opacity-100 focus:opacity-100 transition-opacity"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </form>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  )
}
