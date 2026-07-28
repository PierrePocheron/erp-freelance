"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Plus, X, Code2 } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { setProjectSkill, removeProjectSkill } from "@/actions/competences"
import { PROJECT_SKILL_ROLE_META } from "./skill-config"

export type ProjectLink = {
  projectId: string
  projectName: string
  version: string | null
  role: "USED" | "TO_ACQUIRE"
}

/** Gestion des projets liés à une compétence (fiche compétence) : version utilisée + rôle. */
export function ProjectSkillManager({
  skillId, links, allProjects,
}: {
  skillId: string
  links: ProjectLink[]
  allProjects: { id: string; name: string }[]
}) {
  const router = useRouter()
  const [isPending, start] = useTransition()
  const [projectId, setProjectId] = useState("")
  const [version, setVersion] = useState("")
  const [role, setRole] = useState<"USED" | "TO_ACQUIRE">("USED")

  const linkedIds = new Set(links.map((l) => l.projectId))
  const available = allProjects.filter((p) => !linkedIds.has(p.id))

  const add = () => {
    if (!projectId) return
    start(async () => {
      try {
        await setProjectSkill(projectId, skillId, { version: version.trim() || null, role })
        setProjectId(""); setVersion(""); setRole("USED")
        router.refresh()
      } catch { toast.error("Ajout impossible") }
    })
  }
  const remove = (pid: string) => start(async () => {
    try { await removeProjectSkill(pid, skillId); router.refresh() }
    catch { toast.error("Retrait impossible") }
  })

  const inputCls = "h-9 rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"

  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold flex items-center gap-2"><Code2 className="h-4 w-4" /> Projets liés</h2>

      {links.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucun projet lié à cette compétence pour l&apos;instant.</p>
      ) : (
        <div className="rounded-xl border border-border/50 divide-y divide-border/40 overflow-hidden">
          {links.map((l) => (
            <div key={l.projectId} className="flex items-center gap-2 px-3 py-2 text-sm">
              <Link href={`/projets/${l.projectId}`} className="font-medium hover:underline truncate">{l.projectName}</Link>
              {l.version && <span className="text-[10px] font-mono text-muted-foreground rounded border border-border px-1 py-0.5">v{l.version}</span>}
              <span className="text-[10px] text-muted-foreground">{PROJECT_SKILL_ROLE_META[l.role]?.label}</span>
              <button onClick={() => remove(l.projectId)} disabled={isPending} aria-label={`Retirer ${l.projectName}`}
                className="ml-auto shrink-0 text-muted-foreground hover:text-destructive disabled:opacity-50">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {available.length > 0 && (
        <div className="flex flex-wrap items-end gap-2 rounded-xl border border-dashed border-border/60 p-3">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground" htmlFor="ps-project">Projet</label>
            <select id="ps-project" value={projectId} onChange={(e) => setProjectId(e.target.value)} className={cn(inputCls, "min-w-40")}>
              <option value="">— Choisir —</option>
              {available.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground" htmlFor="ps-version">Version</label>
            <input id="ps-version" value={version} onChange={(e) => setVersion(e.target.value)} placeholder="ex : 4" className={cn(inputCls, "w-24")} />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground" htmlFor="ps-role">Rôle</label>
            <select id="ps-role" value={role} onChange={(e) => setRole(e.target.value as typeof role)} className={inputCls}>
              <option value="USED">Utilisée</option>
              <option value="TO_ACQUIRE">À acquérir</option>
            </select>
          </div>
          <Button size="sm" onClick={add} disabled={isPending || !projectId} className="gap-1.5 h-9">
            <Plus className="h-3.5 w-3.5" /> Lier
          </Button>
        </div>
      )}
    </section>
  )
}
