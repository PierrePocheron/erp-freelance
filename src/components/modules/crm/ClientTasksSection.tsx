"use client"

import { useState, useTransition, useRef } from "react"
import {
  CheckCircle2, Circle, PlayCircle, Loader2,
  AlertTriangle, Pencil, Trash2, Plus, ChevronDown, ChevronRight,
} from "lucide-react"
import { startTask, completeTask, reopenTask, deleteTask, updateTaskFields, createClientTask } from "@/actions/projet"
import { TaskEditSheet, type TaskForEdit } from "@/components/modules/taches/TaskEditSheet"
import { cn } from "@/lib/utils"

type Tag = { id: string; name: string; color: string }
type ProjectRef = { id: string; name: string }

type ClientTask = {
  id: string
  title: string
  description: string | null
  status: "TODO" | "IN_PROGRESS" | "DONE"
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT"
  importance: number
  estimatedHours: number | null
  dueDate: Date | null
  startedAt: Date | null
  completedAt: Date | null
  project: ProjectRef | null
  taskTags: Tag[]
  _count: { subTasks: number }
}

function isOverdue(task: ClientTask) {
  return task.dueDate && task.status !== "DONE" && new Date(task.dueDate) < new Date()
}

// ── Task Row ──────────────────────────────────────────────────────────────────

function TaskRow({ task }: { task: ClientTask }) {
  const [isPending, startTransitionFn] = useTransition()
  const [isDeleting, startDeleteTransition] = useTransition()
  const [isSavingTitle, startTitleTransition] = useTransition()
  const [editOpen, setEditOpen] = useState(false)
  const [editingTitle, setEditingTitle] = useState(false)
  const titleRef = useRef<HTMLInputElement>(null)
  const overdue = isOverdue(task)
  const projectId = task.project?.id ?? ""

  const STATUS_CYCLE = {
    TODO: "start" as const,
    IN_PROGRESS: "complete" as const,
    DONE: "reopen" as const,
  }

  function handleStatus() {
    const action = STATUS_CYCLE[task.status]
    startTransitionFn(() => {
      if (action === "start") return startTask(task.id, projectId)
      if (action === "complete") return completeTask(task.id, projectId)
      if (action === "reopen") return reopenTask(task.id, projectId)
    })
  }

  function handleDelete() {
    startDeleteTransition(() => deleteTask(task.id))
  }

  function saveTitle() {
    const val = titleRef.current?.value.trim()
    if (val && val !== task.title) startTitleTransition(() => updateTaskFields(task.id, { title: val }))
    setEditingTitle(false)
  }

  const taskForEdit: TaskForEdit = {
    id: task.id,
    title: task.title,
    description: task.description,
    priority: task.priority,
    importance: task.importance,
    estimatedHours: task.estimatedHours,
    dueDate: task.dueDate,
  }

  return (
    <>
      <div className={cn(
        "flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-muted/40 transition-colors group",
        task.status === "DONE" && "opacity-50"
      )}>
        {/* Statut */}
        <button onClick={handleStatus} disabled={isPending} className="shrink-0 transition-colors">
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : task.status === "DONE" ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          ) : task.status === "IN_PROGRESS" ? (
            <PlayCircle className="h-4 w-4 text-amber-500 hover:text-emerald-500" />
          ) : (
            <Circle className="h-4 w-4 text-muted-foreground hover:text-amber-500" />
          )}
        </button>

        {/* Titre */}
        {editingTitle ? (
          <input
            ref={titleRef}
            defaultValue={task.title}
            autoFocus
            onBlur={saveTitle}
            onKeyDown={(e) => { if (e.key === "Enter") saveTitle(); if (e.key === "Escape") setEditingTitle(false) }}
            className="flex-1 text-sm bg-transparent border-b border-primary outline-none min-w-0"
          />
        ) : (
          <span
            onClick={() => task.status !== "DONE" && setEditingTitle(true)}
            className={cn(
              "flex-1 text-sm truncate transition-colors min-w-0",
              task.status === "DONE"
                ? "line-through text-muted-foreground cursor-default"
                : "cursor-text hover:text-primary",
              isSavingTitle && "animate-pulse opacity-50"
            )}
          >
            {task.title}
          </span>
        )}

        {/* Projet source (si tâche de projet) */}
        {task.project && (
          <span className="text-xs text-muted-foreground shrink-0 hidden sm:inline truncate max-w-[80px]">
            {task.project.name}
          </span>
        )}

        {/* Échéance */}
        {task.dueDate && task.status !== "DONE" && (
          <span className={cn("text-xs shrink-0", overdue ? "text-red-500 font-medium" : "text-muted-foreground")}>
            {overdue && <AlertTriangle className="h-3 w-3 inline mr-0.5" />}
            {new Date(task.dueDate).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
          </span>
        )}
        {task.status === "DONE" && task.completedAt && (
          <span className="text-xs text-emerald-600 shrink-0">
            ✓ {new Date(task.completedAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
          </span>
        )}

        {/* Actions (hover) */}
        <button
          onClick={() => setEditOpen(true)}
          title="Modifier"
          className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={handleDelete}
          disabled={isDeleting}
          title="Supprimer"
          className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-red-500 disabled:opacity-30"
        >
          {isDeleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
        </button>
      </div>

      <TaskEditSheet task={taskForEdit} open={editOpen} onOpenChange={setEditOpen} />
    </>
  )
}

// ── Quick add ──────────────────────────────────────────────────────────────────

function QuickAdd({ clientId }: { clientId: string }) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransitionFn] = useTransition()
  const inputRef = useRef<HTMLInputElement>(null)
  const dateRef = useRef<HTMLInputElement>(null)

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const title = inputRef.current?.value.trim()
    if (!title) return
    const dueDate = dateRef.current?.value || null
    startTransitionFn(async () => {
      await createClientTask(clientId, title, dueDate)
      if (inputRef.current) inputRef.current.value = ""
      if (dateRef.current) dateRef.current.value = ""
      inputRef.current?.focus()
    })
  }

  if (!open) return (
    <button
      onClick={() => { setOpen(true); setTimeout(() => inputRef.current?.focus(), 30) }}
      className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors py-1 px-3"
    >
      <Plus className="h-3.5 w-3.5" /> Nouvelle tâche...
    </button>
  )

  return (
    <form onSubmit={submit} className="flex gap-2 items-center px-2 py-1">
      <input
        ref={inputRef}
        autoFocus
        placeholder="Titre de la tâche..."
        className="flex-1 h-8 text-sm px-2 rounded-md border border-border bg-background focus:outline-none focus:ring-1 focus:ring-ring"
        onKeyDown={(e) => { if (e.key === "Escape") setOpen(false) }}
      />
      <input
        ref={dateRef}
        type="date"
        title="Échéance (optionnelle)"
        className="h-8 text-sm px-2 rounded-md border border-border bg-background text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        onKeyDown={(e) => { if (e.key === "Escape") setOpen(false) }}
      />
      <button type="submit" disabled={isPending} className="h-8 px-3 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
        {isPending ? "…" : "↵"}
      </button>
      <button type="button" onClick={() => setOpen(false)} className="h-8 px-2 text-sm rounded-md text-muted-foreground hover:text-foreground">✕</button>
    </form>
  )
}

// ── ClientTasksSection ────────────────────────────────────────────────────────

export function ClientTasksSection({
  clientId,
  tasks,
}: {
  clientId: string
  tasks: ClientTask[]
}) {
  const [showDone, setShowDone] = useState(false)

  const activeTasks = tasks.filter((t) => t.status !== "DONE")
  const doneTasks = tasks
    .filter((t) => t.status === "DONE")
    .sort((a, b) => {
      const da = a.completedAt ? new Date(a.completedAt).getTime() : 0
      const db = b.completedAt ? new Date(b.completedAt).getTime() : 0
      return db - da
    })

  return (
    <div className="rounded-xl border border-border/50 bg-card overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-border/30">
        <h2 className="font-semibold text-sm">Tâches</h2>
        <span className="text-xs text-muted-foreground">{doneTasks.length}/{tasks.length} terminées</span>
      </div>

      <div className="px-2 py-2 space-y-0.5">
        {activeTasks.length === 0 && doneTasks.length === 0 && (
          <p className="text-xs text-muted-foreground px-3 py-2">Aucune tâche</p>
        )}

        {activeTasks.map((t) => <TaskRow key={t.id} task={t} />)}

        <div className="pt-1">
          <QuickAdd clientId={clientId} />
        </div>

        {doneTasks.length > 0 && (
          <div className="border-t border-border/20 pt-1 mt-1">
            <button
              type="button"
              onClick={() => setShowDone((v) => !v)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-3 py-1"
            >
              {showDone ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              Terminées ({doneTasks.length})
            </button>
            {showDone && (
              <div className="space-y-0.5 opacity-60">
                {doneTasks.map((t) => <TaskRow key={t.id} task={t} />)}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
