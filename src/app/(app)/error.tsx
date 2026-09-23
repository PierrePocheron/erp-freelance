"use client"

import { useEffect } from "react"
import { AlertTriangle, RotateCw } from "lucide-react"

/**
 * Filet d'erreur du groupe (app). Sans lui, toute server action qui `throw` (Resend
 * indisponible, règle métier violée, session expirée) remplaçait la page par l'écran
 * générique de Next, sans le message métier ni moyen de reprendre.
 */
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error) }, [error])
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <AlertTriangle className="h-10 w-10 text-amber-500" />
      <div className="space-y-1">
        <h1 className="text-lg font-semibold">Une erreur est survenue</h1>
        <p className="max-w-md text-sm text-muted-foreground">{error.message || "Erreur inattendue."}</p>
        {error.digest && <p className="text-xs text-muted-foreground/70">Référence : {error.digest}</p>}
      </div>
      <button
        type="button"
        onClick={reset}
        className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
      >
        <RotateCw className="h-4 w-4" /> Réessayer
      </button>
    </div>
  )
}
