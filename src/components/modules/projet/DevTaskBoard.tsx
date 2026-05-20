"use client"

import { useState, useCallback } from "react"
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { GripVertical, ChevronDown, ChevronRight } from "lucide-react"
import { reorderTasks } from "@/actions/projet"
import { TaskItem, type TaskShape, type TaskTag } from "./TaskItem"
import { AddTaskForm } from "./AddTaskForm"
import { cn } from "@/lib/utils"

// ── Sortable task wrapper ─────────────────────────────────────────────────────

function SortableTaskItem({
  task, projectId, userId, projectTags, onStatusChange,
}: {
  task: TaskShape; projectId: string; userId: string; projectTags: TaskTag[]
  onStatusChange?: (taskId: string, status: "TODO" | "IN_PROGRESS" | "DONE") => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { type: "task" },
  })

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(isDragging && "opacity-30")}
    >
      <div className="flex items-center group/drag">
        <button
          {...attributes}
          {...listeners}
          className="opacity-0 group-hover/drag:opacity-100 cursor-grab active:cursor-grabbing p-1 text-muted-foreground hover:text-foreground transition-opacity shrink-0 touch-none"
          title="Déplacer"
          tabIndex={-1}
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>
        <div className="flex-1 min-w-0">
          <TaskItem task={task} projectId={projectId} userId={userId} projectTags={projectTags} onStatusChange={onStatusChange} />
        </div>
      </div>
    </div>
  )
}

// ── DevTaskBoard ──────────────────────────────────────────────────────────────

export function DevTaskBoard({
  initialTasks,
  projectId,
  userId,
  projectTags,
}: {
  initialTasks: TaskShape[]
  projectId: string
  userId: string
  projectTags: TaskTag[]
}) {
  const [tasks, setTasks] = useState(initialTasks)
  const [activeTask, setActiveTask] = useState<TaskShape | null>(null)
  const [activeTagIds, setActiveTagIds] = useState<Set<string>>(new Set())
  const [showDone, setShowDone] = useState(false)

  const handleStatusChange = useCallback((taskId: string, status: "TODO" | "IN_PROGRESS" | "DONE") => {
    setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, status } : t))
  }, [])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  )

  function toggleTag(tagId: string) {
    setActiveTagIds((prev) => {
      const next = new Set(prev)
      next.has(tagId) ? next.delete(tagId) : next.add(tagId)
      return next
    })
  }

  const tagFiltered =
    activeTagIds.size === 0
      ? tasks
      : tasks.filter((t) => (t.taskTags ?? []).some((tag) => activeTagIds.has(tag.id)))

  const filtered = tagFiltered.filter((t) => t.status !== "DONE")
  const doneTasks = tagFiltered
    .filter((t) => t.status === "DONE")
    .sort((a, b) => {
      const da = a.completedAt ? new Date(a.completedAt).getTime() : 0
      const db = b.completedAt ? new Date(b.completedAt).getTime() : 0
      return db - da // plus récent en premier
    })

  function handleDragStart({ active }: DragStartEvent) {
    setActiveTask(filtered.find((t) => t.id === String(active.id)) ?? null)
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    setActiveTask(null)
    if (!over || active.id === over.id) return
    setTasks((prev) => {
      const activeIdx = prev.findIndex((t) => t.id === String(active.id))
      const overIdx = prev.findIndex((t) => t.id === String(over.id))
      if (activeIdx < 0 || overIdx < 0) return prev
      const next = arrayMove(prev, activeIdx, overIdx)
      void reorderTasks(projectId, next.map((t) => t.id))
      return next
    })
  }

  return (
    <div className="space-y-3">
      {/* Filtre tags */}
      {projectTags.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setActiveTagIds(new Set())}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium border transition-colors",
              activeTagIds.size === 0
                ? "bg-foreground text-background border-foreground"
                : "text-muted-foreground border-border hover:border-foreground/40"
            )}
          >
            Tous
          </button>
          {projectTags.map((tag) => {
            const active = activeTagIds.has(tag.id)
            return (
              <button
                key={tag.id}
                type="button"
                onClick={() => toggleTag(tag.id)}
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium border transition-all",
                  active ? "opacity-100" : "opacity-60 hover:opacity-90"
                )}
                style={
                  active
                    ? { backgroundColor: `${tag.color}22`, color: tag.color, borderColor: `${tag.color}66` }
                    : { borderColor: `${tag.color}44`, color: tag.color }
                }
              >
                <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: tag.color }} />
                {tag.name}
                {active && (
                  <span className="ml-0.5 text-[10px] opacity-70">
                    ({tasks.filter((t) => (t.taskTags ?? []).some((tt) => tt.id === tag.id)).length})
                  </span>
                )}
              </button>
            )
          })}
        </div>
      )}

      {/* Liste plate DnD */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={filtered.map((t) => t.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="rounded-xl border border-border/50 bg-card p-4 space-y-1">
            {filtered.length === 0 && (
              <p className="text-sm text-muted-foreground py-2 px-2">
                {activeTagIds.size > 0
                  ? "Aucune tâche active pour ce filtre"
                  : <>Utilisez{" "}<kbd className="bg-muted border border-border px-1 rounded font-mono text-[10px]">⌘↵</kbd>{" "}ou le bouton ci-dessous</>
                }
              </p>
            )}

            {filtered.map((t) => (
              <SortableTaskItem
                key={t.id}
                task={t}
                projectId={projectId}
                userId={userId}
                projectTags={projectTags}
                onStatusChange={handleStatusChange}
              />
            ))}

            <AddTaskForm
              projectId={projectId}
              placeholder="Nouvelle tâche..."
              isShortcutTarget
            />

            {/* Section tâches terminées */}
            {doneTasks.length > 0 && (
              <div className="mt-2 border-t border-border/40 pt-2">
                <button
                  type="button"
                  onClick={() => setShowDone((v) => !v)}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-1 py-1 w-full"
                >
                  {showDone ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                  <span>Terminées ({doneTasks.length})</span>
                </button>
                {showDone && (
                  <div className="mt-1 space-y-0.5 opacity-60">
                    {doneTasks.map((t) => (
                      <div key={t.id} className="flex items-center">
                        <div className="w-5 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <TaskItem task={t} projectId={projectId} userId={userId} projectTags={projectTags} onStatusChange={handleStatusChange} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </SortableContext>

        <DragOverlay>
          {activeTask && (
            <div className="rounded-lg border border-primary/40 bg-card shadow-xl px-3 py-2 text-sm font-medium opacity-95">
              {activeTask.title}
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </div>
  )
}
