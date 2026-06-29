"use client"

import { useCallback, useEffect, useState } from "react"

// Constantes partagées — importe ET réexporte depuis le fichier sans directive
// pour que les composants clients puissent continuer à importer depuis ce hook.
import {
  MODULE_DEFS, ALL_MODULE_IDS, MODULES_COOKIE, type ModuleId,
  type ModuleCategory, type ModuleDef, CATEGORY_META, CATEGORY_ORDER,
} from "@/lib/module-defs"

export type { ModuleId, ModuleCategory, ModuleDef }
export { MODULE_DEFS, ALL_MODULE_IDS, MODULES_COOKIE, CATEGORY_META, CATEGORY_ORDER }

const DEFAULT_ACTIVE_IDS = MODULE_DEFS.filter(m => m.defaultActive).map(m => m.id)

const ONBOARDING_KEY = "erp-onboarding-done"

/** Vrai si l'utilisateur n'a encore ni terminé l'onboarding ni configuré ses modules. */
export function readNeedsOnboarding(): boolean {
  if (typeof window === "undefined") return false
  try {
    return localStorage.getItem(ONBOARDING_KEY) === null
      && localStorage.getItem(STORAGE_KEY) === null
  } catch {
    return false
  }
}

const STORAGE_KEY = "erp-active-modules"
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365  // 1 an

function writeCookie(ids: ModuleId[]) {
  if (typeof document === "undefined") return
  document.cookie = `${MODULES_COOKIE}=${encodeURIComponent(JSON.stringify(ids))};path=/;max-age=${COOKIE_MAX_AGE};SameSite=Lax`
}

function readFromStorage(): Set<ModuleId> {
  if (typeof window === "undefined") return new Set(DEFAULT_ACTIVE_IDS)
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return new Set(DEFAULT_ACTIVE_IDS)  // seuls les modules defaultActive: true
    const parsed = JSON.parse(raw) as ModuleId[]
    return new Set(parsed.filter(id => ALL_MODULE_IDS.includes(id)))
  } catch {
    return new Set(DEFAULT_ACTIVE_IDS)
  }
}

// ── Hook ───────────────────────────────────────────────────────────────────────

export function useModules() {
  const [activeModules, setActiveModules] = useState<Set<ModuleId>>(
    () => new Set(DEFAULT_ACTIVE_IDS)  // SSR-safe default (modules defaultActive uniquement)
  )

  // Hydrate depuis localStorage côté client + synchronise le cookie serveur
  useEffect(() => {
    const stored = readFromStorage()
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActiveModules(stored)
    writeCookie([...stored])
  }, [])

  const isActive = useCallback(
    (id: ModuleId) => activeModules.has(id),
    [activeModules]
  )

  const toggle = useCallback((id: ModuleId) => {
    setActiveModules(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      const ids = [...next]
      localStorage.setItem(STORAGE_KEY, JSON.stringify(ids))
      writeCookie(ids)
      return next
    })
  }, [])

  const enableAll = useCallback(() => {
    const all = new Set<ModuleId>(ALL_MODULE_IDS)
    const ids = [...all]
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids))
    writeCookie(ids)
    setActiveModules(all)
  }, [])

  // Applique une sélection complète (utilisé par l'écran d'initialisation).
  const setModules = useCallback((ids: ModuleId[]) => {
    const set = new Set<ModuleId>(ids.filter(id => ALL_MODULE_IDS.includes(id)))
    const validIds = [...set]
    localStorage.setItem(STORAGE_KEY, JSON.stringify(validIds))
    writeCookie(validIds)
    setActiveModules(set)
  }, [])

  // Termine l'onboarding : enregistre la sélection + marque l'écran comme vu.
  const completeOnboarding = useCallback((ids: ModuleId[]) => {
    setModules(ids)
    localStorage.setItem(ONBOARDING_KEY, "true")
  }, [setModules])

  return { activeModules, isActive, toggle, enableAll, setModules, completeOnboarding }
}
