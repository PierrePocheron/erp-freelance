"use client"

import { useTransition } from "react"
import { CheckCircle2, Circle, Loader2, Trash2, ChevronRight } from "lucide-react"
import { updateTaskStatus, deleteTask } from "@/actions/projet"
import { cn } from "@/lib/utils"

type Task = {
  id: string
  title: string
  status: "TODO" | "IN_PROGRESS" | "DONE"
  estimatedHours: number | null
  dueDate: Date | null
  subTasks: { id: string; title: string; status: "TODO" | "IN_PROGRESS" | "DONE" }[]
}

export function TaskItem({ task, projectId }: { task: Task; projectId: string }) {
  const [isPending, startTransition] = useTransition()

  const cycleStatus = () => {
    const next =
      task.status === "TODO" ? "IN_PROGRESS"
      : task.status === "IN_PROGRESS" ? "DONE"
      : "TODO"
    startTransition(() => updateTaskStatus(task.id, projectId, next))
  }

  const handleDelete = () => {
    startTransition(() => deleteTask(task.id, projectId))
  }

  return (
    <div className={cn("group space-y-1", task.status === "DONE" && "opacity-60")}>
      <div className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-accent/50 transition-colors">
        <button onClick={cycleStatus} disabled={isPending} className="shrink-0 text-muted-foreground hover:text-primary transition-colors">
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : task.status === "DONE" ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          ) : task.status === "IN_PROGRESS" ? (
            <ChevronRight className="h-4 w-4 text-amber-500" />
          ) : (
            <Circle className="h-4 w-4" />
          )}
        </button>
        <span className={cn("flex-1 text-sm", task.status === "DONE" && "line-through text-muted-foreground")}>
          {task.title}
        </span>
        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          {task.estimatedHours && (
            <span className="text-xs text-muted-foreground">{task.estimatedHours}h</span>
          )}
          {task.dueDate && (
            <span className="text-xs text-muted-foreground">
              {new Date(task.dueDate).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
            </span>
          )}
          <button onClick={handleDelete} className="text-muted-foreground hover:text-destructive transition-colors">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      {task.subTasks.length > 0 && (
        <div className="ml-6 space-y-0.5">
          {task.subTasks.map((sub) => (
            <div key={sub.id} className="flex items-center gap-2 py-1 px-2 rounded-lg hover:bg-accent/50 group/sub">
              <button
                onClick={() => startTransition(() => updateTaskStatus(sub.id, projectId, sub.status === "DONE" ? "TODO" : "DONE"))}
                className="shrink-0 text-muted-foreground hover:text-primary"
              >
                {sub.status === "DONE"
                  ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                  : <Circle className="h-3.5 w-3.5" />}
              </button>
              <span className={cn("text-sm", sub.status === "DONE" && "line-through text-muted-foreground")}>
                {sub.title}
              </span>
              <button
                onClick={() => startTransition(() => deleteTask(sub.id, projectId))}
                className="ml-auto text-muted-foreground hover:text-destructive opacity-0 group-hover/sub:opacity-100 transition-opacity"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
