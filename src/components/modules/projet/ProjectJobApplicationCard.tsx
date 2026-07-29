"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Briefcase, Pencil, Plus } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { updateProjectJobApplication } from "@/actions/projet"

type JobApp = { id: string; position: string; companyName: string }
type Linked = { id: string; companyName: string; position: string } | null

/**
 * Carte « Entretien associé » sur la fiche projet.
 * - Affiche l'entretien lié s'il y en a un (+ modification/détachement inline).
 * - S'il n'y a pas de lien mais des candidatures existent, propose de l'associer
 *   (édition possible depuis la fiche projet, comme le reste des attributs).
 * - Ne rend rien si aucun lien ET aucune candidature (module entretien non utilisé).
 */
export function ProjectJobApplicationCard({
  projectId, linked, jobApplications,
}: {
  projectId: string
  linked: Linked
  jobApplications: JobApp[]
}) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(linked?.id ?? "")
  const [isPending, start] = useTransition()

  if (!linked && jobApplications.length === 0) return null

  function save() {
    start(async () => {
      try {
        await updateProjectJobApplication(projectId, value || null)
        setEditing(false)
        router.refresh()
      } catch {
        toast.error("Impossible de mettre à jour l'entretien associé")
      }
    })
  }

  // Aucun lien : affordance discrète pour associer un entretien
  if (!linked && !editing) {
    return (
      <button
        type="button"
        onClick={() => { setValue(""); setEditing(true) }}
        className="flex w-full items-center gap-2 rounded-xl border border-dashed border-border/60 bg-card/40 px-4 py-3 text-sm text-muted-foreground hover:text-foreground hover:border-border transition-colors"
      >
        <Plus className="h-4 w-4" /> Associer un entretien
      </button>
    )
  }

  return (
    <div className="rounded-xl border border-border/50 bg-card p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-semibold text-sm">
          <Briefcase className="h-4 w-4 text-muted-foreground" /> Entretien associé
        </h2>
        {!editing && (
          <button
            type="button"
            onClick={() => { setValue(linked?.id ?? ""); setEditing(true) }}
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Modifier l'entretien associé"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {editing ? (
        <div className="space-y-2">
          <select
            value={value}
            aria-label="Entretien associé"
            onChange={(e) => setValue(e.target.value)}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="">— Aucun entretien —</option>
            {jobApplications.map((a) => (
              <option key={a.id} value={a.id}>{a.position} — {a.companyName}</option>
            ))}
          </select>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setEditing(false)} disabled={isPending}>Annuler</Button>
            <Button type="button" size="sm" onClick={save} disabled={isPending}>{isPending ? "…" : "Enregistrer"}</Button>
          </div>
        </div>
      ) : linked ? (
        <Link
          href={`/entretiens/${linked.id}`}
          className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-muted/50 transition-colors"
        >
          <span className="font-medium truncate">{linked.companyName}</span>
          <span className="text-xs text-muted-foreground truncate">· {linked.position}</span>
        </Link>
      ) : null}
    </div>
  )
}
