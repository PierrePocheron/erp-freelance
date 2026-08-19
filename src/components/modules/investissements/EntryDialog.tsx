"use client"

import { useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { updateEntry, deleteEntry } from "@/actions/investissements"

export type EntryForEdit = { id: string; date: string; capital: number; contribution: number; note: string | null }

function toLocalInput(iso: string): string {
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

export function EntryDialog({
  open, onOpenChange, entry,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  entry?: EntryForEdit
}) {
  const router = useRouter()
  const [capital, setCapital] = useState("")
  const [apport, setApport] = useState("")
  const [date, setDate] = useState("")
  const [note, setNote] = useState("")
  const [isPending, start] = useTransition()
  const [isDeleting, startDel] = useTransition()

  useEffect(() => {
    if (!open || !entry) return
    /* eslint-disable react-hooks/set-state-in-effect */
    setCapital(String(entry.capital))
    setApport(entry.contribution ? String(entry.contribution) : "")
    setDate(toLocalInput(entry.date))
    setNote(entry.note ?? "")
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [open, entry])

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!entry) return
    const cap = parseFloat(capital.replace(",", "."))
    if (!Number.isFinite(cap)) { toast.error("Capital invalide"); return }
    const contribRaw = apport.replace(",", ".").trim()
    const contrib = contribRaw ? parseFloat(contribRaw) : 0
    start(async () => {
      try {
        await updateEntry(entry.id, { capital: cap, contribution: Number.isFinite(contrib) ? contrib : 0, date: date || undefined, note: note.trim() || null })
        toast.success("Relevé mis à jour")
        onOpenChange(false)
        router.refresh()
      } catch { toast.error("Enregistrement impossible") }
    })
  }

  function remove() {
    if (!entry) return
    if (!window.confirm("Supprimer ce relevé ?")) return
    startDel(async () => {
      try {
        await deleteEntry(entry.id)
        toast.success("Relevé supprimé")
        onOpenChange(false)
        router.refresh()
      } catch { toast.error("Suppression impossible") }
    })
  }

  const inputCls = "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader><DialogTitle>Modifier le relevé</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <label className="space-y-1"><span className="text-xs text-muted-foreground">Capital total (€)</span>
              <input value={capital} onChange={(e) => setCapital(e.target.value)} inputMode="decimal" required className={inputCls} aria-label="Capital total" />
            </label>
            <label className="space-y-1"><span className="text-xs text-muted-foreground">dont apport (€)</span>
              <input value={apport} onChange={(e) => setApport(e.target.value)} inputMode="decimal" placeholder="0" className={inputCls} aria-label="Apport" />
            </label>
          </div>
          <label className="block space-y-1"><span className="text-xs text-muted-foreground">Date</span>
            <input type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} aria-label="Date" />
          </label>
          <label className="block space-y-1"><span className="text-xs text-muted-foreground">Note</span>
            <input value={note} onChange={(e) => setNote(e.target.value)} className={inputCls} aria-label="Note" />
          </label>
          <div className="flex items-center justify-between gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={remove} disabled={isDeleting} className="text-red-600 hover:text-red-700">{isDeleting ? "…" : "Supprimer"}</Button>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>Annuler</Button>
              <Button type="submit" disabled={isPending}>{isPending ? "…" : "Enregistrer"}</Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
