"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { MoreHorizontal, Pencil, Trash2, CircleDot, Gauge, CornerDownRight } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu"
import { patchSkill, moveSkill, deleteSkill } from "@/actions/competences"
import type { SkillStatus } from "@/generated/prisma/enums"
import { SKILL_LEVELS, SKILL_STATUS_META } from "./skill-config"
import type { SkillItem } from "./SkillsView"

const STATUS_ORDER: SkillStatus[] = ["MASTERED", "LEARNING", "TO_ACQUIRE"]

/**
 * Menu de quick-actions sur une ligne de compétence : changer le statut / le niveau,
 * déplacer dans l'arbre, éditer en détail ou supprimer — sans ouvrir la modale complète.
 * Les mutations sont scopées userId côté serveur (anti-IDOR).
 */
export function SkillRowActions({
  skill,
  onEdit,
  moveOptions,
}: {
  skill: SkillItem
  onEdit: () => void
  /** Parents valides (self + descendants déjà exclus), avec profondeur pour l'indentation. */
  moveOptions: { id: string; name: string; depth: number }[]
}) {
  const router = useRouter()
  const [, start] = useTransition()

  const run = (fn: () => Promise<void>, ok: string) =>
    start(async () => {
      try {
        await fn()
        toast.success(ok)
        router.refresh()
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Action impossible")
      }
    })

  const kids = skill._count.children

  function handleDelete() {
    const msg = kids > 0
      ? `Supprimer « ${skill.name} » ? Ses ${kids} sous-compétence${kids > 1 ? "s" : ""} remonteront à la racine.`
      : `Supprimer « ${skill.name} » ?`
    if (window.confirm(msg)) run(() => deleteSkill(skill.id), "Compétence supprimée")
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon-xs" aria-label="Actions" />}>
        <MoreHorizontal />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuSub>
          <DropdownMenuSubTrigger><CircleDot /> Statut</DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            {STATUS_ORDER.map((s) => (
              <DropdownMenuItem key={s} onClick={() => run(() => patchSkill(skill.id, { status: s }), "Statut mis à jour")}>
                <span className={cn("h-2 w-2 rounded-full border", SKILL_STATUS_META[s].cls)} />
                {SKILL_STATUS_META[s].label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuSub>
          <DropdownMenuSubTrigger><Gauge /> Niveau</DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            {SKILL_LEVELS.map((l) => (
              <DropdownMenuItem key={l.value} onClick={() => run(() => patchSkill(skill.id, { level: l.value }), `Niveau : ${l.label}`)}>
                <span className="w-4 text-muted-foreground tabular-nums">{l.value}</span> {l.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuSub>
          <DropdownMenuSubTrigger><CornerDownRight /> Déplacer vers…</DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="max-h-72 overflow-y-auto">
            <DropdownMenuItem onClick={() => run(() => moveSkill(skill.id, null), "Déplacée à la racine")}>
              Racine (catégorie)
            </DropdownMenuItem>
            {moveOptions.map((o) => (
              <DropdownMenuItem key={o.id} onClick={() => run(() => moveSkill(skill.id, o.id), `Déplacée sous « ${o.name} »`)}>
                <span style={{ paddingLeft: o.depth * 12 }} className="truncate">{o.name}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onEdit}><Pencil /> Modifier en détail</DropdownMenuItem>
        <DropdownMenuItem variant="destructive" onClick={handleDelete}><Trash2 /> Supprimer</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
