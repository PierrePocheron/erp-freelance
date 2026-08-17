"use client"

import { useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createPlatform, updatePlatform, deletePlatform } from "@/actions/investissements"
import { InvestmentTypeCombobox } from "./InvestmentTypeCombobox"

export type PlatformForEdit = { id: string; name: string; type: string; url: string | null; notes: string | null }

export function PlatformDialog({
  open, onOpenChange, platformForEdit, suggestions,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  platformForEdit?: PlatformForEdit
  suggestions?: string[]
}) {
  const router = useRouter()
  const isEdit = !!platformForEdit
  const [name, setName] = useState("")
  const [type, setType] = useState<string>("CROWDLENDING")
  const [url, setUrl] = useState("")
  const [notes, setNotes] = useState("")
  const [isPending, start] = useTransition()
  const [isDeleting, startDelete] = useTransition()

  useEffect(() => {
    if (!open) return
    /* eslint-disable react-hooks/set-state-in-effect */
    setName(platformForEdit?.name ?? "")
    setType(platformForEdit?.type ?? "CROWDLENDING")
    setUrl(platformForEdit?.url ?? "")
    setNotes(platformForEdit?.notes ?? "")
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [open, platformForEdit])

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { toast.error("Nom requis"); return }
    start(async () => {
      try {
        const input = { name, type, url: url.trim() || null, notes: notes.trim() || null }
        if (isEdit) await updatePlatform(platformForEdit!.id, input)
        else await createPlatform(input)
        toast.success(isEdit ? "Plateforme mise à jour" : "Plateforme ajoutée")
        onOpenChange(false)
        router.refresh()
      } catch {
        toast.error("Enregistrement impossible")
      }
    })
  }

  function remove() {
    if (!platformForEdit) return
    if (!window.confirm(`Supprimer « ${platformForEdit.name} » et tous ses relevés ?`)) return
    startDelete(async () => {
      try {
        await deletePlatform(platformForEdit.id)
        toast.success("Plateforme supprimée")
        onOpenChange(false)
        router.refresh()
      } catch {
        toast.error("Suppression impossible")
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>{isEdit ? "Modifier la plateforme" : "Nouvelle plateforme"}</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="pf-name">Nom *</Label>
            <Input id="pf-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="robo.cash" autoFocus required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pf-type">Type d&apos;investissement</Label>
            <InvestmentTypeCombobox id="pf-type" value={type} onChange={setType} suggestions={suggestions} />
            <p className="text-[11px] text-muted-foreground">Choisis un type ou tape un nouveau nom pour le créer.</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pf-url">Lien (optionnel)</Label>
            <Input id="pf-url" type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://robo.cash" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pf-notes">Notes</Label>
            <textarea
              id="pf-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={5}
              placeholder="Stratégie, taux cible, historique des apports, migration de plateforme…"
              className="flex min-h-[110px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-y"
            />
          </div>
          <div className="flex items-center justify-between gap-2 pt-1">
            {isEdit ? (
              <Button type="button" variant="ghost" onClick={remove} disabled={isDeleting} className="text-red-600 hover:text-red-700">
                {isDeleting ? "…" : "Supprimer"}
              </Button>
            ) : <span />}
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>Annuler</Button>
              <Button type="submit" disabled={isPending}>{isPending ? "…" : isEdit ? "Enregistrer" : "Créer"}</Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
