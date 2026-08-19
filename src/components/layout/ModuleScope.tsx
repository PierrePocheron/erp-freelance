"use client"

import { useMemo } from "react"
import { setUserScope, migrateLegacyKeysOnce } from "@/hooks/use-modules"

/**
 * Positionne le scope par utilisateur des clés modules/onboarding/tour AVANT que
 * les autres composants ne lisent le storage. `useMemo` s'exécute pendant le
 * rendu — et React exécute TOUT le rendu de l'arbre avant le moindre `useEffect`
 * — donc le suffixe est en place quand Sidebar/OnboardingGate/UiTour montent
 * leurs effets, quel que soit l'ordre JSX. Ne fait rien côté serveur (le storage
 * y est de toute façon inaccessible).
 */
export function ModuleScope({ userId }: { userId: string }) {
  useMemo(() => {
    if (typeof window === "undefined") return
    setUserScope(userId)
    migrateLegacyKeysOnce(userId)
  }, [userId])
  return null
}
