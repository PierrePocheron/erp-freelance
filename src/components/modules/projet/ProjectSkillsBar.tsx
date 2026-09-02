"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Plus, X, Check, Star } from "lucide-react"
import { toast } from "sonner"
import type { SkillFamily } from "@/generated/prisma/enums"
import { SKILL_FAMILIES, SKILL_FAMILY_LABEL, suggestFamily } from "@/lib/tech-icons"
import { linkOrCreateProjectSkill, setProjectSkill, removeProjectSkill, patchSkill } from "@/actions/competences"
import { TechIcon } from "./TechIcon"

type LinkedSkill = { id: string; name: string; version: string | null; role: "USED" | "TO_ACQUIRE"; family: SkillFamily | null; core: boolean }

const FAMILY_ORDER: Record<SkillFamily, number> = Object.fromEntries(
  SKILL_FAMILIES.map((f, i) => [f.key, i]),
) as Record<SkillFamily, number>

const famOf = (s: LinkedSkill): SkillFamily => s.family ?? "OTHER"

/**
 * Compétences/technos d'un projet, en tête de fiche, affichées PAR IMPORTANCE :
 *  1) « Stack principale » (core = framework/archi) — pastilles mises en avant ;
 *  2) « Outils & libs » — nuage coloré par famille (front/back/devops/sécu/BDD…).
 * Ajout via la pastille pointillée « + » (famille choisie, défaut auto). Clic sur une
 * pastille = éditer version/famille, (dé)marquer « stack », ou retirer.
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
  const [family, setFamily] = useState<"" | SkillFamily>("")
  const [editing, setEditing] = useState<LinkedSkill | null>(null)

  const linkedIds = new Set(linked.map((s) => s.id))
  const suggestions = allSkills.filter((s) => !linkedIds.has(s.id))

  const coreSkills = useMemo(
    () => linked.filter((s) => s.core).sort((a, b) => FAMILY_ORDER[famOf(a)] - FAMILY_ORDER[famOf(b)]),
    [linked],
  )
  const toolGroups = useMemo(
    () => SKILL_FAMILIES.map((f) => ({ ...f, items: linked.filter((s) => !s.core && famOf(s) === f.key) })).filter((g) => g.items.length > 0),
    [linked],
  )

  const add = () => {
    const n = name.trim()
    if (!n) return
    start(async () => {
      try {
        await linkOrCreateProjectSkill(projectId, n, family ? { family } : undefined)
        setName(""); setFamily(""); setAdding(false); router.refresh()
      } catch { toast.error("Ajout impossible") }
    })
  }
  const saveVersion = (s: LinkedSkill, version: string) =>
    start(async () => {
      try { await setProjectSkill(projectId, s.id, { version: version.trim() || null }); router.refresh() }
      catch { toast.error("Version non enregistrée") }
    })
  const saveFamily = (s: LinkedSkill, f: SkillFamily) =>
    start(async () => {
      try { await patchSkill(s.id, { family: f }); setEditing((e) => (e && e.id === s.id ? { ...e, family: f } : e)); router.refresh() }
      catch { toast.error("Famille non enregistrée") }
    })
  const toggleCore = (s: LinkedSkill) =>
    start(async () => {
      try { await setProjectSkill(projectId, s.id, { core: !s.core }); setEditing((e) => (e && e.id === s.id ? { ...e, core: !s.core } : e)); router.refresh() }
      catch { toast.error("Modification impossible") }
    })
  const remove = (s: LinkedSkill) =>
    start(async () => {
      try { await removeProjectSkill(projectId, s.id); if (editing?.id === s.id) setEditing(null); router.refresh() }
      catch { toast.error("Retrait impossible") }
    })

  // Pastille « stack principale » (Tier 1)
  const CorePastille = ({ s }: { s: LinkedSkill }) => (
    <button
      type="button"
      onClick={() => setEditing((e) => (e?.id === s.id ? null : s))}
      className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background pl-1 pr-2.5 py-0.5 text-xs hover:border-primary/40 transition-colors"
      title="Modifier (version, famille, stack) ou retirer"
    >
      <TechIcon name={s.name} size={18} />
      <span className="font-medium">{s.name}</span>
      {s.version && <span className="text-muted-foreground tabular-nums">{s.version}</span>}
    </button>
  )

  // Chip « outil/lib » (Tier 2), teinté par la couleur de famille
  const ToolChip = ({ s, color }: { s: LinkedSkill; color: string }) => (
    <button
      type="button"
      onClick={() => setEditing((e) => (e?.id === s.id ? null : s))}
      className="inline-flex items-center gap-1 rounded-full border pl-0.5 pr-2 py-0.5 text-[11px] transition-colors"
      style={{ backgroundColor: `${color}18`, borderColor: `${color}55` }}
      title="Modifier (version, famille, stack) ou retirer"
    >
      <TechIcon name={s.name} size={14} />
      <span className="font-medium">{s.name}</span>
      {s.version && <span className="opacity-70 tabular-nums">{s.version}</span>}
    </button>
  )

  return (
    <div className="rounded-xl border border-border/50 bg-card p-4 space-y-3">
      {linked.length === 0 && !adding && (
        <p className="text-xs text-muted-foreground italic">Aucune techno liée — ajoute la stack (framework, BDD, conteneur…) puis les outils/libs.</p>
      )}

      {/* Tier 1 — Stack principale */}
      {coreSkills.length > 0 && (
        <div className="space-y-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/70">Stack principale</span>
          <div className="flex flex-wrap gap-2">
            {coreSkills.map((s) => <CorePastille key={s.id} s={s} />)}
          </div>
        </div>
      )}

      {/* Tier 2 — Outils & libs, nuage coloré par famille */}
      {toolGroups.length > 0 && (
        <div className="space-y-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/70">Outils &amp; libs</span>
          <div className="flex flex-wrap gap-1.5">
            {toolGroups.map((g) => g.items.map((s) => <ToolChip key={s.id} s={s} color={g.color} />))}
          </div>
        </div>
      )}

      {/* Ajout : pastille pointillée « + », puis champ + choix de famille */}
      {adding ? (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <input
            list={`pskills-bar-${projectId}`}
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add() } else if (e.key === "Escape") { setAdding(false); setName(""); setFamily("") } }}
            placeholder="Techno (ex : Spring Boot, Docker, Nmap…)"
            aria-label="Ajouter une techno au projet"
            className="h-8 w-56 max-w-full rounded-lg border border-input bg-transparent px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <datalist id={`pskills-bar-${projectId}`}>
            {suggestions.map((s) => <option key={s.id} value={s.name} />)}
          </datalist>
          <select
            value={family}
            onChange={(e) => setFamily(e.target.value as "" | SkillFamily)}
            aria-label="Famille de la techno"
            title="Famille (laisser « auto » pour deviner)"
            className="h-8 rounded-lg border border-input bg-transparent px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="">Famille : auto{name.trim() && suggestFamily(name) ? ` (${SKILL_FAMILY_LABEL[suggestFamily(name)!]})` : ""}</option>
            {SKILL_FAMILIES.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
          </select>
          <button onClick={add} disabled={isPending || !name.trim()} aria-label="Valider" className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-input text-primary hover:bg-muted disabled:opacity-50">
            <Check className="h-4 w-4" />
          </button>
          <button onClick={() => { setAdding(false); setName(""); setFamily("") }} aria-label="Annuler" className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-input text-muted-foreground hover:bg-muted">
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

      {/* Éditeur inline de la pastille sélectionnée */}
      {editing && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border/50 bg-muted/20 p-2.5 text-xs">
          <span className="inline-flex items-center gap-1.5 font-medium"><TechIcon name={editing.name} size={16} /> {editing.name}</span>
          <button
            onClick={() => toggleCore(editing)}
            disabled={isPending}
            aria-pressed={editing.core}
            className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 ${editing.core ? "border-amber-500/40 bg-amber-500/10 text-amber-600" : "border-input text-muted-foreground hover:bg-muted"}`}
            title="Marquer comme stack principale"
          >
            <Star className={`h-3.5 w-3.5 ${editing.core ? "fill-amber-500 text-amber-500" : ""}`} /> Stack
          </button>
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
              {SKILL_FAMILIES.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
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
