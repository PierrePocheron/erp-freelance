"use client"

import { useTransition } from "react"
import { User, Loader2 } from "lucide-react"

export type ContactOption = { id: string; name: string; company: string | null }

function contactLabel(c: ContactOption) {
  return c.company ? `${c.name} — ${c.company}` : c.name
}

// Sélecteur de contact sur un projet. Toujours éditable (pas de verrouillage).
export function ProjectContactSelect({
  contacts,
  currentId,
  action,
}: {
  contacts: ContactOption[]
  currentId: string | null
  action: (contactId: string | null) => Promise<void>
}) {
  const [isPending, startTransition] = useTransition()

  if (contacts.length === 0) {
    return (
      <p className="text-sm text-muted-foreground italic flex items-center gap-1.5">
        <User className="h-3.5 w-3.5 shrink-0" />
        Aucun contact CRM — ajoutez-en un dans Clients.
      </p>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      <select
        defaultValue={currentId ?? ""}
        disabled={isPending}
        onChange={(e) => startTransition(() => action(e.target.value || null))}
        className="flex h-7 rounded-md border border-input bg-transparent px-2 py-0 text-sm text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-60 max-w-xs"
      >
        <option value="">— Aucun contact —</option>
        {contacts.map((c) => (
          <option key={c.id} value={c.id}>{contactLabel(c)}</option>
        ))}
      </select>
      {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground shrink-0" />}
    </div>
  )
}
