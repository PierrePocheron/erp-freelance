"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Plus, X, Brain } from "lucide-react"
import { toast } from "sonner"
import { linkOrCreateProjectSkill, setProjectSkill, removeProjectSkill } from "@/actions/competences"

type LinkedSkill = { id: string; name: string; version: string | null; role: "USED" | "TO_ACQUIRE" }

/**
 * Compétences & technos d'un projet : visualisation + ajout (création à la volée
 * par nom) + version éditable par techno + retrait. Backend : linkOrCreateProjectSkill
 * / setProjectSkill / removeProjectSkill (competences.ts), scopés userId.
 */
export function ProjectSkillsManager({
  projectId, linked, allSkills,
}: {
  projectId: string
  linked: LinkedSkill[]
  allSkills: { id: string; name: string }[]
}) {
  const router = useRouter()
  const [isPending, start] = useTransition()
  const [name, setName] = useState("")

  const linkedIds = new Set(linked.map((s) => s.id))
  const suggestions = allSkills.filter((s) => !linkedIds.has(s.id))

  const add = () => {
    if (!name.trim()) return
    start(async () => {
      try { await linkOrCreateProjectSkill(projectId, name); setName(""); router.refresh() }
      catch { toast.error("Ajout impossible") }
    })
  }
  const saveVersion = (skillId: string, role: LinkedSkill["role"], version: string) =>
    start(async () => {
      try { await setProjectSkill(projectId, skillId, { version: version.trim() || null, role }); router.refresh() }
      catch { toast.error("Version non enregistrée") }
    })
  const remove = (skillId: string) =>
    start(async () => {
      try { await removeProjectSkill(projectId, skillId); router.refresh() }
      catch { toast.error("Retrait impossible") }
    })

  return (
    <div className="rounded-xl border border-border/50 bg-card p-5 space-y-3">
      <div className="flex items-center gap-2 font-semibold text-sm">
        <Brain className="h-4 w-4 text-muted-foreground" /> Compétences &amp; technos
      </div>

      {linked.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">Aucune techno liée. Ajoute les compétences utilisées sur ce projet (avec leur version).</p>
      ) : (
        <div className="space-y-1.5">
          {linked.map((s) => (
            <div key={s.id} className="flex items-center gap-2">
              <Link href={`/competences/${s.id}`} className="flex-1 truncate text-sm hover:underline">{s.name}</Link>
              {s.role === "TO_ACQUIRE" && (
                <span className="shrink-0 rounded-full bg-amber-500/15 text-amber-600 px-1.5 py-0.5 text-[10px] font-medium">à acquérir</span>
              )}
              <input
                defaultValue={s.version ?? ""}
                onBlur={(e) => { if ((e.target.value.trim() || null) !== s.version) saveVersion(s.id, s.role, e.target.value) }}
                placeholder="version"
                aria-label={`Version de ${s.name}`}
                className="h-7 w-24 shrink-0 rounded-md border border-input bg-transparent px-2 text-xs tabular-nums placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <button onClick={() => remove(s.id)} disabled={isPending} aria-label={`Retirer ${s.name}`} className="shrink-0 text-muted-foreground hover:text-destructive disabled:opacity-50">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 pt-1">
        <input
          list={`pskills-dl-${projectId}`}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add() } }}
          placeholder="Ajouter une techno (ex : Go, React, Docker…)"
          aria-label="Ajouter une compétence / techno au projet"
          className="h-8 flex-1 rounded-lg border border-input bg-transparent px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <datalist id={`pskills-dl-${projectId}`}>
          {suggestions.map((s) => <option key={s.id} value={s.name} />)}
        </datalist>
        <button onClick={add} disabled={isPending || !name.trim()} className="inline-flex items-center gap-1 h-8 px-2.5 rounded-lg border border-input text-xs hover:bg-muted transition-colors disabled:opacity-50">
          <Plus className="h-3 w-3" /> Ajouter
        </button>
      </div>
    </div>
  )
}
