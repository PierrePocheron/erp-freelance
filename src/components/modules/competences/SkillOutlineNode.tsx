"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { ChevronDown, ChevronRight, Plus, Code2, HelpCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { SKILL_STATUS_META, levelLabel, levelDotColor, masteryOf } from "./skill-config"
import { aggregateSubtree, descendantIds, type SubtreeAgg } from "./skill-tree"
import { SkillQuickAdd } from "./SkillQuickAdd"
import { SkillRowActions } from "./SkillRowActions"
import type { SkillItem } from "./SkillsView"

export type FlatNode = { id: string; name: string; depth: number; type: "HARD" | "SOFT" }

function LevelDots({ level }: { level: number }) {
  return (
    <span className="inline-flex gap-0.5" aria-hidden>
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} className={cn("h-1.5 w-1.5 rounded-full", n <= level ? levelDotColor(level) : "bg-border")} />
      ))}
    </span>
  )
}

function RootAgg({ agg }: { agg: SubtreeAgg }) {
  const pct = Math.round(masteryOf(agg) * 100)
  return (
    <span className="ml-1 hidden shrink-0 items-center gap-1.5 md:inline-flex">
      <span className="h-1.5 w-16 overflow-hidden rounded-full bg-border">
        <span className="block h-full rounded-full bg-emerald-500/70" style={{ width: `${pct}%` }} />
      </span>
      <span className="whitespace-nowrap text-[11px] text-muted-foreground">
        {agg.mastered}/{agg.total} maîtrisée{agg.mastered > 1 ? "s" : ""}
        {agg.toAcquire > 0 && <> · <span className="text-blue-600 dark:text-blue-400">{agg.toAcquire} à acquérir</span></>}
      </span>
    </span>
  )
}

function highlight(text: string, query: string): React.ReactNode {
  const q = query.trim()
  if (!q) return text
  const idx = text.toLowerCase().indexOf(q.toLowerCase())
  if (idx === -1) return text
  return (
    <>
      {text.slice(0, idx)}
      <mark className="rounded bg-yellow-500/20 text-inherit">{text.slice(idx, idx + q.length)}</mark>
      {text.slice(idx + q.length)}
    </>
  )
}

/**
 * Ligne récursive de l'arbre-outline. Une « catégorie » (nœud avec enfants) et une
 * « feuille » se distinguent uniquement par `kids.length` (aucun flag en base). Tout
 * est déplié par défaut : l'état de repli est porté par le parent (`collapsed`).
 */
export function SkillOutlineNode({
  skill,
  depth,
  childrenBy,
  visibleIds,
  collapsed,
  toggle,
  query,
  flatNodes,
  onEdit,
}: {
  skill: SkillItem
  depth: number
  childrenBy: Map<string | null, SkillItem[]>
  visibleIds: Set<string> | null
  collapsed: Set<string>
  toggle: (id: string) => void
  query: string
  flatNodes: FlatNode[]
  onEdit: (s: SkillItem) => void
}) {
  const kids = childrenBy.get(skill.id) ?? []
  const visKids = visibleIds ? kids.filter((k) => visibleIds.has(k.id)) : kids
  const isCategory = kids.length > 0
  const searching = query.trim().length > 0
  const open = searching || !collapsed.has(skill.id)
  const [adding, setAdding] = useState(false)

  const descendants = useMemo(() => descendantIds(skill.id, childrenBy), [skill.id, childrenBy])
  const moveOptions = useMemo(
    () =>
      flatNodes
        .filter((n) => n.type === skill.type && n.id !== skill.id && !descendants.has(n.id))
        .map((n) => ({ id: n.id, name: n.name, depth: n.depth })),
    [flatNodes, skill.id, skill.type, descendants],
  )

  const agg = depth === 0 ? aggregateSubtree(skill, childrenBy) : null
  const st = SKILL_STATUS_META[skill.status]

  return (
    <div>
      <div className="group flex min-h-8 items-center gap-1.5 rounded-md px-1.5 transition-colors hover:bg-muted/40">
        {isCategory ? (
          <button
            onClick={() => toggle(skill.id)}
            aria-label={open ? "Replier" : "Déplier"}
            aria-expanded={open}
            disabled={searching}
            className="shrink-0 text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
          >
            {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
        ) : (
          <span className="flex h-4 w-4 shrink-0 items-center justify-center" aria-hidden>
            <span className="h-1.5 w-1.5 rounded-full bg-border" />
          </span>
        )}

        <div className="flex min-w-0 flex-1 items-center gap-1.5">
          <Link
            href={`/competences/${skill.id}`}
            className={cn(
              "truncate hover:underline",
              isCategory ? (depth === 0 ? "text-sm font-semibold" : "text-sm font-medium") : "text-sm",
              !isCategory && skill.status === "TO_ACQUIRE" && "text-muted-foreground",
            )}
          >
            {highlight(skill.name, query)}
          </Link>

          {skill.targetVersion && (
            <span className="shrink-0 rounded border border-border px-1 py-0.5 font-mono text-[10px] text-muted-foreground">v{skill.targetVersion}</span>
          )}

          {!isCategory && (
            <span className={cn("inline-flex shrink-0 items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium", st.cls)}>{st.label}</span>
          )}

          {isCategory && <span className="shrink-0 text-[11px] text-muted-foreground">{kids.length}</span>}

          {skill._count.projects > 0 && (
            <span className="inline-flex shrink-0 items-center gap-0.5 text-[10px] text-muted-foreground"><Code2 className="h-3 w-3" />{skill._count.projects}</span>
          )}
          {skill._count.questions > 0 && (
            <span className="inline-flex shrink-0 items-center gap-0.5 text-[10px] text-muted-foreground"><HelpCircle className="h-3 w-3" />{skill._count.questions}</span>
          )}

          {agg && agg.total > 0 && <RootAgg agg={agg} />}
        </div>

        {!isCategory && (
          <span className="hidden shrink-0 items-center sm:flex" title={levelLabel(skill.level)}>
            <LevelDots level={skill.level} />
          </span>
        )}

        <div className="flex shrink-0 items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label="Ajouter une sous-compétence"
            title="Ajouter une sous-compétence"
            onClick={() => setAdding(true)}
            className={cn("transition-opacity", isCategory ? "opacity-60 hover:opacity-100" : "md:opacity-0 md:group-hover:opacity-100")}
          >
            <Plus />
          </Button>
          <span className="transition-opacity md:opacity-0 md:group-hover:opacity-100 md:has-data-[popup-open]:opacity-100">
            <SkillRowActions skill={skill} onEdit={() => onEdit(skill)} moveOptions={moveOptions} />
          </span>
        </div>
      </div>

      {(open || adding) && (
        <div className="ml-2 border-l border-border/40 pl-1.5 sm:ml-3.5">
          {open && visKids.map((k) => (
            <SkillOutlineNode
              key={k.id}
              skill={k}
              depth={depth + 1}
              childrenBy={childrenBy}
              visibleIds={visibleIds}
              collapsed={collapsed}
              toggle={toggle}
              query={query}
              flatNodes={flatNodes}
              onEdit={onEdit}
            />
          ))}
          {adding && <SkillQuickAdd parentId={skill.id} type={skill.type} onClose={() => setAdding(false)} />}
        </div>
      )}
    </div>
  )
}
