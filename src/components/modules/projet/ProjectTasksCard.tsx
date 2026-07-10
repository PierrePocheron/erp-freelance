"use client"

import { useTransition, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { CheckSquare, CheckCircle2, Circle, Loader2, PlayCircle } from "lucide-react"
import { completeTask, reopenTask } from "@/actions/projet"
import { cn } from "@/lib/utils"

type TaskRow = {
  id: string
  title: string
  status: string
  priority: string
  dueDate: Date | string | null
}

const PRIORITY_DOT: Record<string, string> = {
  URGENT: "bg-red-500",
  HIGH: "bg-orange-500",
  MEDIUM: "bg-amber-400",
  LOW: "bg-slate-300 dark:bg-slate-600",
}

function TaskToggle({ task, projectId }: { task: TaskRow; projectId: string }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function toggle() {
    startTransition(async () => {
      if (task.status === "DONE") await reopenTask(task.id, projectId)
      else await completeTask(task.id, projectId)
      router.refresh()
    })
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={isPending}
      title={task.status === "DONE" ? "Rouvrir" : "Marquer terminée"}
      className="shrink-0 text-muted-foreground hover:text-emerald-500 transition-colors disabled:opacity-70"
    >
      {isPending
        ? <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
        : task.status === "DONE"
          ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
          : task.status === "IN_PROGRESS"
            ? <PlayCircle className="h-3.5 w-3.5 text-amber-500" />
            : <Circle className="h-3.5 w-3.5" />}
    </button>
  )
}

/**
 * Carte Tâches du projet : progression + liste cochable en un clic
 * (même mécanique que la carte Jalons). Les terminées récentes restent
 * visibles en bas pour pouvoir les rouvrir.
 */
export function ProjectTasksCard({ tasks, projectId }: { tasks: TaskRow[]; projectId: string }) {
  const [showAllDone, setShowAllDone] = useState(false)

  const open = tasks.filter((t) => t.status !== "DONE" && t.status !== "CANCELLED")
  const done = tasks.filter((t) => t.status === "DONE")
  const total = open.length + done.length
  const visibleDone = showAllDone ? done : done.slice(0, 3)

  return (
    <div className="rounded-xl border border-border/50 bg-card p-5 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 font-semibold text-sm">
          <CheckSquare className="h-4 w-4 text-muted-foreground" />
          Tâches
          {total > 0 && (
            <span className="text-xs font-normal text-muted-foreground">{done.length}/{total}</span>
          )}
        </div>
        <Link href={`/projets/${projectId}/dev`} className="text-xs text-primary hover:underline shrink-0">
          Voir tout →
        </Link>
      </div>

      {total > 0 && (
        <div className="h-1 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all"
            style={{ width: `${Math.round((done.length / total) * 100)}%` }}
          />
        </div>
      )}

      {total === 0 ? (
        <p className="text-xs text-muted-foreground italic">Aucune tâche pour l&apos;instant</p>
      ) : (
        <div className="space-y-1.5">
          {open.map((t) => (
            <div key={t.id} className="flex items-center gap-2 py-1">
              <TaskToggle task={t} projectId={projectId} />
              <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", PRIORITY_DOT[t.priority] ?? PRIORITY_DOT.LOW)} title={`Priorité : ${t.priority}`} />
              <span className="flex-1 text-sm truncate min-w-0">{t.title}</span>
              {t.dueDate && (
                <span className={cn(
                  "shrink-0 text-xs whitespace-nowrap",
                  new Date(t.dueDate) < new Date() ? "text-red-500 font-medium" : "text-muted-foreground"
                )}>
                  {new Date(t.dueDate).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                </span>
              )}
            </div>
          ))}

          {visibleDone.length > 0 && (
            <>
              {open.length > 0 && <div className="border-t border-border/40 my-1" />}
              {visibleDone.map((t) => (
                <div key={t.id} className="flex items-center gap-2 py-1 opacity-60">
                  <TaskToggle task={t} projectId={projectId} />
                  <span className="flex-1 text-sm truncate min-w-0 line-through">{t.title}</span>
                </div>
              ))}
              {done.length > 3 && (
                <button
                  onClick={() => setShowAllDone((v) => !v)}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showAllDone ? "Réduire" : `+ ${done.length - 3} terminée${done.length - 3 > 1 ? "s" : ""}`}
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
