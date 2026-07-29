"use client"

import { useEffect, useId, useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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

type SkillLite = { id: string; name: string; type: string; parentId: string | null }

const selectCls = "h-9 w-full rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"

/**
 * Création / édition d'une compétence. Contrôlé par le parent (open/onOpenChange)
 * pour piloter aussi bien « + compétence », « + sous-compétence » que l'édition.
 * Le sélecteur « Rattachée à » présente l'arbre indenté et exclut le nœud lui-même
 * ET ses descendants (anti-cycle côté UI ; l'action serveur le rejette aussi).
 */
export function SkillDialog({
  open,
  onOpenChange,
  skillForEdit,
  defaultParentId,
  defaultType,
  allSkills,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  skillForEdit?: SkillForEdit
  defaultParentId?: string | null
  defaultType?: "HARD" | "SOFT"
  allSkills: SkillLite[]
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

  // Options de parent : arbre indenté, sans le nœud édité ni ses descendants (anti-cycle).
  const parentOptions = useMemo(() => {
    const childrenBy = new Map<string | null, SkillLite[]>()
    for (const s of allSkills) {
      const k = s.parentId
      if (!childrenBy.has(k)) childrenBy.set(k, [])
      childrenBy.get(k)!.push(s)
    }
    const excluded = new Set<string>()
    if (skillForEdit) {
      excluded.add(skillForEdit.id)
      const stack = [...(childrenBy.get(skillForEdit.id) ?? [])]
      while (stack.length) {
        const n = stack.pop()!
        if (excluded.has(n.id)) continue
        excluded.add(n.id)
        stack.push(...(childrenBy.get(n.id) ?? []))
      }
    }
    const out: { id: string; label: string }[] = []
    const walk = (pid: string | null, depth: number) => {
      for (const s of childrenBy.get(pid) ?? []) {
        if (!excluded.has(s.id)) out.push({ id: s.id, label: `${"  ".repeat(depth)}${s.name}` })
        walk(s.id, depth + 1)
      }
    }
    walk(null, 0)
    return out
  }, [allSkills, skillForEdit])

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    const input: SkillInput = {
      name: trimmed,
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
        toast.success(isEdit ? "Compétence enregistrée" : `« ${trimmed} » créée`)
        onOpenChange(false)
        router.refresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Enregistrement impossible")
      }
    })
  }

  function handleDelete() {
    if (!skillForEdit) return
    startDelete(async () => {
      try {
        await deleteSkill(skillForEdit.id)
        toast.success("Compétence supprimée")
        onOpenChange(false)
        router.refresh()
      } catch {
        toast.error("Suppression impossible")
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Modifier la compétence" : "Nouvelle compétence"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor={`${fid}-name`} className="text-xs text-muted-foreground">Nom *</Label>
            <Input id={`${fid}-name`} value={name} onChange={(e) => setName(e.target.value)} required
              placeholder="Ex : Spring, Kubernetes, Communication…" className="h-9" autoFocus />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor={`${fid}-type`} className="text-xs text-muted-foreground">Type</Label>
              <select id={`${fid}-type`} value={type} onChange={(e) => setType(e.target.value as "HARD" | "SOFT")} className={selectCls}>
                <option value="HARD">Technique (hard)</option>
                <option value="SOFT">Soft skill</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor={`${fid}-parent`} className="text-xs text-muted-foreground">Rattachée à</Label>
              <select id={`${fid}-parent`} value={parentId} onChange={(e) => setParentId(e.target.value)} className={selectCls}>
                <option value="">— Racine (catégorie) —</option>
                {parentOptions.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor={`${fid}-level`} className="text-xs text-muted-foreground">Mon niveau</Label>
              <select id={`${fid}-level`} value={level} onChange={(e) => setLevel(Number(e.target.value))} className={selectCls}>
                {SKILL_LEVELS.map((l) => <option key={l.value} value={l.value}>{l.value} · {l.label}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor={`${fid}-status`} className="text-xs text-muted-foreground">Statut</Label>
              <select id={`${fid}-status`} value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className={selectCls}>
                <option value="TO_ACQUIRE">À acquérir</option>
                <option value="LEARNING">En cours</option>
                <option value="MASTERED">Maîtrisée</option>
              </select>
            </div>
          </div>

          {type === "HARD" && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor={`${fid}-version`} className="text-xs text-muted-foreground">Version visée</Label>
                <Input id={`${fid}-version`} value={targetVersion} onChange={(e) => setTargetVersion(e.target.value)}
                  placeholder="Ex : 4.x" className="h-9" />
              </div>
              <div className="space-y-1">
                <Label htmlFor={`${fid}-years`} className="text-xs text-muted-foreground">Années d&apos;XP</Label>
                <Input id={`${fid}-years`} type="text" inputMode="decimal" value={years} onChange={(e) => setYears(e.target.value)}
                  placeholder="Ex : 2" className="h-9" />
              </div>
            </div>
          )}

          <div className="space-y-1">
            <Label htmlFor={`${fid}-notes`} className="text-xs text-muted-foreground">Notes / ressources</Label>
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
