"use client"

import { useEffect, useId, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { CalendarClock } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { scheduleSkillWork } from "@/actions/competences"
import { toDateInput } from "@/lib/dates"

/** Bouton « Travailler cette compétence » → programme un créneau (tâche datée). */
export function SkillWorkButton({ skillId, skillName }: { skillId: string; skillName: string }) {
  const router = useRouter()
  const fid = useId()
  const [open, setOpen] = useState(false)
  const [isPending, start] = useTransition()
  const [date, setDate] = useState("")
  const [startTime, setStartTime] = useState("09:00")
  const [endTime, setEndTime] = useState("10:00")
  const [label, setLabel] = useState("")

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (open && !date) setDate(toDateInput(new Date()))
  }, [open, date])

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!date) return
    start(async () => {
      try {
        await scheduleSkillWork(skillId, { date, startTime, endTime: endTime || undefined, label: label.trim() || undefined })
        toast.success("Créneau ajouté à ton agenda")
        setOpen(false); setLabel("")
        router.refresh()
      } catch { toast.error("Impossible de programmer le créneau") }
    })
  }

  const inputCls = "h-9 w-full rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)} className="gap-1.5">
        <CalendarClock className="h-3.5 w-3.5" /> Travailler
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Travailler : {skillName}</DialogTitle></DialogHeader>
          <form onSubmit={submit} className="space-y-3">
            <div className="space-y-1">
              <label htmlFor={`${fid}-date`} className="text-xs text-muted-foreground">Jour</label>
              <input id={`${fid}-date`} type="date" value={date} onChange={(e) => setDate(e.target.value)} required className={inputCls} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label htmlFor={`${fid}-start`} className="text-xs text-muted-foreground">Début</label>
                <input id={`${fid}-start`} type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className={inputCls} />
              </div>
              <div className="space-y-1">
                <label htmlFor={`${fid}-end`} className="text-xs text-muted-foreground">Fin</label>
                <input id={`${fid}-end`} type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className={inputCls} />
              </div>
            </div>
            <div className="space-y-1">
              <label htmlFor={`${fid}-label`} className="text-xs text-muted-foreground">Sous-sujet (optionnel)</label>
              <input id={`${fid}-label`} value={label} onChange={(e) => setLabel(e.target.value)}
                placeholder="Ex : Migration 3.5 → 4.x" className={inputCls} />
            </div>
            <div className="flex items-center justify-end gap-2 pt-1">
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isPending}>Annuler</Button>
              <Button type="submit" disabled={isPending || !date}>Programmer</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
