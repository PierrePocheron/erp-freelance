"use client"

import { useTransition } from "react"
import { Loader2, Building2 } from "lucide-react"

export type EmitterOption = { id: string; name: string; companyName: string | null }

function optionLabel(e: EmitterOption) {
  return e.companyName && e.companyName !== e.name ? `${e.name} — ${e.companyName}` : e.name
}

// Sélecteur de société émettrice d'un document. Éditable uniquement en brouillon ;
// au-delà, le bloc est figé (affichage seul) car l'émetteur fait partie du PDF gelé.
export function EmitterSelect({
  emitters,
  currentId,
  editable,
  action,
}: {
  emitters: EmitterOption[]
  currentId: string | null
  editable: boolean
  action: (emitterProfileId: string | null) => Promise<void>
}) {
  const [isPending, startTransition] = useTransition()
  const current = emitters.find((e) => e.id === currentId) ?? null

  if (!editable) {
    return (
      <p className="text-sm flex items-center gap-2">
        <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
        {current ? (
          <span>{optionLabel(current)}</span>
        ) : (
          <span className="text-muted-foreground italic">Aucune société (profil par défaut)</span>
        )}
      </p>
    )
  }

  if (emitters.length === 0) {
    return (
      <p className="text-sm text-muted-foreground italic">
        Aucune société configurée. Ajoutez-en une dans Réglages → Mes sociétés.
      </p>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <select
        defaultValue={currentId ?? ""}
        disabled={isPending}
        onChange={(e) => startTransition(() => action(e.target.value || null))}
        className="flex h-8 w-full max-w-md rounded-md border border-input bg-transparent px-3 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-60"
      >
        <option value="">— Aucune société —</option>
        {emitters.map((e) => (
          <option key={e.id} value={e.id}>{optionLabel(e)}</option>
        ))}
      </select>
      {isPending && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground shrink-0" />}
    </div>
  )
}
