"use client"

import { useState, useMemo, useTransition, useRef } from "react"
import Link from "next/link"
import {
  CheckCircle2, Circle, PlayCircle, Loader2,
  AlertTriangle, ChevronDown, ChevronRight, Plus, Trash2,
  Building2, FolderOpen, Pencil, Landmark,
} from "lucide-react"
import { startTask, completeTask, reopenTask, createClientTask, deleteTask, updateTaskFields } from "@/actions/projet"
import { AddTaskForm } from "@/components/modules/projet/AddTaskForm"
import { TaskEditSheet } from "@/components/modules/taches/TaskEditSheet"
import { cn } from "@/lib/utils"

// ── Types ────────────────────────────────────────────────────────────────────

type Tag = { id: string; name: string; color: string }
type ClientRef = { id: string; name: string; company: string | null }
type ProjectRef = { id: string; name: string; client: ClientRef | null }

type Task = {
  id: string
  title: string
  description: string | null
  status: "TODO" | "IN_PROGRESS" | "DONE"
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT"
  importance: number
  order: number
  estimatedHours: number | null
  dueDate: Date | null
  startedAt: Date | null
  completedAt: Date | null
  urssafPeriod: string | null
  project: ProjectRef | null
  client: ClientRef | null
  taskTags: Tag[]
  timeEntries: { id: string; duration: number | null }[]
  _count: { subTasks: number }
}

const PRIORITY_NUM: Record<string, number> = { LOW: 1, MEDIUM: 2, HIGH: 3, URGENT: 4 }
const BADGE_CLS: Record<number, string> = {
  1: "text-blue-400 border-blue-400/40 bg-blue-400/10",
  2: "text-amber-400 border-amber-400/40 bg-amber-400/10",
  3: "text-orange-500 border-orange-500/40 bg-orange-500/10",
  4: "text-red-500 border-red-500/40 bg-red-500/10",
}

const STATUS_CYCLE = {
  TODO: "start" as const,
  IN_PROGRESS: "complete" as const,
  DONE: "reopen" as const,
}

function isOverdue(task: Task) {
  return task.dueDate && task.status !== "DONE" && new Date(task.dueDate) < new Date()
}

function getWeekEnd() {
  const d = new Date()
  d.setDate(d.getDate() + (7 - d.getDay()))
  d.setHours(23, 59, 59, 999)
  return d
}

function getDueBucket(task: Task): "overdue" | "today" | "week" | "later" | "none" {
  if (!task.dueDate) return "none"
  const due = new Date(task.dueDate)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)
  if (task.status === "DONE") return "later"
  if (due < new Date()) return "overdue"
  if (due <= today) return "today"
  if (due <= getWeekEnd()) return "week"
  return "later"
}

/** Retourne le client effectif d'une tâche : direct > via projet */
function getEffectiveClient(task: Task): ClientRef | null {
  return task.client ?? task.project?.client ?? null
}

// ── Quick add for client tasks ────────────────────────────────────────────────

function QuickAddClientTask({ clientId }: { clientId: string | null }) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransitionFn] = useTransition()
  const inputRef = useRef<HTMLInputElement>(null)
  const dateRef  = useRef<HTMLInputElement>(null)

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const title = inputRef.current?.value.trim()
    if (!title) return
    const dueDate = dateRef.current?.value || null
    startTransitionFn(async () => {
      await createClientTask(clientId, title, dueDate)
      if (inputRef.current) inputRef.current.value = ""
      if (dateRef.current)  dateRef.current.value  = ""
      inputRef.current?.focus()
    })
  }

  if (!open) {
    return (
      <button
        onClick={() => { setOpen(true); setTimeout(() => inputRef.current?.focus(), 30) }}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors py-1 px-2"
      >
        <Plus className="h-3.5 w-3.5" />
        Nouvelle tâche...
      </button>
    )
  }

  return (
    <form onSubmit={submit} className="flex gap-2 items-center px-1 py-1">
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
      <button
        type="submit"
        disabled={isPending}
        className="h-8 px-3 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      >
        {isPending ? "…" : "↵"}
      </button>
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="h-8 px-2 text-sm rounded-md text-muted-foreground hover:text-foreground"
      >
        ✕
      </button>
    </form>
  )
}

// ── Types enrichis pour la vue client ────────────────────────────────────────

type ProjectTaskGroup = { project: ProjectRef; tasks: Task[] }
type ClientGroup = {
  key: string
  clientLabel: string
  clientId: string | null
  directTasks: Task[]
  projectGroups: ProjectTaskGroup[]
}

// ── TaskRow ───────────────────────────────────────────────────────────────────

function TaskRow({ task }: { task: Task }) {
  const [isPending, startTransitionFn] = useTransition()
  const [isDeleting, startDeleteTransition] = useTransition()
  const [isSavingTitle, startTitleTransition] = useTransition()
  const [editOpen, setEditOpen] = useState(false)
  const [editingTitle, setEditingTitle] = useState(false)
  const titleRef = useRef<HTMLInputElement>(null)
  const overdue = isOverdue(task)
  const projectId = task.project?.id ?? ""

  const totalTime = task.timeEntries.reduce((s, e) => s + (e.duration ?? 0), 0)
  const hours = Math.floor(totalTime / 3600)
  const mins = Math.floor((totalTime % 3600) / 60)
  const timeStr = totalTime > 0 ? (hours > 0 ? `${hours}h${mins > 0 ? mins : ""}` : `${mins}min`) : null

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

      {/* Lien vers la déclaration URSSAF liée — le statut de la tâche (fait/à faire)
          indique directement si la déclaration a été faite ou non. */}
      {task.urssafPeriod && (
        <Link
          href="/impots"
          title="Ouvrir la page Impôts"
          className="hidden sm:flex items-center gap-1 shrink-0 rounded-full border border-violet-500/30 bg-violet-500/10 px-1.5 py-0.5 text-[10px] font-medium text-violet-700 dark:text-violet-400 hover:bg-violet-500/20 transition-colors"
        >
          <Landmark className="h-3 w-3" />
          Impôts
        </Link>
      )}

      {/* Tags */}
      {task.taskTags.length > 0 && (
        <div className="hidden sm:flex items-center gap-1 shrink-0">
          {task.taskTags.map((tag) => (
            <span
              key={tag.id}
              className="rounded-full px-1.5 py-0.5 text-[10px] font-medium leading-none"
              style={{ backgroundColor: `${tag.color}22`, color: tag.color, border: `1px solid ${tag.color}44` }}
            >
              {tag.name}
            </span>
          ))}
        </div>
      )}

      {/* Sous-tâches */}
      {task._count.subTasks > 0 && (
        <span className="text-xs text-muted-foreground shrink-0 hidden sm:inline">
          +{task._count.subTasks}
        </span>
      )}

      {/* Temps tracké */}
      {timeStr && (
        <span className="text-xs text-muted-foreground shrink-0 hidden sm:inline font-mono">{timeStr}</span>
      )}

      {/* Échéance ou date de complétion */}
      {task.status === "DONE" && task.completedAt ? (
        <span className="text-xs text-emerald-600 shrink-0">
          ✓ {new Date(task.completedAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
        </span>
      ) : task.dueDate && task.status !== "DONE" ? (
        <span className={cn("text-xs shrink-0", overdue ? "text-red-500 font-medium" : "text-muted-foreground")}>
          {overdue && <AlertTriangle className="h-3 w-3 inline mr-0.5" />}
          {new Date(task.dueDate).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
        </span>
      ) : null}

      {/* Badges P/I */}
      <div className="flex items-center gap-1 shrink-0">
        <span className={cn("h-5 w-5 rounded border text-[10px] font-bold flex items-center justify-center", BADGE_CLS[PRIORITY_NUM[task.priority]])}>
          {PRIORITY_NUM[task.priority]}
        </span>
        <span className={cn("h-5 w-5 rounded border text-[10px] font-bold flex items-center justify-center", BADGE_CLS[Math.max(1, Math.min(4, task.importance))])}>
          {task.importance}
        </span>
      </div>

      {/* Modifier */}
      <button
        onClick={() => setEditOpen(true)}
        title="Modifier la tâche"
        className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
      >
        <Pencil className="h-3.5 w-3.5" />
      </button>

      {/* Supprimer */}
      <button
        onClick={handleDelete}
        disabled={isDeleting}
        title="Supprimer la tâche"
        className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-red-500 disabled:opacity-30"
      >
        {isDeleting
          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
          : <Trash2 className="h-3.5 w-3.5" />
        }
      </button>
    </div>

    <TaskEditSheet task={task} open={editOpen} onOpenChange={setEditOpen} />
    </>
  )
}

// ── ProjectSubGroup (carte projet imbriquée dans client) ─────────────────────

function ProjectSubGroup({ project, tasks }: { project: ProjectRef; tasks: Task[] }) {
  const [open, setOpen] = useState(true)
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
    <div className="rounded-lg border border-border/40 bg-muted/20 overflow-hidden">
      <div
        role="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted/30 transition-colors cursor-pointer select-none"
      >
        {open ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
        <FolderOpen className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <Link
          href={`/projets/${project.id}`}
          onClick={(e) => e.stopPropagation()}
          className="text-sm font-medium hover:text-primary hover:underline underline-offset-2 transition-colors truncate max-w-[60%]"
        >
          {project.name}
        </Link>
        <div className="flex-1" />
        <span className="text-xs text-muted-foreground shrink-0">{doneTasks.length}/{tasks.length}</span>
        {tasks.length > 0 && (
          <div className="w-14 h-1 rounded-full bg-muted overflow-hidden shrink-0">
            <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${(doneTasks.length / tasks.length) * 100}%` }} />
          </div>
        )}
      </div>

      {open && (
        <div className="px-1 pb-1 space-y-0.5 border-t border-border/20">
          {activeTasks.map((t) => <TaskRow key={t.id} task={t} />)}

          <div className="pt-0.5">
            <AddTaskForm projectId={project.id} placeholder="Nouvelle tâche..." />
          </div>

          {doneTasks.length > 0 && (
            <div className="mt-1 border-t border-border/20 pt-1">
              <button
                type="button"
                onClick={() => setShowDone((v) => !v)}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1"
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
      )}
    </div>
  )
}

// ── ClientTaskGroup (carte client avec tâches directes + projets imbriqués) ──

function ClientTaskGroup({ group }: { group: ClientGroup }) {
  const [open, setOpen] = useState(true)
  const [showDoneDirect, setShowDoneDirect] = useState(false)

  const activeDirect = group.directTasks.filter((t) => t.status !== "DONE")
  const doneDirect = group.directTasks
    .filter((t) => t.status === "DONE")
    .sort((a, b) => {
      const da = a.completedAt ? new Date(a.completedAt).getTime() : 0
      const db = b.completedAt ? new Date(b.completedAt).getTime() : 0
      return db - da
    })

  const totalTasks =
    group.directTasks.length +
    group.projectGroups.reduce((s, g) => s + g.tasks.length, 0)
  const totalDone =
    group.directTasks.filter((t) => t.status === "DONE").length +
    group.projectGroups.reduce((s, g) => s + g.tasks.filter((t) => t.status === "DONE").length, 0)

  return (
    <div className="rounded-xl border border-border/50 bg-card overflow-hidden">
      {/* En-tête client */}
      <div
        role="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-4 py-3 hover:bg-muted/30 transition-colors cursor-pointer select-none"
      >
        {open ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
        <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
        {group.clientId ? (
          <Link
            href={`/contacts/${group.clientId}`}
            onClick={(e) => e.stopPropagation()}
            className="font-semibold text-sm hover:text-primary hover:underline underline-offset-2 transition-colors truncate max-w-[60%]"
          >
            {group.clientLabel}
          </Link>
        ) : (
          <span className="font-semibold text-sm truncate max-w-[60%]">{group.clientLabel}</span>
        )}
        <div className="flex-1" />
        {group.projectGroups.length > 0 && (
          <span className="text-xs text-muted-foreground shrink-0 hidden sm:inline">
            {group.projectGroups.length} projet{group.projectGroups.length > 1 ? "s" : ""}
          </span>
        )}
        <span className="text-xs text-muted-foreground shrink-0">{totalDone}/{totalTasks}</span>
        {totalTasks > 0 && (
          <div className="w-20 h-1 rounded-full bg-muted overflow-hidden shrink-0">
            <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${(totalDone / totalTasks) * 100}%` }} />
          </div>
        )}
      </div>

      {open && (
        <div className="px-2 pb-2 space-y-2 border-t border-border/30">
          {/* Tâches directes du client */}
          {(activeDirect.length > 0 || group.directTasks.length === 0) && (
            <div className="space-y-0.5 pt-1">
              {activeDirect.map((t) => <TaskRow key={t.id} task={t} />)}

              <div className="pt-0.5">
                <QuickAddClientTask clientId={group.clientId} />
              </div>

              {doneDirect.length > 0 && (
                <div className="border-t border-border/20 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowDoneDirect((v) => !v)}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1"
                  >
                    {showDoneDirect ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                    Terminées ({doneDirect.length})
                  </button>
                  {showDoneDirect && (
                    <div className="space-y-0.5 opacity-60">
                      {doneDirect.map((t) => <TaskRow key={t.id} task={t} />)}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Tâches sans projet mais avec quick-add (cas où il n'y a que des tâches projet) */}
          {activeDirect.length === 0 && group.directTasks.length > 0 && (
            <div className="space-y-0.5 pt-1">
              <div className="pt-0.5">
                <QuickAddClientTask clientId={group.clientId} />
              </div>
            </div>
          )}

          {/* Sous-cartes projets */}
          {group.projectGroups.map((pg) => (
            <ProjectSubGroup key={pg.project.id} project={pg.project} tasks={pg.tasks} />
          ))}
        </div>
      )}
    </div>
  )
}

// ── GlobalTasksView ───────────────────────────────────────────────────────────

export function GlobalTasksView({
  tasks,
  allTags,
}: {
  tasks: Task[]
  allTags: Tag[]
}) {
  const [statusFilter, setStatusFilter] = useState<"ALL" | "TODO" | "IN_PROGRESS" | "DONE">("ALL")
  const [activeTagIds, setActiveTagIds] = useState<Set<string>>(new Set())
  const [dueDateFilter, setDueDateFilter] = useState<"ALL" | "OVERDUE" | "TODAY" | "WEEK" | "NONE">("ALL")

  function toggleTag(id: string) {
    setActiveTagIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) { next.delete(id) } else { next.add(id) }
      return next
    })
  }

  const filtered = useMemo(() => {
    return tasks.filter((t) => {
      if (statusFilter !== "ALL" && t.status !== statusFilter) return false
      if (activeTagIds.size > 0 && !t.taskTags.some((tag) => activeTagIds.has(tag.id))) return false
      if (dueDateFilter === "OVERDUE" && !isOverdue(t)) return false
      if (dueDateFilter === "TODAY") {
        if (!t.dueDate) return false
        const due = new Date(t.dueDate)
        const today = new Date(); today.setHours(23, 59, 59, 999)
        if (due > today || t.status === "DONE") return false
      }
      if (dueDateFilter === "WEEK") {
        if (!t.dueDate) return false
        if (getDueBucket(t) === "overdue") return false
        if (new Date(t.dueDate) > getWeekEnd()) return false
      }
      if (dueDateFilter === "NONE" && t.dueDate) return false
      return true
    })
  }, [tasks, statusFilter, activeTagIds, dueDateFilter])

  // Stats globales
  const todo = tasks.filter((t) => t.status === "TODO").length
  const inProgress = tasks.filter((t) => t.status === "IN_PROGRESS").length
  const done = tasks.filter((t) => t.status === "DONE").length
  const overdue = tasks.filter((t) => isOverdue(t)).length

  // Groupement client (vue imbriquée client → projets)
  const clientGroups = useMemo<ClientGroup[]>(() => {
    const byClient = new Map<string, ClientGroup>()

    for (const t of filtered) {
      const client = getEffectiveClient(t)
      const key = client?.id ?? "__no_client__"

      if (!byClient.has(key)) {
        const label = client
          ? (client.company ? `${client.company} — ${client.name}` : client.name)
          : "Sans client"
        byClient.set(key, { key, clientLabel: label, clientId: key === "__no_client__" ? null : key, directTasks: [], projectGroups: [] })
      }

      const group = byClient.get(key)!

      if (!t.project) {
        group.directTasks.push(t)
      } else {
        let pg = group.projectGroups.find((p) => p.project.id === t.project!.id)
        if (!pg) {
          pg = { project: t.project, tasks: [] }
          group.projectGroups.push(pg)
        }
        pg.tasks.push(t)
      }
    }

    return Array.from(byClient.values()).sort((a, b) => {
      if (a.key === "__no_client__") return 1
      if (b.key === "__no_client__") return -1
      return a.clientLabel.localeCompare(b.clientLabel)
    })
  }, [filtered])

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "À faire", value: todo, cls: "text-foreground" },
          { label: "En cours", value: inProgress, cls: "text-amber-500" },
          { label: "Terminées", value: done, cls: done > 0 ? "text-emerald-500" : "text-muted-foreground" },
          { label: "En retard", value: overdue, cls: overdue > 0 ? "text-red-500" : "text-muted-foreground" },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-border/50 bg-card px-4 py-3">
            <p className={cn("text-2xl font-bold tabular-nums", s.cls)}>{s.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filtres */}
      <div className="rounded-xl border border-border/50 bg-card p-4 space-y-3">
        <div className="flex flex-wrap gap-3 items-center">
          {/* Statut */}
          <div className="flex rounded-lg border border-border overflow-hidden text-xs">
            {(["ALL", "TODO", "IN_PROGRESS", "DONE"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={cn(
                  "px-3 py-1.5 border-r last:border-r-0 border-border transition-colors",
                  statusFilter === s ? "bg-accent font-medium" : "text-muted-foreground hover:bg-muted/50"
                )}
              >
                {s === "ALL" ? "Tous" : s === "TODO" ? "À faire" : s === "IN_PROGRESS" ? "En cours" : "Terminées"}
              </button>
            ))}
          </div>

          {/* Filtre date */}
          <select
            value={dueDateFilter}
            onChange={(e) => setDueDateFilter(e.target.value as typeof dueDateFilter)}
            className="text-xs border border-border rounded-lg px-2 py-1.5 bg-background text-foreground"
          >
            <option value="ALL">Toutes dates</option>
            <option value="OVERDUE">En retard</option>
            <option value="TODAY">{"Aujourd'hui"}</option>
            <option value="WEEK">Cette semaine</option>
            <option value="NONE">Sans échéance</option>
          </select>
        </div>

        {/* Tags */}
        {allTags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 items-center">
            {allTags.map((tag) => {
              const active = activeTagIds.has(tag.id)
              return (
                <button
                  key={tag.id}
                  onClick={() => toggleTag(tag.id)}
                  className={cn(
                    "flex items-center gap-1 rounded-full px-2 py-0.5 text-xs border transition-all",
                    active ? "opacity-100" : "opacity-50 hover:opacity-80"
                  )}
                  style={
                    active
                      ? { backgroundColor: `${tag.color}22`, color: tag.color, borderColor: `${tag.color}66` }
                      : { borderColor: `${tag.color}44`, color: tag.color }
                  }
                >
                  <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: tag.color }} />
                  {tag.name}
                </button>
              )
            })}
            {activeTagIds.size > 0 && (
              <button onClick={() => setActiveTagIds(new Set())} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                Effacer
              </button>
            )}
          </div>
        )}
      </div>

      {/* Résultat */}
      <p className="text-xs text-muted-foreground">{filtered.length} tâche{filtered.length !== 1 ? "s" : ""}</p>

      {/* Groupes */}
      <div className="space-y-3">
        {clientGroups.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border py-16 text-center text-sm text-muted-foreground">
            Aucune tâche pour ces filtres
          </div>
        ) : (
          clientGroups.map((g) => <ClientTaskGroup key={g.key} group={g} />)
        )}
      </div>
    </div>
  )
}
