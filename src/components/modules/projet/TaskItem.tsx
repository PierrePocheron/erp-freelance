"use client"

import { useTransition, useState, useRef } from "react"
import {
  CheckCircle2, Circle, PlayCircle, Loader2, Trash2,
  ChevronUp, ChevronDown, ChevronRight, Flag, Plus, Pencil,
} from "lucide-react"
import { startTask, completeTask, reopenTask, deleteTask, updateTaskPriority, reorderTask, updateTaskTitle } from "@/actions/projet"
import { AddTaskForm } from "./AddTaskForm"
import { TimeTracker } from "./TimeTracker"
import { cn } from "@/lib/utils"

const priorityConfig = {
  LOW:    { label: "Basse",   className: "text-slate-400",   dotClass: "bg-slate-400" },
  MEDIUM: { label: "Moyenne", className: "text-blue-400",    dotClass: "bg-blue-400" },
  HIGH:   { label: "Haute",   className: "text-amber-500",   dotClass: "bg-amber-500" },
  URGENT: { label: "Urgente", className: "text-red-500",     dotClass: "bg-red-500" },
}

type SubTask = {
  id: string
  title: string
  status: "TODO" | "IN_PROGRESS" | "DONE"
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT"
  startedAt: Date | null
  completedAt: Date | null
}

type Task = {
  id: string
  title: string
  status: "TODO" | "IN_PROGRESS" | "DONE"
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT"
  order: number
  estimatedHours: number | null
  dueDate: Date | null
  startedAt: Date | null
  completedAt: Date | null
  subTasks: SubTask[]
  timeEntries?: { id: string; startedAt: Date; endedAt: Date | null; duration: number | null }[]
}

export function TaskItem({
  task,
  projectId,
  userId,
  isFirst,
  isLast,
}: {
  task: Task
  projectId: string
  userId?: string
  isFirst?: boolean
  isLast?: boolean
}) {
  const [isPending, startTransition] = useTransition()
  const [showSubs, setShowSubs] = useState(task.subTasks.length > 0)
  const [showPriorityMenu, setShowPriorityMenu] = useState(false)
  const [editingTitle, setEditingTitle] = useState(false)
  const titleRef = useRef<HTMLInputElement>(null)
  const p = priorityConfig[task.priority]

  function saveTitle() {
    const val = titleRef.current?.value.trim()
    if (val && val !== task.title) {
      startTransition(() => updateTaskTitle(task.id, projectId, val))
    }
    setEditingTitle(false)
  }

  const fmt = (d: Date | null) =>
    d ? new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "short" }) : null

  return (
    <div className={cn("rounded-lg border border-transparent hover:border-border/60 transition-all", task.status === "DONE" && "opacity-55")}>
      {/* Ligne principale */}
      <div className="flex items-center gap-2 px-2 py-2 group">

        {/* Ordre */}
        <div className="flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            disabled={isFirst || isPending}
            onClick={() => startTransition(() => reorderTask(task.id, projectId, "up"))}
            className="text-muted-foreground hover:text-foreground disabled:opacity-20"
          >
            <ChevronUp className="h-3 w-3" />
          </button>
          <button
            disabled={isLast || isPending}
            onClick={() => startTransition(() => reorderTask(task.id, projectId, "down"))}
            className="text-muted-foreground hover:text-foreground disabled:opacity-20"
          >
            <ChevronDown className="h-3 w-3" />
          </button>
        </div>

        {/* Statut */}
        {isPending ? (
          <Loader2 className="h-4 w-4 animate-spin shrink-0 text-muted-foreground" />
        ) : task.status === "DONE" ? (
          <button onClick={() => startTransition(() => reopenTask(task.id, projectId))} title="Rouvrir" className="shrink-0 text-emerald-500 hover:text-muted-foreground transition-colors">
            <CheckCircle2 className="h-4 w-4" />
          </button>
        ) : task.status === "IN_PROGRESS" ? (
          <button onClick={() => startTransition(() => completeTask(task.id, projectId))} title="Terminer" className="shrink-0 text-amber-500 hover:text-emerald-500 transition-colors">
            <PlayCircle className="h-4 w-4" />
          </button>
        ) : (
          <button onClick={() => startTransition(() => startTask(task.id, projectId))} title="Démarrer" className="shrink-0 text-muted-foreground hover:text-amber-500 transition-colors">
            <Circle className="h-4 w-4" />
          </button>
        )}

        {/* Titre */}
        {editingTitle ? (
          <input
            ref={titleRef}
            defaultValue={task.title}
            autoFocus
            onBlur={saveTitle}
            onKeyDown={(e) => { if (e.key === "Enter") saveTitle(); if (e.key === "Escape") setEditingTitle(false) }}
            className="flex-1 text-sm bg-transparent border-b border-primary outline-none"
          />
        ) : (
          <span
            onDoubleClick={() => task.status !== "DONE" && setEditingTitle(true)}
            className={cn("flex-1 text-sm cursor-default select-none", task.status === "DONE" && "line-through text-muted-foreground")}
          >
            {task.title}
          </span>
        )}

        {/* Time tracker */}
        {userId && task.status !== "DONE" && (
          <TimeTracker
            taskId={task.id}
            userId={userId}
            projectId={projectId}
            timeEntries={task.timeEntries ?? []}
          />
        )}

        {/* Infos */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {task.status === "IN_PROGRESS" && task.startedAt && (
            <span className="text-amber-500 font-medium">Démarré {fmt(task.startedAt)}</span>
          )}
          {task.status === "DONE" && task.completedAt && (
            <span className="text-emerald-600">Terminé {fmt(task.completedAt)}</span>
          )}
          {task.dueDate && task.status !== "DONE" && (
            <span className={cn(new Date(task.dueDate) < new Date() ? "text-red-500 font-medium" : "")}>
              ⏱ {fmt(task.dueDate)}
            </span>
          )}
          {task.estimatedHours && <span>{task.estimatedHours}h</span>}
        </div>

        {/* Priorité */}
        <div className="relative">
          <button
            onClick={() => setShowPriorityMenu((v) => !v)}
            title={`Priorité : ${p.label}`}
            className={cn("opacity-0 group-hover:opacity-100 transition-opacity", p.className)}
          >
            <Flag className="h-3.5 w-3.5" />
          </button>
          {showPriorityMenu && (
            <div className="absolute right-0 top-6 z-10 w-32 rounded-lg border border-border bg-popover p-1 shadow-md">
              {(["LOW", "MEDIUM", "HIGH", "URGENT"] as const).map((prio) => (
                <button
                  key={prio}
                  onClick={() => { startTransition(() => updateTaskPriority(task.id, projectId, prio)); setShowPriorityMenu(false) }}
                  className={cn("flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs hover:bg-accent", priorityConfig[prio].className)}
                >
                  <span className={cn("h-2 w-2 rounded-full", priorityConfig[prio].dotClass)} />
                  {priorityConfig[prio].label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Priorité dot (toujours visible) */}
        <span className={cn("h-2 w-2 rounded-full shrink-0", p.dotClass)} title={p.label} />

        {/* Expand sous-tâches */}
        {task.subTasks.length > 0 && (
          <button onClick={() => setShowSubs((v) => !v)} className="text-muted-foreground hover:text-foreground">
            <ChevronRight className={cn("h-3.5 w-3.5 transition-transform", showSubs && "rotate-90")} />
          </button>
        )}

        {/* Supprimer */}
        <button
          onClick={() => startTransition(() => deleteTask(task.id, projectId))}
          className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Sous-tâches */}
      {showSubs && (
        <div className="ml-8 border-l border-border/60 pl-3 pb-1 space-y-0.5">
          {task.subTasks.map((sub) => (
            <SubTaskItem key={sub.id} sub={sub} projectId={projectId} />
          ))}
          <AddTaskForm projectId={projectId} parentTaskId={task.id} placeholder="Ajouter une sous-tâche..." />
        </div>
      )}

      {/* Ajouter sous-tâche si pas encore de sous-tâches */}
      {!showSubs && task.status !== "DONE" && (
        <div className="ml-8 opacity-0 group-hover:opacity-100 transition-opacity pb-1">
          <button
            onClick={() => setShowSubs(true)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground px-2"
          >
            <Plus className="h-3 w-3" /> Sous-tâche
          </button>
        </div>
      )}
    </div>
  )
}

function SubTaskItem({ sub, projectId }: { sub: SubTask; projectId: string }) {
  const [isPending, startTransition] = useTransition()

  return (
    <div className={cn("flex items-center gap-2 py-1 px-2 rounded group/sub hover:bg-accent/50", sub.status === "DONE" && "opacity-55")}>
      {isPending ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
      ) : sub.status === "DONE" ? (
        <button onClick={() => startTransition(() => reopenTask(sub.id, projectId))} className="text-emerald-500 shrink-0">
          <CheckCircle2 className="h-3.5 w-3.5" />
        </button>
      ) : sub.status === "IN_PROGRESS" ? (
        <button onClick={() => startTransition(() => completeTask(sub.id, projectId))} className="text-amber-500 shrink-0">
          <PlayCircle className="h-3.5 w-3.5" />
        </button>
      ) : (
        <button onClick={() => startTransition(() => startTask(sub.id, projectId))} className="text-muted-foreground hover:text-amber-500 shrink-0">
          <Circle className="h-3.5 w-3.5" />
        </button>
      )}
      <span className={cn("flex-1 text-sm", sub.status === "DONE" && "line-through text-muted-foreground")}>
        {sub.title}
      </span>
      <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", priorityConfig[sub.priority].dotClass)} />
      <button
        onClick={() => startTransition(() => deleteTask(sub.id, projectId))}
        className="opacity-0 group-hover/sub:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
      >
        <Trash2 className="h-3 w-3" />
      </button>
    </div>
  )
}
