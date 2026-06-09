"use client"

import { useState, useEffect, useTransition } from "react"
import { Loader2 } from "lucide-react"
import { updateTaskFields } from "@/actions/projet"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const PRIORITY_LABELS: Record<string, string> = { LOW: "Basse", MEDIUM: "Moyenne", HIGH: "Haute", URGENT: "Urgente" }
const PRIORITY_CLS: Record<string, string> = {
  LOW: "border-blue-400/60 text-blue-400 bg-blue-400/10",
  MEDIUM: "border-amber-400/60 text-amber-400 bg-amber-400/10",
  HIGH: "border-orange-500/60 text-orange-500 bg-orange-500/10",
  URGENT: "border-red-500/60 text-red-500 bg-red-500/10",
}

export type TaskForEdit = {
  id: string
  title: string
  description: string | null
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT"
  importance: number
  estimatedHours: number | null
  dueDate: Date | null
}

export function TaskEditSheet({ task, open, onOpenChange }: {
  task: TaskForEdit
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const [isPending, startTransitionFn] = useTransition()
  const [title, setTitle] = useState(task.title)
  const [description, setDescription] = useState(task.description ?? "")
  const [dueDate, setDueDate] = useState(
    task.dueDate ? new Date(task.dueDate).toISOString().split("T")[0] : ""
  )
  const [priority, setPriority] = useState(task.priority)
  const [importance, setImportance] = useState(task.importance)
  const [estimatedHours, setEstimatedHours] = useState(task.estimatedHours?.toString() ?? "")

  useEffect(() => {
    if (!open) return
    /* eslint-disable react-hooks/set-state-in-effect */
    setTitle(task.title)
    setDescription(task.description ?? "")
    setDueDate(task.dueDate ? new Date(task.dueDate).toISOString().split("T")[0] : "")
    setPriority(task.priority)
    setImportance(task.importance)
    setEstimatedHours(task.estimatedHours?.toString() ?? "")
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [open, task.id]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleSave() {
    startTransitionFn(async () => {
      await updateTaskFields(task.id, {
        title: title.trim() || task.title,
        description: description.trim() || null,
        dueDate: dueDate || null,
        priority,
        importance,
        estimatedHours: estimatedHours ? parseFloat(estimatedHours) : null,
      })
      onOpenChange(false)
    })
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex flex-col sm:max-w-md p-0">
        <SheetHeader className="px-6 pt-6 pb-4 border-b border-border/50">
          <SheetTitle>Modifier la tâche</SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Titre</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Ajouter une description..."
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground/50"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Échéance</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Heures est.</label>
              <input
                type="number"
                min="0"
                step="0.5"
                value={estimatedHours}
                onChange={(e) => setEstimatedHours(e.target.value)}
                placeholder="0"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Priorité</label>
            <div className="flex gap-2">
              {(["LOW", "MEDIUM", "HIGH", "URGENT"] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPriority(p)}
                  className={cn(
                    "flex-1 rounded-lg border py-1.5 text-xs font-medium transition-all",
                    priority === p ? PRIORITY_CLS[p] : "border-border text-muted-foreground hover:bg-muted/50"
                  )}
                >
                  {PRIORITY_LABELS[p]}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Importance</label>
            <div className="flex gap-2">
              {[1, 2, 3, 4].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setImportance(n)}
                  className={cn(
                    "flex-1 rounded-lg border py-1.5 text-xs font-bold transition-all",
                    importance === n ? PRIORITY_CLS[Object.keys(PRIORITY_CLS)[n - 1]] : "border-border text-muted-foreground hover:bg-muted/50"
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        </div>

        <SheetFooter className="px-6 py-4 border-t border-border/50">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending} className="flex-1">
            Annuler
          </Button>
          <Button onClick={handleSave} disabled={isPending} className="flex-1">
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enregistrer"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
