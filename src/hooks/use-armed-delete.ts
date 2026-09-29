"use client"

import { useEffect, useRef, useState } from "react"

/**
 * Suppression en deux clics : le premier « arme » le bouton (à afficher en rouge /
 * « Confirmer »), le second confirme. L'armement retombe seul après `ms` — pas de
 * bouton armé oublié. Une clé par ligne quand le composant rend une liste.
 *
 *   const { isArmed, confirmFirst } = useArmedDelete()
 *   onClick={() => { if (confirmFirst(row.id)) remove(row.id) }}
 */
export function useArmedDelete(ms = 4000) {
  const [armedKey, setArmedKey] = useState<string | null>(null)
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => () => window.clearTimeout(timer.current), [])

  function confirmFirst(key = "_"): boolean {
    window.clearTimeout(timer.current)
    if (armedKey === key) {
      setArmedKey(null)
      return true
    }
    setArmedKey(key)
    timer.current = window.setTimeout(() => setArmedKey(null), ms)
    return false
  }

  return { isArmed: (key = "_") => armedKey === key, confirmFirst }
}
