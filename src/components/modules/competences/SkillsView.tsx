"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { ChevronRight, ChevronDown, Plus, Pencil, FolderPlus, Code2, HelpCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { SkillDialog, type SkillForEdit } from "./SkillDialog"
import { SKILL_STATUS_META, SKILL_TYPE_META, levelLabel } from "./skill-config"

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

const LEVEL_DOTS = (level: number) => (
  <span className="inline-flex gap-0.5" aria-hidden>
    {[1, 2, 3, 4, 5].map((n) => (
      <span key={n} className={cn("h-1.5 w-1.5 rounded-full", n <= level ? "bg-primary" : "bg-border")} />
    ))}
  </span>
)

export function SkillsView({ skills }: { skills: SkillItem[] }) {
  const [dialog, setDialog] = useState<{ open: boolean; editing?: SkillForEdit; parentId?: string | null; type?: "HARD" | "SOFT" }>({ open: false })

  const childrenBy = useMemo(() => {
    const m = new Map<string | null, SkillItem[]>()
    for (const s of skills) {
      const k = s.parentId
      if (!m.has(k)) m.set(k, [])
      m.get(k)!.push(s)
    }
    return m
  }, [skills])

  const roots = (type: "HARD" | "SOFT") => (childrenBy.get(null) ?? []).filter((s) => s.type === type)
  const openCreate = (type: "HARD" | "SOFT", parentId?: string | null) => setDialog({ open: true, parentId, type })
  const openEdit = (s: SkillItem) => setDialog({ open: true, editing: s })

  const parents = skills.map((s) => ({ id: s.id, name: s.name, type: s.type }))

  return (
    <div className="space-y-6">
      {(["HARD", "SOFT"] as const).map((type) => {
        const meta = SKILL_TYPE_META[type]
        const list = roots(type)
        return (
          <section key={type} className="space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <span aria-hidden>{meta.icon}</span> {meta.label}
              </h2>
              <Button size="sm" variant="outline" onClick={() => openCreate(type)} className="gap-1.5 h-8">
                <Plus className="h-3.5 w-3.5" /> Compétence
              </Button>
            </div>
            {list.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border/60 px-4 py-6 text-center text-sm text-muted-foreground">
                Aucune {type === "HARD" ? "compétence technique" : "soft skill"} pour l&apos;instant.
              </p>
            ) : (
              <div className="rounded-xl border border-border/50 divide-y divide-border/40 overflow-hidden">
                {list.map((s) => (
                  <SkillNode key={s.id} skill={s} depth={0} childrenBy={childrenBy}
                    onAddChild={(pid) => openCreate(type, pid)} onEdit={openEdit} />
                ))}
              </div>
            )}
          </section>
        )
      })}

      <SkillDialog
        open={dialog.open}
        onOpenChange={(v) => setDialog((d) => ({ ...d, open: v }))}
        skillForEdit={dialog.editing}
        defaultParentId={dialog.parentId}
        defaultType={dialog.type}
        parents={parents}
      />
    </div>
  )
}

function SkillNode({
  skill, depth, childrenBy, onAddChild, onEdit,
}: {
  skill: SkillItem
  depth: number
  childrenBy: Map<string | null, SkillItem[]>
  onAddChild: (parentId: string) => void
  onEdit: (s: SkillItem) => void
}) {
  const kids = childrenBy.get(skill.id) ?? []
  const [open, setOpen] = useState(depth === 0)
  const st = SKILL_STATUS_META[skill.status]

  return (
    <div>
      <div className="group flex items-center gap-2 px-3 py-2.5 hover:bg-muted/30" style={{ paddingLeft: 12 + depth * 20 }}>
        {kids.length > 0 ? (
          <button onClick={() => setOpen((v) => !v)} aria-label={open ? "Replier" : "Déplier"} aria-expanded={open}
            className="text-muted-foreground hover:text-foreground shrink-0">
            {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
        ) : <span className="w-4 shrink-0" />}

        <Link href={`/competences/${skill.id}`} className="min-w-0 flex-1 flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium truncate">{skill.name}</span>
          {skill.targetVersion && (
            <span className="text-[10px] font-mono text-muted-foreground rounded border border-border px-1 py-0.5">v{skill.targetVersion}</span>
          )}
          <span className={cn("inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium", st.cls)}>{st.label}</span>
          {skill._count.projects > 0 && (
            <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground"><Code2 className="h-3 w-3" />{skill._count.projects}</span>
          )}
          {skill._count.questions > 0 && (
            <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground"><HelpCircle className="h-3 w-3" />{skill._count.questions}</span>
          )}
        </Link>

        <span className="hidden sm:flex items-center gap-1.5 shrink-0" title={levelLabel(skill.level)}>
          {LEVEL_DOTS(skill.level)}
          <span className="text-[10px] text-muted-foreground w-14">{levelLabel(skill.level)}</span>
        </span>

        <div className="flex items-center gap-0.5 shrink-0 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
          <button onClick={() => onAddChild(skill.id)} title="Ajouter une sous-compétence"
            className="p-1.5 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground">
            <FolderPlus className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => onEdit(skill)} title="Modifier"
            className="p-1.5 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground">
            <Pencil className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {open && kids.map((k) => (
        <SkillNode key={k.id} skill={k} depth={depth + 1} childrenBy={childrenBy} onAddChild={onAddChild} onEdit={onEdit} />
      ))}
    </div>
  )
}
