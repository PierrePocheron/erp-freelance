"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog"
import { createManualTimeEntry } from "@/actions/timetracking"

type TaskOption = { id: string; title: string }

export function AddTimeEntryDialog({ projectId, tasks }: { projectId: string; tasks: TaskOption[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [taskId, setTaskId] = useState(tasks[0]?.id ?? "")
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [startTime, setStartTime] = useState("09:00")
  const [endTime, setEndTime] = useState("10:00")
  const [note, setNote] = useState("")

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!taskId || !date || !startTime || !endTime) return
    const startedAt = new Date(`${date}T${startTime}:00`)
    const endedAt = new Date(`${date}T${endTime}:00`)
    startTransition(async () => {
      const res = await createManualTimeEntry(taskId, projectId, startedAt, endedAt, note || null)
      if (res.error) {
        setError(res.error)
        return
      }
      setOpen(false)
      setNote("")
      router.refresh()
    })
  }

  if (tasks.length === 0) return null

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" variant="outline" className="gap-1.5" />}>
        <Plus className="h-3.5 w-3.5" />
        Ajouter du temps
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Ajouter une session de temps</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Tâche</label>
            <select
              value={taskId}
              onChange={e => setTaskId(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            >
              {tasks.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Date</label>
            <Input type="date" value={date} onChange={e => setDate(e.target.value)} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Début</label>
              <Input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} required />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Fin</label>
              <Input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} required />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Note (optionnel)</label>
            <Input value={note} onChange={e => setNote(e.target.value)} placeholder="Précision sur la session…" />
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>Annuler</Button>
            <Button type="submit" size="sm" disabled={isPending}>
              {isPending ? "Enregistrement…" : "Ajouter"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
