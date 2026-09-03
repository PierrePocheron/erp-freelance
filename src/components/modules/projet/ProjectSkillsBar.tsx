"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Plus, X, Check, Star } from "lucide-react"
import { toast } from "sonner"
import type { SkillFamily } from "@/generated/prisma/enums"
import {
  SKILL_FAMILIES, SKILL_FAMILY_LABEL, SECTIONS, FAMILY_TO_SECTION, GROUP_META, GROUP_ORDER,
  PRIMARY_ORDER, SUGGESTED_TECHS, classifyTech, isPrimaryKind,
  type SectionKey, type TechKind,
} from "@/lib/tech-icons"
import { linkOrCreateProjectSkill, setProjectSkill, removeProjectSkill, patchSkill } from "@/actions/competences"
import { TechIcon } from "./TechIcon"

type LinkedSkill = { id: string; name: string; version: string | null; role: "USED" | "TO_ACQUIRE"; family: SkillFamily | null; core: boolean }
type Enriched = LinkedSkill & { section: SectionKey; kind: TechKind; group?: string; primary: boolean }

const SECTION_LABEL = Object.fromEntries(SECTIONS.map((s) => [s.key, s.label])) as Record<SectionKey, string>
const PRIMARY_SECTIONS: SectionKey[] = ["BACKEND", "FRONTEND", "MOBILE", "DATABASE"]

/**
 * Compétences/technos d'un projet, en tête de fiche, rangées par SECTION (Backend,
 * Frontend, BDD, DevOps…). Dans chaque section : la « stack » (framework + langage +
 * moteur BDD) est mise en avant, le reste forme un nuage. Côté DevOps le nuage est
 * re-catégorisé (Conteneurisation, Observabilité, Sécurité SAST/DAST/SCA/SBOM, CI/CD…).
 * Famille/sous-catégorie déduites automatiquement du nom (aucune saisie requise) ;
 * surchargées seulement via l'éditeur inline.
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
  const [version, setVersion] = useState("")
  const [editing, setEditing] = useState<LinkedSkill | null>(null)

  const suggestionNames = useMemo(() => {
    const linkedNames = new Set(linked.map((s) => s.name.toLowerCase()))
    const set = new Set<string>(SUGGESTED_TECHS)
    for (const s of allSkills) if (!linkedNames.has(s.name.toLowerCase())) set.add(s.name)
    return [...set].sort((a, b) => a.localeCompare(b, "fr"))
  }, [allSkills, linked])

  // Enrichissement : famille (stockée sinon déduite) → section, kind, sous-catégorie, primaire.
  const grouped = useMemo(() => {
    const enriched: Enriched[] = linked.map((s) => {
      const c = classifyTech(s.name)
      const family = s.family ?? c.family
      const section = FAMILY_TO_SECTION[family] ?? "OTHER"
      const hasPrimary = PRIMARY_SECTIONS.includes(section)
      const primary = hasPrimary && (isPrimaryKind(c.kind) || s.core)
      return { ...s, section, kind: c.kind, group: c.group, primary }
    })
    return SECTIONS.map((sec) => {
      const items = enriched.filter((e) => e.section === sec.key)
      if (!items.length) return null
      const primaries = items
        .filter((e) => e.primary)
        .sort((a, b) => PRIMARY_ORDER[a.kind] - PRIMARY_ORDER[b.kind] || a.name.localeCompare(b.name, "fr"))
      const cloud = items.filter((e) => !e.primary)
      let groups: { label: string; color: string; items: Enriched[] }[]
      if (sec.key === "DEVOPS") {
        const byGroup = new Map<string, Enriched[]>()
        for (const e of cloud) {
          const g = e.group ?? "Outillage"
          if (!byGroup.has(g)) byGroup.set(g, [])
          byGroup.get(g)!.push(e)
        }
        const rank = (g: string) => (GROUP_ORDER.indexOf(g) + 1 || 99)
        groups = [...byGroup.entries()]
          .sort((a, b) => rank(a[0]) - rank(b[0]) || a[0].localeCompare(b[0], "fr"))
          .map(([label, its]) => ({ label, color: GROUP_META[label]?.color ?? sec.color, items: its }))
      } else {
        groups = cloud.length ? [{ label: "", color: sec.color, items: cloud }] : []
      }
      return { sec, primaries, groups }
    }).filter((x): x is NonNullable<typeof x> => x !== null)
  }, [linked])

  const detected = name.trim() ? classifyTech(name) : null
  const detectedSection = detected ? (FAMILY_TO_SECTION[detected.family] ?? "OTHER") : null

  const add = () => {
    const n = name.trim()
    if (!n) return
    start(async () => {
      try {
        await linkOrCreateProjectSkill(projectId, n, version.trim() ? { version } : undefined)
        setName(""); setVersion(""); setAdding(false); router.refresh()
      } catch { toast.error("Ajout impossible") }
    })
  }
  const saveVersion = (s: LinkedSkill, v: string) =>
    start(async () => {
      try { await setProjectSkill(projectId, s.id, { version: v.trim() || null }); router.refresh() }
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

  // Pastille « stack principale » (framework / langage / moteur BDD) — mise en avant.
  const Pastille = ({ s, color }: { s: Enriched; color: string }) => (
    <button
      type="button"
      onClick={() => setEditing((e) => (e?.id === s.id ? null : s))}
      className="inline-flex items-center gap-2 rounded-lg border pl-1 pr-2.5 py-1 text-sm hover:brightness-95 transition"
      style={{ backgroundColor: `${color}12`, borderColor: `${color}44` }}
      title="Modifier (version, famille, stack) ou retirer"
    >
      <TechIcon name={s.name} size={20} />
      <span className="font-medium leading-none">{s.name}</span>
      {s.version && <span className="text-muted-foreground tabular-nums leading-none">{s.version}</span>}
    </button>
  )

  // Chip « outil / lib » (nuage), teinté par la couleur de sa sous-catégorie/section.
  const Chip = ({ s, color }: { s: Enriched; color: string }) => (
    <button
      type="button"
      onClick={() => setEditing((e) => (e?.id === s.id ? null : s))}
      className="inline-flex items-center gap-1 rounded-full border pl-0.5 pr-2 py-0.5 text-[11px] hover:brightness-95 transition"
      style={{ backgroundColor: `${color}14`, borderColor: `${color}40` }}
      title="Modifier (version, famille, stack) ou retirer"
    >
      <TechIcon name={s.name} size={15} />
      <span className="font-medium leading-none">{s.name}</span>
      {s.version && <span className="opacity-60 tabular-nums leading-none">{s.version}</span>}
    </button>
  )

  return (
    <div className="rounded-xl border border-border/50 bg-card p-4 space-y-4">
      {linked.length === 0 && !adding && (
        <p className="text-xs text-muted-foreground italic">Aucune techno liée — ajoute la stack (langage, framework, BDD…) puis les outils. La famille est déduite automatiquement.</p>
      )}

      {grouped.map(({ sec, primaries, groups }) => (
        <section key={sec.key} className="space-y-2">
          {/* En-tête de section */}
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: sec.color }} />
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{sec.label}</span>
          </div>

          {/* Stack principale (framework + langage + moteur BDD) */}
          {primaries.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {primaries.map((s) => <Pastille key={s.id} s={s} color={sec.color} />)}
            </div>
          )}

          {/* Nuage — plat (hors DevOps) ou re-catégorisé (DevOps) */}
          {groups.map((g) => (
            <div key={g.label || "flat"} className={g.label ? "flex flex-wrap items-center gap-x-2 gap-y-1.5" : "flex flex-wrap gap-1.5"}>
              {g.label && (
                <span className="inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide shrink-0" style={{ color: g.color }}>
                  <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: g.color }} />
                  {g.label}
                </span>
              )}
              <span className="flex flex-wrap gap-1.5">
                {g.items.map((s) => <Chip key={s.id} s={s} color={g.color} />)}
              </span>
            </div>
          ))}
        </section>
      ))}

      {/* Ajout : pastille pointillée « + » → champ techno + version (famille auto) */}
      {adding ? (
        <div className="space-y-1.5 pt-1 border-t border-border/40">
          <div className="flex flex-wrap items-center gap-2 pt-2">
            <input
              list={`pskills-bar-${projectId}`}
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add() } else if (e.key === "Escape") { setAdding(false); setName(""); setVersion("") } }}
              placeholder="Techno (ex : FastAPI, Spring Boot, Docker, Trivy…)"
              aria-label="Ajouter une techno au projet"
              className="h-8 w-64 max-w-full rounded-lg border border-input bg-transparent px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <datalist id={`pskills-bar-${projectId}`}>
              {suggestionNames.map((n) => <option key={n} value={n} />)}
            </datalist>
            <input
              value={version}
              onChange={(e) => setVersion(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add() } else if (e.key === "Escape") { setAdding(false); setName(""); setVersion("") } }}
              placeholder="version (option.)"
              aria-label="Version (optionnel)"
              className="h-8 w-28 rounded-lg border border-input bg-transparent px-3 text-sm tabular-nums focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <button onClick={add} disabled={isPending || !name.trim()} aria-label="Valider" className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-input text-primary hover:bg-muted disabled:opacity-50">
              <Check className="h-4 w-4" />
            </button>
            <button onClick={() => { setAdding(false); setName(""); setVersion("") }} aria-label="Annuler" className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-input text-muted-foreground hover:bg-muted">
              <X className="h-4 w-4" />
            </button>
          </div>
          {detected && detectedSection && (
            <p className="text-[11px] text-muted-foreground pl-1">
              Détecté :{" "}
              <span className="font-medium text-foreground">{SECTION_LABEL[detectedSection]}</span>
              {detected.group ? <> · {detected.group}</> : null}
              {!detected.tech && <span className="italic"> (classement approché — ajustable ensuite)</span>}
            </p>
          )}
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
            title="Épingler dans la « stack principale » de sa section"
          >
            <Star className={`h-3.5 w-3.5 ${editing.core ? "fill-amber-500 text-amber-500" : ""}`} /> Stack
          </button>
          <label className="flex items-center gap-1 text-muted-foreground">
            version
            <input
              defaultValue={editing.version ?? ""}
              onBlur={(e) => { if ((e.target.value.trim() || null) !== editing.version) saveVersion(editing, e.target.value) }}
              placeholder="ex : 3.5"
              className="h-7 w-24 rounded-md border border-input bg-transparent px-2 tabular-nums focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </label>
          <label className="flex items-center gap-1 text-muted-foreground">
            famille
            <select
              value={editing.family ?? classifyTech(editing.name).family}
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
