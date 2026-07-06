"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Plus, Pencil, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog"
import { createMilestone, updateMilestone, deleteMilestone } from "@/actions/projet"

export const MILESTONE_TYPE_LABELS: Record<string, string> = {
  DEADLINE: "Échéance",
  MEETING: "Réunion",
  CALL: "Appel",
  APPOINTMENT: "Rendez-vous",
  ON_SITE: "Sur place",
  OTHER: "Autre",
}

export const MILESTONE_TYPE_COLORS: Record<string, string> = {
  DEADLINE: "bg-red-500/15 text-red-600 border-red-500/20",
  MEETING: "bg-blue-500/15 text-blue-600 border-blue-500/20",
  CALL: "bg-teal-500/15 text-teal-600 border-teal-500/20",
  APPOINTMENT: "bg-violet-500/15 text-violet-600 border-violet-500/20",
  ON_SITE: "bg-amber-500/15 text-amber-600 border-amber-500/20",
  OTHER: "bg-muted text-muted-foreground border-border",
}

export type MilestoneForEdit = {
  id: string
  name: string
  date: Date | string
  endDate: Date | string | null
  type: string
  status: "UPCOMING" | "IN_PROGRESS" | "DONE"
}

// Décompose une Date en { date: "YYYY-MM-DD", time: "HH:MM" } pour préremplir les inputs.
function toDateParts(d: Date | string | null): { date: string; time: string } {
  if (!d) return { date: "", time: "" }
  const dt = new Date(d)
  const date = dt.toISOString().slice(0, 10)
  const time = `${String(dt.getHours()).padStart(2, "0")}:${String(dt.getMinutes()).padStart(2, "0")}`
  return { date, time }
}

export function MilestoneDialog({ projectId, milestone }: { projectId: string; milestone?: MilestoneForEdit }) {
  const router = useRouter()
  const isEdit = !!milestone
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [isDeleting, startDelete] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const initialDate = milestone ? toDateParts(milestone.date) : { date: "", time: "" }
  const initialEnd  = milestone ? toDateParts(milestone.endDate) : { date: "", time: "" }

  const [name, setName]           = useState(milestone?.name ?? "")
  const [date, setDate]           = useState(initialDate.date)
  const [startTime, setStartTime] = useState(initialDate.time)
  const [endTime, setEndTime]     = useState(initialEnd.time)
  const [type, setType]           = useState(milestone?.type ?? "OTHER")

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!name.trim() || !date) return

    const dateObj = new Date(startTime ? `${date}T${startTime}:00` : `${date}T00:00:00`)
    const endDateObj = endTime ? new Date(`${date}T${endTime}:00`) : null
    if (endDateObj && endDateObj <= dateObj) {
      setError("L'heure de fin doit être après l'heure de début")
      return
    }

    startTransition(async () => {
      if (isEdit) {
        await updateMilestone(milestone.id, projectId, { name: name.trim(), date: dateObj, endDate: endDateObj, type })
      } else {
        await createMilestone(projectId, { name: name.trim(), date: dateObj, endDate: endDateObj, type })
      }
      setOpen(false)
      router.refresh()
    })
  }

  function handleDelete() {
    if (!milestone) return
    startDelete(async () => {
      await deleteMilestone(milestone.id, projectId)
      setOpen(false)
      router.refresh()
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {isEdit ? (
        <DialogTrigger
          render={<button className="text-muted-foreground hover:text-foreground transition-colors opacity-0 group-hover:opacity-100" title="Modifier" />}
        >
          <Pencil className="h-3.5 w-3.5" />
        </DialogTrigger>
      ) : (
        <DialogTrigger render={<Button size="sm" variant="outline" className="gap-1.5" />}>
          <Plus className="h-3.5 w-3.5" />
          Ajouter un jalon
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Modifier le jalon" : "Nouveau jalon"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Nom</label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="Livraison V1, réunion cadrage…" required />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Type</label>
            <select
              value={type}
              onChange={e => setType(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            >
              {Object.entries(MILESTONE_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Date</label>
            <Input type="date" value={date} onChange={e => setDate(e.target.value)} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Heure de début (optionnel)</label>
              <Input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Heure de fin (optionnel)</label>
              <Input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} />
            </div>
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}

          <div className="flex items-center justify-between pt-1">
            {isEdit ? (
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                className="flex items-center gap-1.5 text-xs text-red-600 hover:text-red-700 disabled:opacity-50 transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Supprimer
              </button>
            ) : <span />}
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>Annuler</Button>
              <Button type="submit" size="sm" disabled={isPending}>
                {isPending ? "Enregistrement…" : isEdit ? "Enregistrer" : "Ajouter"}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
