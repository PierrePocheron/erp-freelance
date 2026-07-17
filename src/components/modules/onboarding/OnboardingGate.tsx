"use client"

import { useEffect, useState } from "react"
import { useModules, readNeedsOnboarding, type ModuleId } from "@/hooks/use-modules"
import { OnboardingDialog } from "./OnboardingDialog"
import { START_UI_TOUR_EVENT } from "./UiTour"

// Événement custom permettant de rouvrir l'écran depuis les paramètres.
export const OPEN_ONBOARDING_EVENT = "erp:open-onboarding"

export function OnboardingGate() {
  const { activeModules, completeOnboarding } = useModules()
  const [mode, setMode] = useState<"auto" | "manual" | null>(null)

  // Première connexion : ouvre automatiquement si l'onboarding n'a jamais été fait.
  useEffect(() => {
    if (readNeedsOnboarding()) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMode("auto")
    }
  }, [])

  // Réouverture manuelle depuis les paramètres.
  useEffect(() => {
    const handler = () => setMode("manual")
    window.addEventListener(OPEN_ONBOARDING_EVENT, handler)
    return () => window.removeEventListener(OPEN_ONBOARDING_EVENT, handler)
  }, [])

  if (mode === null) return null

  return (
    <OnboardingDialog
      mode={mode}
      initialSelection={[...activeModules] as ModuleId[]}
      onValidate={(ids) => {
        const isFirstRun = mode === "auto"
        completeOnboarding(ids)
        setMode(null)
        // Première connexion : enchaîne sur le tour guidé de l'interface
        if (isFirstRun) window.dispatchEvent(new CustomEvent(START_UI_TOUR_EVENT))
      }}
      onCancel={mode === "manual" ? () => setMode(null) : undefined}
    />
  )
}
