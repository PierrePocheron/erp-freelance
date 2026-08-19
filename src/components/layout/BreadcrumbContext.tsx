"use client"

import { createContext, useCallback, useContext, useEffect, useState } from "react"

/**
 * Contexte du fil d'Ariane : les pages/layouts de détail y publient le libellé
 * de leur segment dynamique (ex. `value` = id du contact, `label` = son nom),
 * que `AppBreadcrumbs` lit pour nommer le crumb correspondant. Le provider
 * enveloppe le header ET le contenu (dans le layout applicatif) pour que les
 * deux partagent le même état.
 */
type BreadcrumbCtx = {
  labels: Record<string, string>
  setLabel: (value: string, label: string) => void
}

const Ctx = createContext<BreadcrumbCtx | null>(null)

export function BreadcrumbProvider({ children }: { children: React.ReactNode }) {
  const [labels, setLabels] = useState<Record<string, string>>({})
  const setLabel = useCallback((value: string, label: string) => {
    setLabels((prev) => (prev[value] === label ? prev : { ...prev, [value]: label }))
  }, [])
  return <Ctx.Provider value={{ labels, setLabel }}>{children}</Ctx.Provider>
}

export function useBreadcrumbLabels(): Record<string, string> {
  return useContext(Ctx)?.labels ?? {}
}

/**
 * Publie le libellé d'un segment dynamique du fil d'Ariane. À rendre dans une
 * page/layout de détail (composant serveur possible : il rend ce client léger).
 * Ex. `<SetBreadcrumbLabel value={id} label={client.name} />`.
 */
export function SetBreadcrumbLabel({ value, label }: { value: string; label: string }) {
  const ctx = useContext(Ctx)
  const setLabel = ctx?.setLabel
  useEffect(() => {
    if (setLabel && value && label) setLabel(value, label)
  }, [setLabel, value, label])
  return null
}
