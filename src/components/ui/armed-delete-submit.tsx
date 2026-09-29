"use client"

import { useFormStatus } from "react-dom"
import { Check, Loader2, Trash2 } from "lucide-react"
import { useArmedDelete } from "@/hooks/use-armed-delete"
import { cn } from "@/lib/utils"

/**
 * Bouton icône « supprimer » d'un <form action={…}> SERVEUR, en deux clics (motif
 * useArmedDelete) : le premier arme (✓ rouge), le second soumet. Pour les listes rendues
 * côté serveur où l'on ne peut pas appeler le hook directement.
 */
export function ArmedDeleteSubmit({ label, className }: { label: string; className?: string }) {
  const { isArmed, confirmFirst } = useArmedDelete()
  const { pending } = useFormStatus()
  const armed = isArmed()
  return (
    <button
      type="submit"
      disabled={pending}
      onClick={(e) => { if (!confirmFirst()) e.preventDefault() }}
      aria-label={armed ? `Confirmer : ${label.toLowerCase()}` : label}
      title={armed ? "Confirmer la suppression" : label}
      className={cn(
        "transition-opacity focus:opacity-100 group-hover:opacity-100 hover:text-destructive disabled:opacity-40",
        armed ? "text-destructive" : "pointer-fine:opacity-0 text-muted-foreground",
        className,
      )}
    >
      {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : armed ? <Check className="h-3.5 w-3.5" /> : <Trash2 className="h-3.5 w-3.5" />}
    </button>
  )
}
