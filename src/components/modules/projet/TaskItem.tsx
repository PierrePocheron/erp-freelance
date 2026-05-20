"use client"

import { useTransition, useState, useRef, useEffect } from "react"
import {
  CheckCircle2, Circle, PlayCircle, Loader2, Trash2,
  ChevronUp, ChevronDown, AlignLeft, Tag, X,
} from "lucide-react"
import {
  startTask, completeTask, reopenTask, deleteTask,
  updateTaskPriority, updateTaskImportance, reorderTask,
  updateTaskTitle, updateTaskDueDate, updateTaskCompletedAt, updateTaskDescription, updateTaskEstimatedHours,
  addTagToTask, removeTagFromTask,
} from "@/actions/projet"
import { AddTaskForm } from "./AddTaskForm"
import { TimeTracker } from "./TimeTracker"
import { cn } from "@/lib/utils"

// ── Priority / Importance badge config ──────────────────────────────────────

const PRIORITY_CYCLE = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const
type Priority = typeof PRIORITY_CYCLE[number]

const PRIORITY_NUM: Record<Priority, number> = { LOW: 1, MEDIUM: 2, HIGH: 3, URGENT: 4 }
const PRIORITY_FROM_NUM: Record<number, Priority> = { 1: "LOW", 2: "MEDIUM", 3: "HIGH", 4: "URGENT" }

const BADGE_CLS: Record<1 | 2 | 3 | 4, string> = {
  1: "text-blue-400 border-blue-400/40 bg-blue-400/10",
  2: "text-amber-400 border-amber-400/40 bg-amber-400/10",
  3: "text-orange-500 border-orange-500/40 bg-orange-500/10",
  4: "text-red-500 border-red-500/40 bg-red-500/10",
}

function MetricBadge({
  value,
  label,
  onClick,
  pending,
}: {
  value: number
  label: string
  onClick: () => void
  pending: boolean
}) {
  const n = Math.max(1, Math.min(4, value)) as 1 | 2 | 3 | 4
  return (
    <button
      type="button"
      title={`${label} : ${n}/4`}
      disabled={pending}
      onClick={onClick}
      className={cn(
        "h-5 w-5 rounded border text-[10px] font-bold flex items-center justify-center shrink-0 transition-colors",
        BADGE_CLS[n],
      )}
    >
      {n}
    </button>
  )
}

// ── Types ────────────────────────────────────────────────────────────────────

export type TaskTag = { id: string; name: string; color: string }

export type TaskShape = {
  id: string
  title: string
  description: string | null
  status: "TODO" | "IN_PROGRESS" | "DONE"
  priority: Priority
  importance: number
  order: number
  estimatedHours: number | null
  dueDate: Date | null
  startedAt: Date | null
  completedAt: Date | null
  isGroup?: boolean
  subTasks?: TaskShape[]
  taskTags?: TaskTag[]
  timeEntries?: { id: string; startedAt: Date; endedAt: Date | null; duration: number | null }[]
}

// ── TaskItem ─────────────────────────────────────────────────────────────────

export function TaskItem({
  task,
  projectId,
  userId,
  isFirst,
  isLast,
  projectTags = [],
  onStatusChange,
}: {
  task: TaskShape
  projectId: string
  userId?: string
  isFirst?: boolean
  isLast?: boolean
  projectTags?: TaskTag[]
  onStatusChange?: (taskId: string, status: "TODO" | "IN_PROGRESS" | "DONE") => void
}) {
  const [isPending, startTransition] = useTransition()
  const subs = task.subTasks ?? []
  const [showSubs, setShowSubs] = useState(subs.length > 0)
  const [editingTitle, setEditingTitle] = useState(false)
  const [editingDate, setEditingDate] = useState(false)
  const [editingHours, setEditingHours] = useState(false)
  const [editingCompletedAt, setEditingCompletedAt] = useState(false)
  const [showDescription, setShowDescription] = useState(!!task.description)
  const [showTagPicker, setShowTagPicker] = useState(false)
  const tagPickerRef = useRef<HTMLDivElement>(null)
  const completedAtRef = useRef<HTMLInputElement>(null)

  // Close tag picker on outside click
  useEffect(() => {
    if (!showTagPicker) return
    function handleClick(e: MouseEvent) {
      if (tagPickerRef.current && !tagPickerRef.current.contains(e.target as Node)) {
        setShowTagPicker(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [showTagPicker])

  const assignedTagIds = new Set((task.taskTags ?? []).map((t) => t.id))
  const titleRef = useRef<HTMLInputElement>(null)
  const dateRef = useRef<HTMLInputElement>(null)
  const hoursRef = useRef<HTMLInputElement>(null)
  const descRef = useRef<HTMLTextAreaElement>(null)

  function saveTitle() {
    const val = titleRef.current?.value.trim()
    if (val && val !== task.title) startTransition(() => updateTaskTitle(task.id, projectId, val))
    setEditingTitle(false)
  }

  function saveDate() {
    const val = dateRef.current?.value || null
    const current = task.dueDate ? new Date(task.dueDate).toISOString().split("T")[0] : null
    if (val !== current) startTransition(() => updateTaskDueDate(task.id, projectId, val))
    setEditingDate(false)
  }

  function saveHours() {
    const raw = hoursRef.current?.value
    const val = raw ? parseFloat(raw) : null
    if (val !== task.estimatedHours) startTransition(() => updateTaskEstimatedHours(task.id, projectId, val))
    setEditingHours(false)
  }

  function saveDescription() {
    const val = descRef.current?.value.trim() || null
    if (val !== task.description) startTransition(() => updateTaskDescription(task.id, projectId, val))
  }

  function saveCompletedAt() {
    const val = completedAtRef.current?.value || null
    const current = task.completedAt ? new Date(task.completedAt).toISOString().split("T")[0] : null
    if (val !== current) startTransition(() => updateTaskCompletedAt(task.id, projectId, val))
    setEditingCompletedAt(false)
  }

  function cyclePriority() {
    const idx = PRIORITY_CYCLE.indexOf(task.priority)
    const next = PRIORITY_FROM_NUM[((idx + 1) % 4) + 1]
    startTransition(() => updateTaskPriority(task.id, projectId, next))
  }

  function cycleImportance() {
    const next = (task.importance % 4) + 1
    startTransition(() => updateTaskImportance(task.id, projectId, next))
  }

  const fmt = (d: Date | null) =>
    d ? new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "short" }) : null

  return (
    <div className={cn("rounded-lg border border-transparent hover:border-border/60 transition-all", task.status === "DONE" && "opacity-55")}>
      {/* Ligne principale */}
      <div className="flex items-center gap-2 px-2 py-2 group">

        {/* Réordonner */}
        <div className="flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <button disabled={isFirst || isPending} onClick={() => startTransition(() => reorderTask(task.id, projectId, "up"))} className="text-muted-foreground hover:text-foreground disabled:opacity-20">
            <ChevronUp className="h-3 w-3" />
          </button>
          <button disabled={isLast || isPending} onClick={() => startTransition(() => reorderTask(task.id, projectId, "down"))} className="text-muted-foreground hover:text-foreground disabled:opacity-20">
            <ChevronDown className="h-3 w-3" />
          </button>
        </div>

        {/* Statut */}
        {isPending ? (
          <Loader2 className="h-4 w-4 animate-spin shrink-0 text-muted-foreground" />
        ) : task.status === "DONE" ? (
          <button onClick={() => { startTransition(() => reopenTask(task.id, projectId)); onStatusChange?.(task.id, "TODO") }} title="Rouvrir" className="shrink-0 text-emerald-500 hover:text-muted-foreground transition-colors">
            <CheckCircle2 className="h-4 w-4" />
          </button>
        ) : task.status === "IN_PROGRESS" ? (
          <button onClick={() => { startTransition(() => completeTask(task.id, projectId)); onStatusChange?.(task.id, "DONE") }} title="Terminer" className="shrink-0 text-amber-500 hover:text-emerald-500 transition-colors">
            <PlayCircle className="h-4 w-4" />
          </button>
        ) : (
          <button onClick={() => { startTransition(() => startTask(task.id, projectId)); onStatusChange?.(task.id, "IN_PROGRESS") }} title="Démarrer" className="shrink-0 text-muted-foreground hover:text-amber-500 transition-colors">
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
            className={cn("flex-1 text-sm cursor-default select-none truncate", task.status === "DONE" && "line-through text-muted-foreground")}
          >
            {task.title}
          </span>
        )}

        {/* Tags inline */}
        {(task.taskTags ?? []).length > 0 && (
          <div className="flex items-center gap-1 shrink-0">
            {(task.taskTags ?? []).map((tag) => (
              <span
                key={tag.id}
                className="flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-medium leading-none"
                style={{ backgroundColor: `${tag.color}22`, color: tag.color, border: `1px solid ${tag.color}44` }}
              >
                {tag.name}
                {task.status !== "DONE" && (
                  <button
                    type="button"
                    onClick={() => startTransition(() => removeTagFromTask(task.id, tag.id, projectId))}
                    className="ml-0.5 opacity-60 hover:opacity-100"
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                )}
              </span>
            ))}
          </div>
        )}

        {/* Tag picker */}
        {projectTags.length > 0 && task.status !== "DONE" && (
          <div className="relative shrink-0" ref={tagPickerRef}>
            <button
              type="button"
              onClick={() => setShowTagPicker((v) => !v)}
              className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
              title="Assigner un tag"
            >
              <Tag className="h-3.5 w-3.5" />
            </button>
            {showTagPicker && (
              <div className="absolute left-0 top-6 z-30 min-w-[140px] rounded-lg border border-border bg-popover shadow-lg p-1.5 space-y-0.5">
                {projectTags.map((tag) => {
                  const assigned = assignedTagIds.has(tag.id)
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => {
                        startTransition(() =>
                          assigned
                            ? removeTagFromTask(task.id, tag.id, projectId)
                            : addTagToTask(task.id, tag.id, projectId)
                        )
                      }}
                      className="flex items-center gap-2 w-full px-2 py-1 rounded hover:bg-muted/60 text-xs transition-colors"
                    >
                      <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: tag.color }} />
                      <span className="flex-1 text-left">{tag.name}</span>
                      {assigned && <span className="text-primary text-[10px]">✓</span>}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* Time tracker */}
        {userId && task.status !== "DONE" && (
          <TimeTracker taskId={task.id} userId={userId} projectId={projectId} timeEntries={task.timeEntries ?? []} />
        )}

        {/* Méta : démarré / terminé / échéance / heures / description */}
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
          {task.status === "IN_PROGRESS" && task.startedAt && (
            <span className="text-amber-500 font-medium hidden sm:inline">Démarré {fmt(task.startedAt)}</span>
          )}
          {task.status === "DONE" && (
            editingCompletedAt ? (
              <input
                ref={completedAtRef}
                type="date"
                defaultValue={task.completedAt ? new Date(task.completedAt).toISOString().split("T")[0] : ""}
                autoFocus
                onBlur={saveCompletedAt}
                onKeyDown={(e) => { if (e.key === "Enter") saveCompletedAt(); if (e.key === "Escape") setEditingCompletedAt(false) }}
                className="h-5 text-xs bg-transparent border-b border-emerald-500 outline-none w-28 text-emerald-600"
              />
            ) : (
              <button
                onClick={() => setEditingCompletedAt(true)}
                className="text-emerald-600 text-xs hidden sm:inline hover:underline"
                title="Modifier la date de complétion"
              >
                ✓ {task.completedAt ? fmt(task.completedAt) : "—"}
              </button>
            )
          )}
          {task.status !== "DONE" && (
            editingDate ? (
              <input ref={dateRef} type="date" defaultValue={task.dueDate ? new Date(task.dueDate).toISOString().split("T")[0] : ""} autoFocus onBlur={saveDate} onKeyDown={(e) => { if (e.key === "Enter") saveDate(); if (e.key === "Escape") setEditingDate(false) }} className="h-5 text-xs bg-transparent border-b border-primary outline-none w-28" />
            ) : (
              <button onClick={() => setEditingDate(true)} className={cn("opacity-0 group-hover:opacity-100 transition-opacity", task.dueDate ? (new Date(task.dueDate) < new Date() ? "text-red-500 font-medium !opacity-100" : "text-muted-foreground") : "text-muted-foreground")} title="Échéance">
                {task.dueDate ? `⏱ ${fmt(task.dueDate)}` : "⏱"}
              </button>
            )
          )}
          {task.status !== "DONE" && (
            editingHours ? (
              <input ref={hoursRef} type="number" min="0" step="0.5" defaultValue={task.estimatedHours ?? ""} autoFocus onBlur={saveHours} onKeyDown={(e) => { if (e.key === "Enter") saveHours(); if (e.key === "Escape") setEditingHours(false) }} className="h-5 text-xs bg-transparent border-b border-primary outline-none w-14" placeholder="0h" />
            ) : (
              <button onClick={() => setEditingHours(true)} className={cn("transition-opacity", task.estimatedHours ? "text-muted-foreground opacity-100" : "opacity-0 group-hover:opacity-100 text-muted-foreground")} title="Heures estimées">
                {task.estimatedHours ? `${task.estimatedHours}h` : "~h"}
              </button>
            )
          )}
          {task.status !== "DONE" && (
            <button onClick={() => setShowDescription((v) => !v)} className={cn("transition-opacity", task.description ? "text-muted-foreground opacity-100" : "opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground")} title="Description">
              <AlignLeft className={cn("h-3.5 w-3.5", showDescription && "text-primary")} />
            </button>
          )}
        </div>

        {/* P badge (priorité) */}
        <div className="flex items-center gap-1">
          <MetricBadge
            value={PRIORITY_NUM[task.priority]}
            label="Priorité"
            onClick={cyclePriority}
            pending={isPending}
          />
          <MetricBadge
            value={task.importance}
            label="Importance"
            onClick={cycleImportance}
            pending={isPending}
          />
        </div>

        {/* Supprimer */}
        <button onClick={() => startTransition(() => deleteTask(task.id, projectId))} className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive shrink-0">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Description */}
      {showDescription && task.status !== "DONE" && (
        <div className="ml-10 mr-2 pb-2">
          <textarea ref={descRef} defaultValue={task.description ?? ""} rows={2} placeholder="Ajouter une description..." onBlur={saveDescription} className="w-full text-sm text-muted-foreground bg-transparent resize-none outline-none placeholder:text-muted-foreground/50 leading-relaxed" />
        </div>
      )}

      {/* Sous-tâches (non-group children) */}
      {subs.length > 0 && showSubs && (
        <div className="ml-8 border-l border-border/60 pl-3 pb-1 space-y-0.5">
          {subs.map((sub, i) => (
            <TaskItem key={sub.id} task={sub} projectId={projectId} userId={userId} isFirst={i === 0} isLast={i === subs.length - 1} />
          ))}
          <AddTaskForm projectId={projectId} parentTaskId={task.id} placeholder="Ajouter une sous-tâche..." />
        </div>
      )}
    </div>
  )
}
