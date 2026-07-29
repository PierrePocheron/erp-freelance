"use client"

import { useEffect, useMemo, useState } from "react"
import { Brain, Plus, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { SkillDialog, type SkillForEdit } from "./SkillDialog"
import { SkillOutlineNode, type FlatNode } from "./SkillOutlineNode"
import { SkillQuickAdd } from "./SkillQuickAdd"
import { SKILL_TYPE_META } from "./skill-config"
import { buildChildrenMap, aggregateSubtree, type SubtreeAgg } from "./skill-tree"

export type SkillItem = {
  id: string
  name: string
  type: "HARD" | "SOFT"
  level: number
  targetVersion: string | null
  status: "TO_ACQUIRE" | "LEARNING" | "MASTERED"
  yearsExperience: number | null
  notes: string | null
  parentId: string | null
  _count: { projects: number; questions: number; jobApplications: number; children: number }
}

const COLLAPSED_KEY = "competences:collapsed"

const normalize = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()

export function SkillsView({ skills }: { skills: SkillItem[] }) {
  const [dialog, setDialog] = useState<{ open: boolean; editing?: SkillForEdit; parentId?: string | null; type?: "HARD" | "SOFT" }>({ open: false })
  const [query, setQuery] = useState("")
  const [rootAddType, setRootAddType] = useState<"HARD" | "SOFT" | null>(null)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  // Restauration de l'état de repli (persisté). Sur le premier rendu (SSR + hydratation)
  // tout est déplié → pas de mismatch ; on applique le localStorage juste après.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(COLLAPSED_KEY)
      /* eslint-disable-next-line react-hooks/set-state-in-effect */
      if (raw) setCollapsed(new Set(JSON.parse(raw) as string[]))
    } catch { /* localStorage indisponible — on garde tout déplié */ }
  }, [])

  const persist = (next: Set<string>) => {
    setCollapsed(next)
    try { localStorage.setItem(COLLAPSED_KEY, JSON.stringify([...next])) } catch { /* best-effort */ }
  }
  const toggle = (id: string) => {
    const next = new Set(collapsed)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    persist(next)
  }

  const childrenBy = useMemo(() => buildChildrenMap(skills), [skills])

  const flatNodes = useMemo<FlatNode[]>(() => {
    const out: FlatNode[] = []
    const walk = (parentId: string | null, depth: number) => {
      for (const s of childrenBy.get(parentId) ?? []) {
        out.push({ id: s.id, name: s.name, depth, type: s.type })
        walk(s.id, depth + 1)
      }
    }
    walk(null, 0)
    return out
  }, [childrenBy])

  const categoryIds = useMemo(
    () => flatNodes.filter((n) => (childrenBy.get(n.id)?.length ?? 0) > 0).map((n) => n.id),
    [flatNodes, childrenBy],
  )

  const searching = query.trim().length > 0
  const visibleIds = useMemo<Set<string> | null>(() => {
    if (!searching) return null
    const nq = normalize(query)
    const parentOf = new Map(skills.map((s) => [s.id, s.parentId]))
    const vis = new Set<string>()
    for (const s of skills) {
      if (!normalize(s.name).includes(nq)) continue
      vis.add(s.id)
      let p = parentOf.get(s.id) ?? null
      while (p) {
        if (vis.has(p)) break
        vis.add(p)
        p = parentOf.get(p) ?? null
      }
    }
    return vis
  }, [skills, query, searching])

  const rootsOf = (type: "HARD" | "SOFT") =>
    (childrenBy.get(null) ?? []).filter((s) => s.type === type && (!visibleIds || visibleIds.has(s.id)))
  const hasAnyOf = (type: "HARD" | "SOFT") => (childrenBy.get(null) ?? []).some((s) => s.type === type)
  const sectionAgg = (type: "HARD" | "SOFT"): SubtreeAgg =>
    (childrenBy.get(null) ?? [])
      .filter((s) => s.type === type)
      .reduce<SubtreeAgg>((acc, r) => {
        const a = aggregateSubtree(r, childrenBy)
        return { total: acc.total + a.total, mastered: acc.mastered + a.mastered, learning: acc.learning + a.learning, toAcquire: acc.toAcquire + a.toAcquire }
      }, { total: 0, mastered: 0, learning: 0, toAcquire: 0 })

  const openCreate = (type: "HARD" | "SOFT", parentId?: string | null) => setDialog({ open: true, parentId, type })
  const openEdit = (s: SkillItem) => setDialog({
    open: true,
    editing: {
      id: s.id, name: s.name, type: s.type, level: s.level, targetVersion: s.targetVersion,
      status: s.status, yearsExperience: s.yearsExperience, notes: s.notes, parentId: s.parentId,
    },
  })

  const noMatches = searching && visibleIds!.size === 0
  const total = skills.length

  return (
    <div className="space-y-6">
      {/* Barre d'outils : recherche + repli global */}
      {total > 0 && (
        <div className="flex items-center gap-2">
          <div className="relative w-full max-w-xs">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Rechercher une compétence…" className="h-8 pl-8 text-sm" aria-label="Rechercher une compétence" />
          </div>
          <Button variant="ghost" size="sm" disabled={searching} onClick={() => persist(collapsed.size === 0 ? new Set(categoryIds) : new Set())}>
            {collapsed.size === 0 ? "Tout replier" : "Tout déplier"}
          </Button>
        </div>
      )}

      {total === 0 ? (
        <EmptyOnboarding onCreate={openCreate} />
      ) : noMatches ? (
        <div className="rounded-xl border border-dashed border-border/60 px-4 py-10 text-center text-sm text-muted-foreground">
          Aucune compétence ne correspond à «&nbsp;{query.trim()}&nbsp;».
          <div className="mt-2"><Button variant="outline" size="sm" onClick={() => setQuery("")}>Effacer la recherche</Button></div>
        </div>
      ) : (
        (["HARD", "SOFT"] as const).map((type) => {
          const meta = SKILL_TYPE_META[type]
          const roots = rootsOf(type)
          const agg = sectionAgg(type)
          const hasAny = hasAnyOf(type)
          const showBox = hasAny || rootAddType === type
          return (
            <section key={type} className="space-y-2">
              <div className="flex items-center gap-2">
                <h2 className="flex items-center gap-2 text-sm font-semibold">
                  <span aria-hidden>{meta.icon}</span> {meta.label}
                </h2>
                {agg.total > 0 && (
                  <span className="text-xs text-muted-foreground">
                    {agg.total} compétence{agg.total > 1 ? "s" : ""}
                    {agg.toAcquire > 0 && <> · <span className="text-blue-600 dark:text-blue-400">{agg.toAcquire} à acquérir</span></>}
                  </span>
                )}
                <Button variant="ghost" size="sm" className="ml-auto" onClick={() => setRootAddType(type)}>
                  <Plus /> Catégorie
                </Button>
              </div>

              {showBox ? (
                <div className="overflow-hidden rounded-xl border border-border/50 bg-card p-1.5">
                  {rootAddType === type && (
                    <SkillQuickAdd
                      parentId={null}
                      type={type}
                      placeholder={`Nouvelle catégorie ${type === "HARD" ? "technique" : "soft"} — Entrée pour ajouter`}
                      onClose={() => setRootAddType(null)}
                    />
                  )}
                  {roots.length === 0 ? (
                    searching
                      ? <p className="px-2 py-3 text-xs text-muted-foreground">Aucune correspondance dans cette section.</p>
                      : rootAddType !== type && <p className="px-2 py-3 text-xs text-muted-foreground">Aucune {type === "HARD" ? "compétence technique" : "soft skill"} pour l&apos;instant.</p>
                  ) : (
                    roots.map((s) => (
                      <SkillOutlineNode
                        key={s.id}
                        skill={s}
                        depth={0}
                        childrenBy={childrenBy}
                        visibleIds={visibleIds}
                        collapsed={collapsed}
                        toggle={toggle}
                        query={query}
                        flatNodes={flatNodes}
                        onEdit={openEdit}
                      />
                    ))
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-between gap-2 rounded-md border border-dashed border-border/60 px-3 py-2 text-sm text-muted-foreground">
                  <span>Aucune {type === "HARD" ? "compétence technique" : "soft skill"}.</span>
                  <Button variant="ghost" size="sm" onClick={() => setRootAddType(type)}><Plus /> Ajouter</Button>
                </div>
              )}
            </section>
          )
        })
      )}

      <SkillDialog
        open={dialog.open}
        onOpenChange={(v) => setDialog((d) => ({ ...d, open: v }))}
        skillForEdit={dialog.editing}
        defaultParentId={dialog.parentId}
        defaultType={dialog.type}
        allSkills={skills}
      />
    </div>
  )
}

function EmptyOnboarding({ onCreate }: { onCreate: (type: "HARD" | "SOFT") => void }) {
  return (
    <div className="rounded-xl border border-dashed border-border/60 py-16 text-center">
      <Brain className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden />
      <h2 className="mt-3 text-base font-semibold">Cartographiez vos compétences</h2>
      <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
        Organisez vos savoir-faire en catégories et sous-catégories, suivez votre niveau et ce qu&apos;il reste à acquérir.
      </p>
      <div className="mt-4 flex items-center justify-center gap-3">
        <Button onClick={() => onCreate("HARD")}><Plus /> Ajouter une première compétence</Button>
      </div>
      <div className="mt-3 flex items-center justify-center gap-4 text-xs text-muted-foreground">
        <button className="hover:text-foreground hover:underline" onClick={() => onCreate("HARD")}>🛠️ Compétence technique</button>
        <button className="hover:text-foreground hover:underline" onClick={() => onCreate("SOFT")}>🤝 Soft skill</button>
      </div>
    </div>
  )
}
