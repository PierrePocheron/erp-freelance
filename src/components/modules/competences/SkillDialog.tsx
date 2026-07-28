"use client"

import { useEffect, useId, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { createSkill, updateSkill, deleteSkill, type SkillInput } from "@/actions/competences"
import { SKILL_LEVELS } from "./skill-config"

export type SkillForEdit = {
  id: string
  name: string
  type: "HARD" | "SOFT"
  level: number
  targetVersion: string | null
  status: "TO_ACQUIRE" | "LEARNING" | "MASTERED"
  yearsExperience: number | null
  notes: string | null
  parentId: string | null
}

type ParentOption = { id: string; name: string; type: string }

/**
 * Création / édition d'une compétence. Contrôlé par le parent (open/onOpenChange)
 * pour piloter aussi bien « + compétence », « + sous-compétence » que l'édition.
 */
export function SkillDialog({
  open,
  onOpenChange,
  skillForEdit,
  defaultParentId,
  defaultType,
  parents,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  skillForEdit?: SkillForEdit
  defaultParentId?: string | null
  defaultType?: "HARD" | "SOFT"
  parents: ParentOption[]
}) {
  const router = useRouter()
  const fid = useId()
  const isEdit = !!skillForEdit
  const [isPending, start] = useTransition()
  const [isDeleting, startDelete] = useTransition()

  const [name, setName] = useState("")
  const [type, setType] = useState<"HARD" | "SOFT">("HARD")
  const [parentId, setParentId] = useState("")
  const [level, setLevel] = useState(0)
  const [targetVersion, setTargetVersion] = useState("")
  const [status, setStatus] = useState<"TO_ACQUIRE" | "LEARNING" | "MASTERED">("TO_ACQUIRE")
  const [years, setYears] = useState("")
  const [notes, setNotes] = useState("")

  // Réinitialise le formulaire à chaque ouverture.
  useEffect(() => {
    if (!open) return
    /* eslint-disable react-hooks/set-state-in-effect */
    setName(skillForEdit?.name ?? "")
    setType(skillForEdit?.type ?? defaultType ?? "HARD")
    setParentId(skillForEdit?.parentId ?? defaultParentId ?? "")
    setLevel(skillForEdit?.level ?? 0)
    setTargetVersion(skillForEdit?.targetVersion ?? "")
    setStatus(skillForEdit?.status ?? "TO_ACQUIRE")
    setYears(skillForEdit?.yearsExperience != null ? String(skillForEdit.yearsExperience) : "")
    setNotes(skillForEdit?.notes ?? "")
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [open, skillForEdit, defaultParentId, defaultType])

  // Un nœud ne peut pas être son propre parent (les cycles plus profonds sont rares
  // et sans conséquence sur l'affichage — on garde le sélecteur simple).
  const parentOptions = parents.filter((p) => p.id !== skillForEdit?.id)

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    const input: SkillInput = {
      name: name.trim(),
      type,
      parentId: parentId || null,
      level,
      targetVersion: targetVersion.trim() || null,
      status,
      yearsExperience: years.trim() ? parseFloat(years.replace(",", ".")) : null,
      notes: notes.trim() || null,
    }
    start(async () => {
      try {
        if (isEdit) await updateSkill(skillForEdit!.id, input)
        else await createSkill(input)
        onOpenChange(false)
        router.refresh()
      } catch {
        toast.error("Enregistrement impossible")
      }
    })
  }

  function handleDelete() {
    if (!skillForEdit) return
    startDelete(async () => {
      try {
        await deleteSkill(skillForEdit.id)
        onOpenChange(false)
        router.refresh()
      } catch {
        toast.error("Suppression impossible")
      }
    })
  }

  const inputCls = "h-9 w-full rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Modifier la compétence" : "Nouvelle compétence"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1">
            <label htmlFor={`${fid}-name`} className="text-xs text-muted-foreground">Nom *</label>
            <input id={`${fid}-name`} value={name} onChange={(e) => setName(e.target.value)} required
              placeholder="Ex : Spring, Kubernetes, Communication…" className={inputCls} autoFocus />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label htmlFor={`${fid}-type`} className="text-xs text-muted-foreground">Type</label>
              <select id={`${fid}-type`} value={type} onChange={(e) => setType(e.target.value as "HARD" | "SOFT")} className={inputCls}>
                <option value="HARD">Technique (hard)</option>
                <option value="SOFT">Soft skill</option>
              </select>
            </div>
            <div className="space-y-1">
              <label htmlFor={`${fid}-parent`} className="text-xs text-muted-foreground">Rattachée à</label>
              <select id={`${fid}-parent`} value={parentId} onChange={(e) => setParentId(e.target.value)} className={inputCls}>
                <option value="">— Racine (catégorie) —</option>
                {parentOptions.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label htmlFor={`${fid}-level`} className="text-xs text-muted-foreground">Mon niveau</label>
              <select id={`${fid}-level`} value={level} onChange={(e) => setLevel(Number(e.target.value))} className={inputCls}>
                {SKILL_LEVELS.map((l) => <option key={l.value} value={l.value}>{l.value} · {l.label}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label htmlFor={`${fid}-status`} className="text-xs text-muted-foreground">Statut</label>
              <select id={`${fid}-status`} value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className={inputCls}>
                <option value="TO_ACQUIRE">À acquérir</option>
                <option value="LEARNING">En cours</option>
                <option value="MASTERED">Maîtrisée</option>
              </select>
            </div>
          </div>

          {type === "HARD" && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label htmlFor={`${fid}-version`} className="text-xs text-muted-foreground">Version visée</label>
                <input id={`${fid}-version`} value={targetVersion} onChange={(e) => setTargetVersion(e.target.value)}
                  placeholder="Ex : 4.x" className={inputCls} />
              </div>
              <div className="space-y-1">
                <label htmlFor={`${fid}-years`} className="text-xs text-muted-foreground">Années d&apos;XP</label>
                <input id={`${fid}-years`} type="text" inputMode="decimal" value={years} onChange={(e) => setYears(e.target.value)}
                  placeholder="Ex : 2" className={inputCls} />
              </div>
            </div>
          )}

          <div className="space-y-1">
            <label htmlFor={`${fid}-notes`} className="text-xs text-muted-foreground">Notes / ressources</label>
            <textarea id={`${fid}-notes`} value={notes} onChange={(e) => setNotes(e.target.value)} rows={3}
              placeholder="Points à travailler, liens, remarques…"
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring resize-none" />
          </div>

          <div className="flex items-center justify-between gap-2 pt-1">
            {isEdit ? (
              <Button type="button" variant="ghost" onClick={handleDelete} disabled={isDeleting || isPending}
                className="gap-1.5 text-muted-foreground hover:text-destructive">
                <Trash2 className="h-3.5 w-3.5" /> Supprimer
              </Button>
            ) : <span />}
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>Annuler</Button>
              <Button type="submit" disabled={isPending || !name.trim()}>{isEdit ? "Enregistrer" : "Créer"}</Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
