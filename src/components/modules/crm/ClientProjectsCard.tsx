"use client"

import { useState } from "react"
import Link from "next/link"
import { FolderKanban, Plus } from "lucide-react"
import { CreateProjectDialog } from "@/components/modules/projet/CreateProjectDialog"

type Company = { id: string; name: string; city: string | null }
type Contact = { id: string; name: string; company: string | null; companyId: string | null }
type Project = { id: string; name: string; status: string }

const projectStatusDot: Record<string, string> = {
  ACTIVE: "bg-emerald-500",
  PAUSED: "bg-amber-500",
  COMPLETED: "bg-blue-500",
  ARCHIVED: "bg-muted-foreground",
}

export function ClientProjectsCard({
  userId,
  clientId,
  projects,
  companies,
  contacts,
  defaultCompanyId,
}: {
  userId: string
  clientId: string
  projects: Project[]
  companies: Company[]
  contacts: Contact[]
  defaultCompanyId?: string | null
}) {
  const [open, setOpen] = useState(false)

  return (
    <div className="rounded-xl border border-border/50 bg-card p-4 space-y-2.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FolderKanban className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-semibold text-sm">Projets</h2>
        </div>
        <div className="flex items-center gap-3">
          {projects.length > 0 && (
            <Link href={`/contacts/${clientId}/projets`} className="text-xs text-primary hover:underline">
              Voir tout
            </Link>
          )}
          <button
            type="button"
            onClick={() => setOpen(true)}
            title="Nouveau projet"
            className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-border/60 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {projects.length > 0 ? (
        <div className="space-y-1.5">
          {projects.map((p) => (
            <Link
              key={p.id}
              href={`/projets/${p.id}`}
              className="flex items-center gap-2 text-sm hover:text-primary transition-colors"
            >
              <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${projectStatusDot[p.status] ?? "bg-muted-foreground"}`} />
              {p.name}
            </Link>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">Aucun projet pour l&apos;instant.</p>
      )}

      <CreateProjectDialog
        userId={userId}
        companies={companies}
        contacts={contacts}
        defaultCompanyId={defaultCompanyId ?? undefined}
        open={open}
        onOpenChange={setOpen}
      />
    </div>
  )
}
