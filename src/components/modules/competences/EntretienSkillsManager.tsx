"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Plus, X, Brain } from "lucide-react"
import { toast } from "sonner"
import { linkOrCreateJobApplicationSkill, removeJobApplicationSkill } from "@/actions/competences"

/** Stack demandée par un poste : lie des compétences à un entretien (création à la volée). */
export function EntretienSkillsManager({
  applicationId, linkedSkills, allSkills,
}: {
  applicationId: string
  linkedSkills: { id: string; name: string }[]
  allSkills: { id: string; name: string }[]
}) {
  const router = useRouter()
  const [isPending, start] = useTransition()
  const [name, setName] = useState("")

  const linkedIds = new Set(linkedSkills.map((s) => s.id))
  const suggestions = allSkills.filter((s) => !linkedIds.has(s.id))

  const add = () => {
    if (!name.trim()) return
    start(async () => {
      try { await linkOrCreateJobApplicationSkill(applicationId, name); setName(""); router.refresh() }
      catch { toast.error("Ajout impossible") }
    })
  }
  const remove = (skillId: string) => start(async () => {
    try { await removeJobApplicationSkill(applicationId, skillId); router.refresh() }
    catch { toast.error("Retrait impossible") }
  })

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5"><Brain className="h-3.5 w-3.5" /> Stack / compétences demandées</p>
      <div className="flex flex-wrap gap-1.5">
        {linkedSkills.map((s) => (
          <span key={s.id} className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/40 pl-2 pr-1 py-0.5 text-xs">
            <Link href={`/competences/${s.id}`} className="hover:underline">{s.name}</Link>
            <button onClick={() => remove(s.id)} disabled={isPending} aria-label={`Retirer ${s.name}`} className="text-muted-foreground hover:text-destructive disabled:opacity-50">
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        {linkedSkills.length === 0 && <span className="text-xs text-muted-foreground">Aucune compétence liée pour l&apos;instant.</span>}
      </div>
      <div className="flex items-center gap-2">
        <input
          list={`skills-dl-${applicationId}`}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add() } }}
          placeholder="Ajouter (ex : Go, React, Spring…)"
          aria-label="Ajouter une compétence demandée"
          className="h-8 flex-1 rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <datalist id={`skills-dl-${applicationId}`}>
          {suggestions.map((s) => <option key={s.id} value={s.name} />)}
        </datalist>
        <button onClick={add} disabled={isPending || !name.trim()}
          className="inline-flex items-center gap-1 h-8 px-2.5 rounded-lg border border-input text-xs hover:bg-muted transition-colors disabled:opacity-50">
          <Plus className="h-3 w-3" /> Ajouter
        </button>
      </div>
    </div>
  )
}
