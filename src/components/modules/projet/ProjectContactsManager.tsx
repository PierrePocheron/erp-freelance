"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { UserPlus, X, ChevronDown, Loader2 } from "lucide-react"

export type ContactOption = { id: string; name: string; company: string | null }

export type ProjectContactRole = "CLIENT" | "COLLEAGUE" | "PARTNER" | "SUPPLIER" | "OTHER"

export type ProjectContactEntry = {
  clientId: string
  role: ProjectContactRole
  label: string | null
  client: { id: string; name: string; company: string | null }
}

const ROLE_OPTIONS: { value: ProjectContactRole; label: string }[] = [
  { value: "CLIENT",    label: "Client"       },
  { value: "COLLEAGUE", label: "Collègue"     },
  { value: "PARTNER",   label: "Partenaire"   },
  { value: "SUPPLIER",  label: "Fournisseur"  },
  { value: "OTHER",     label: "Autre"        },
]

const ROLE_COLORS: Record<ProjectContactRole, string> = {
  CLIENT:    "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  COLLEAGUE: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  PARTNER:   "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  SUPPLIER:  "bg-orange-500/10 text-orange-600 dark:text-orange-400",
  OTHER:     "bg-muted text-muted-foreground",
}

function contactLabel(c: ContactOption) {
  return c.company ? `${c.name} — ${c.company}` : c.name
}

export function ProjectContactsManager({
  projectId,
  allContacts,
  projectContacts,
  onAdd,
  onRemove,
}: {
  projectId: string
  allContacts: ContactOption[]
  projectContacts: ProjectContactEntry[]
  onAdd: (clientId: string, role: ProjectContactRole, label?: string) => Promise<void>
  onRemove: (clientId: string) => Promise<void>
}) {
  const [isPending, startTransition] = useTransition()
  const [showForm, setShowForm] = useState(false)
  const [selectedId, setSelectedId] = useState("")
  const [role, setRole] = useState<ProjectContactRole>("OTHER")
  const [label, setLabel] = useState("")

  const linkedIds = new Set(projectContacts.map(c => c.clientId))
  const available = allContacts.filter(c => !linkedIds.has(c.id))

  function handleAdd() {
    if (!selectedId) return
    startTransition(async () => {
      await onAdd(selectedId, role, label.trim() || undefined)
      setSelectedId("")
      setRole("OTHER")
      setLabel("")
      setShowForm(false)
    })
  }

  function handleRemove(clientId: string) {
    startTransition(() => onRemove(clientId))
  }

  return (
    <div className="space-y-1.5">
      {/* Contacts existants */}
      {projectContacts.map(pc => (
        <div key={pc.clientId} className="flex items-center gap-2 group">
          <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${ROLE_COLORS[pc.role]}`}>
            {ROLE_OPTIONS.find(r => r.value === pc.role)?.label ?? pc.role}
          </span>
          <Link
            href={`/contacts/${pc.client.id}`}
            className="text-sm hover:text-primary transition-colors truncate"
          >
            {pc.client.name}
            {pc.client.company && (
              <span className="text-muted-foreground"> — {pc.client.company}</span>
            )}
          </Link>
          {pc.label && (
            <span className="text-xs text-muted-foreground italic truncate">· {pc.label}</span>
          )}
          <button
            onClick={() => handleRemove(pc.clientId)}
            disabled={isPending}
            className="ml-auto shrink-0 md:opacity-0 md:group-hover:opacity-100 focus:opacity-100 transition-opacity text-muted-foreground hover:text-destructive disabled:opacity-40"
            title="Retirer ce contact"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}

      {/* Formulaire d'ajout */}
      {showForm ? (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <select
            value={selectedId}
            onChange={e => setSelectedId(e.target.value)}
            disabled={isPending}
            className="flex h-7 rounded-md border border-input bg-transparent px-2 py-0 text-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-60 max-w-[180px]"
          >
            <option value="">— Contact —</option>
            {available.map(c => (
              <option key={c.id} value={c.id}>{contactLabel(c)}</option>
            ))}
          </select>

          <select
            value={role}
            onChange={e => setRole(e.target.value as ProjectContactRole)}
            disabled={isPending}
            className="flex h-7 rounded-md border border-input bg-transparent px-2 py-0 text-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-60"
          >
            {ROLE_OPTIONS.map(r => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>

          <input
            type="text"
            value={label}
            onChange={e => setLabel(e.target.value)}
            placeholder="Précision (opt.)"
            disabled={isPending}
            className="flex h-7 rounded-md border border-input bg-transparent px-2 py-0 text-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-60 w-28"
          />

          <button
            onClick={handleAdd}
            disabled={!selectedId || isPending}
            className="flex h-7 items-center gap-1 rounded-md bg-primary px-2.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Ajouter"}
          </button>
          <button
            onClick={() => setShowForm(false)}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Annuler
          </button>
        </div>
      ) : (
        <button
          onClick={() => setShowForm(true)}
          disabled={available.length === 0 || isPending}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
          title={available.length === 0 ? "Tous les contacts sont déjà liés" : "Ajouter un contact"}
        >
          <UserPlus className="h-3.5 w-3.5" />
          {projectContacts.length === 0 ? "Associer un contact" : "Ajouter un contact"}
        </button>
      )}

      {isPending && !showForm && (
        <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
      )}
    </div>
  )
}
