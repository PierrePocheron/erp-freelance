"use client"

import { useEffect, useState } from "react"
import { Eye, EyeOff } from "lucide-react"

const KEY = "erp-hide-amounts"

/**
 * Bouton pour masquer/afficher les montants des cartes (flou). L'état est posé
 * sur <html> via l'attribut `data-hide-amounts` (cf. globals.css qui floute les
 * éléments `.amount-sensitive`) et persisté en localStorage. Par défaut visible.
 * Pratique pour prendre une capture d'écran sans dévoiler les chiffres.
 */
export function AmountsPrivacyToggle() {
  const [hidden, setHidden] = useState(false)

  useEffect(() => {
    const v = localStorage.getItem(KEY) === "1"
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHidden(v)
    document.documentElement.toggleAttribute("data-hide-amounts", v)
  }, [])

  function toggle() {
    const next = !hidden
    setHidden(next)
    localStorage.setItem(KEY, next ? "1" : "0")
    document.documentElement.toggleAttribute("data-hide-amounts", next)
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-input text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
      title={hidden ? "Réafficher les montants" : "Masquer les montants (flou) — utile pour une capture"}
    >
      {hidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
      <span className="hidden sm:inline">{hidden ? "Montants masqués" : "Masquer les montants"}</span>
    </button>
  )
}
