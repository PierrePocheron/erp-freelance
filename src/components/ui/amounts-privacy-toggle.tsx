"use client"

import { useEffect, useState } from "react"
import { Eye, EyeOff } from "lucide-react"

const KEY = "erp-hide-amounts"

/**
 * Bouton pour masquer/afficher les montants des cartes (flou). L'état est posé
 * sur <html> via la classe `.hide-amounts` (même mécanisme que le thème `.dark` ;
 * cf. globals.css qui floute les `.amount-sensitive`) et persisté en localStorage.
 * Par défaut visible.
 * Pratique pour prendre une capture d'écran sans dévoiler les chiffres.
 */
export function AmountsPrivacyToggle() {
  const [hidden, setHidden] = useState(false)

  // La classe .hide-amounts est déjà posée sur <html> AVANT hydratation par le
  // script inline (amounts-init-script). Ici on se contente de synchroniser le
  // libellé du bouton avec l'état réel — jamais l'inverse.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHidden(document.documentElement.classList.contains("hide-amounts"))
  }, [])

  function toggle() {
    // Source de vérité = la classe réellement présente sur <html>, jamais l'état
    // React (qui, au tout premier rendu, vaut `false` alors que la classe peut
    // déjà être là — c'est ce décalage qui faisait « le bouton ne fait rien /
    // montants toujours masqués » : `!hidden` ré-ajoutait la classe déjà posée).
    const next = !document.documentElement.classList.contains("hide-amounts")
    document.documentElement.classList.toggle("hide-amounts", next)
    localStorage.setItem(KEY, next ? "1" : "0")
    setHidden(next)
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
