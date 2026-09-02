"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Plus, X, Check } from "lucide-react"
import { toast } from "sonner"
import type { SkillFamily } from "@/generated/prisma/enums"
import { SKILL_FAMILIES, SKILL_FAMILY_LABEL } from "@/lib/tech-icons"
import { linkOrCreateProjectSkill, setProjectSkill, removeProjectSkill, patchSkill } from "@/actions/competences"
import { TechIcon } from "./TechIcon"

type LinkedSkill = { id: string; name: string; version: string | null; role: "USED" | "TO_ACQUIRE"; family: SkillFamily | null }

/**
 * Pastilles des compétences/technos d'un projet, groupées par famille, en tête de fiche.
 * Icône (Devicon local ou initiales) + nom + version. Dernière pastille en pointillé = ajout
 * (créé à la volée). Clic sur une pastille = éditer version + famille, ou retirer.
 */
export function ProjectSkillsBar({
  projectId, linked, allSkills,
}: {
  projectId: string
  linked: LinkedSkill[]
  allSkills: { id: string; name: string }[]
}) {
  const router = useRouter()
  const [isPending, start] = useTransition()
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState("")
  const [editing, setEditing] = useState<LinkedSkill | null>(null)

  const linkedIds = new Set(linked.map((s) => s.id))
  const suggestions = allSkills.filter((s) => !linkedIds.has(s.id))

  // Groupement par famille dans l'ordre défini ; les null → « Autre » (OTHER).
  const groups = SKILL_FAMILIES
    .map((f) => ({ ...f, items: linked.filter((s) => (s.family ?? "OTHER") === f.key) }))
    .filter((g) => g.items.length > 0)

  const add = () => {
    const n = name.trim()
    if (!n) return
    start(async () => {
      try { await linkOrCreateProjectSkill(projectId, n); setName(""); setAdding(false); router.refresh() }
      catch { toast.error("Ajout impossible") }
    })
  }
  const saveVersion = (s: LinkedSkill, version: string) =>
    start(async () => {
      try { await setProjectSkill(projectId, s.id, { version: version.trim() || null, role: s.role }); router.refresh() }
      catch { toast.error("Version non enregistrée") }
    })
  const saveFamily = (s: LinkedSkill, family: SkillFamily) =>
    start(async () => {
      try { await patchSkill(s.id, { family }); setEditing((e) => (e && e.id === s.id ? { ...e, family } : e)); router.refresh() }
      catch { toast.error("Famille non enregistrée") }
    })
  const remove = (s: LinkedSkill) =>
    start(async () => {
      try { await removeProjectSkill(projectId, s.id); if (editing?.id === s.id) setEditing(null); router.refresh() }
      catch { toast.error("Retrait impossible") }
    })

  return (
    <div className="rounded-xl border border-border/50 bg-card p-4 space-y-3">
      {groups.length === 0 && !adding && (
        <p className="text-xs text-muted-foreground italic">Aucune techno liée — ajoute la stack du projet (icône + version), par famille.</p>
      )}

      {groups.map((g) => (
        <div key={g.key} className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/70 w-full sm:w-auto">{g.label}</span>
          {g.items.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setEditing((e) => (e?.id === s.id ? null : s))}
              className="group inline-flex items-center gap-1.5 rounded-full border border-border bg-background pl-1 pr-2.5 py-0.5 text-xs hover:border-primary/40 transition-colors"
              title="Modifier (version, famille) ou retirer"
            >
              <TechIcon name={s.name} size={16} />
              <span className="font-medium">{s.name}</span>
              {s.version && <span className="text-muted-foreground tabular-nums">{s.version}</span>}
            </button>
          ))}
        </div>
      ))}

      {/* Ajout : pastille pointillée « + » puis champ créer-à-la-volée */}
      {adding ? (
        <div className="flex items-center gap-2">
          <input
            list={`pskills-bar-${projectId}`}
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add() } else if (e.key === "Escape") { setAdding(false); setName("") } }}
            placeholder="Techno (ex : Go, React, Docker…)"
            aria-label="Ajouter une techno au projet"
            className="h-8 w-56 max-w-full rounded-lg border border-input bg-transparent px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <datalist id={`pskills-bar-${projectId}`}>
            {suggestions.map((s) => <option key={s.id} value={s.name} />)}
          </datalist>
          <button onClick={add} disabled={isPending || !name.trim()} aria-label="Valider" className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-input text-primary hover:bg-muted disabled:opacity-50">
            <Check className="h-4 w-4" />
          </button>
          <button onClick={() => { setAdding(false); setName("") }} aria-label="Annuler" className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-input text-muted-foreground hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-border/70 bg-transparent px-2.5 py-1 text-xs text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors"
        >
          <Plus className="h-3.5 w-3.5" /> Ajouter une techno
        </button>
      )}

      {/* Éditeur inline de la pastille sélectionnée : version + famille + retrait */}
      {editing && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border/50 bg-muted/20 p-2.5 text-xs">
          <span className="inline-flex items-center gap-1.5 font-medium"><TechIcon name={editing.name} size={16} /> {editing.name}</span>
          <label className="flex items-center gap-1 text-muted-foreground">
            version
            <input
              defaultValue={editing.version ?? ""}
              onBlur={(e) => { if ((e.target.value.trim() || null) !== editing.version) saveVersion(editing, e.target.value) }}
              placeholder="ex : 1.23"
              className="h-7 w-24 rounded-md border border-input bg-transparent px-2 tabular-nums focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </label>
          <label className="flex items-center gap-1 text-muted-foreground">
            famille
            <select
              value={editing.family ?? "OTHER"}
              onChange={(e) => saveFamily(editing, e.target.value as SkillFamily)}
              className="h-7 rounded-md border border-input bg-transparent px-1.5 focus:outline-none focus:ring-1 focus:ring-ring"
            >
              {SKILL_FAMILIES.map((f) => <option key={f.key} value={f.key}>{SKILL_FAMILY_LABEL[f.key]}</option>)}
            </select>
          </label>
          <button onClick={() => remove(editing)} disabled={isPending} className="ml-auto inline-flex items-center gap-1 rounded-md px-2 py-1 text-destructive hover:bg-destructive/10 disabled:opacity-50">
            <X className="h-3.5 w-3.5" /> Retirer
          </button>
          <button onClick={() => setEditing(null)} className="inline-flex items-center rounded-md border border-input px-2 py-1 text-muted-foreground hover:bg-muted">
            Fermer
          </button>
        </div>
      )}
    </div>
  )
}
