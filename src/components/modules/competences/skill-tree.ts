// Helpers purs de manipulation d'arbre de compétences (sans "use client" — testables,
// réutilisables côté serveur comme client). L'arbre est reconstruit à partir d'une liste
// plate reliée par `parentId`.

import type { SkillItem } from "./SkillsView"

/** Regroupe les compétences par `parentId` (clé `null` = racines). */
export function buildChildrenMap(skills: SkillItem[]): Map<string | null, SkillItem[]> {
  const m = new Map<string | null, SkillItem[]>()
  for (const s of skills) {
    const k = s.parentId
    if (!m.has(k)) m.set(k, [])
    m.get(k)!.push(s)
  }
  return m
}

/** Ids de tous les descendants de `rootId` (hors `rootId` lui-même). */
export function descendantIds(
  rootId: string,
  childrenBy: Map<string | null, SkillItem[]>,
): Set<string> {
  const out = new Set<string>()
  const stack = [...(childrenBy.get(rootId) ?? [])]
  while (stack.length) {
    const n = stack.pop()!
    if (out.has(n.id)) continue
    out.add(n.id)
    stack.push(...(childrenBy.get(n.id) ?? []))
  }
  return out
}

export type SubtreeAgg = { total: number; mastered: number; learning: number; toAcquire: number }

/**
 * Agrège les statuts des **feuilles** du sous-arbre enraciné en `node` (une catégorie
 * — nœud ayant des enfants — n'est pas comptée comme une compétence). Si `node` est
 * lui-même une feuille, il compte pour 1.
 */
export function aggregateSubtree(
  node: SkillItem,
  childrenBy: Map<string | null, SkillItem[]>,
): SubtreeAgg {
  const agg: SubtreeAgg = { total: 0, mastered: 0, learning: 0, toAcquire: 0 }
  const walk = (n: SkillItem) => {
    const kids = childrenBy.get(n.id) ?? []
    if (kids.length === 0) {
      agg.total++
      if (n.status === "MASTERED") agg.mastered++
      else if (n.status === "LEARNING") agg.learning++
      else agg.toAcquire++
      return
    }
    for (const k of kids) walk(k)
  }
  walk(node)
  return agg
}
