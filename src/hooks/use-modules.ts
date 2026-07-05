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
// Diffusé à chaque écriture pour resynchroniser toutes les instances du hook
// (Sidebar, CommandPalette, ModulesPanel...) sans passer par un contexte React.
const MODULES_CHANGED_EVENT = "erp-modules-changed"

function writeCookie(ids: ModuleId[]) {
  if (typeof document === "undefined") return
  document.cookie = `${MODULES_COOKIE}=${encodeURIComponent(JSON.stringify(ids))};path=/;max-age=${COOKIE_MAX_AGE};SameSite=Lax`
}

function persist(ids: ModuleId[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ids))
  writeCookie(ids)
  window.dispatchEvent(new Event(MODULES_CHANGED_EVENT))
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

  // Hydrate depuis localStorage côté client + synchronise le cookie serveur.
  // Se resynchronise aussi sur MODULES_CHANGED_EVENT : chaque composant appelle
  // useModules() indépendamment (Sidebar, CommandPalette, ModulesPanel...) et
  // possède donc son propre state React — sans cet événement, activer/désactiver
  // un module depuis un composant ne serait jamais vu par les autres.
  useEffect(() => {
    const sync = () => setActiveModules(readFromStorage())
    sync()
    writeCookie([...readFromStorage()])
    window.addEventListener(MODULES_CHANGED_EVENT, sync)
    return () => window.removeEventListener(MODULES_CHANGED_EVENT, sync)
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
      persist([...next])
      return next
    })
  }, [])

  const enableAll = useCallback(() => {
    const all = new Set<ModuleId>(ALL_MODULE_IDS)
    persist([...all])
    setActiveModules(all)
  }, [])

  // Applique une sélection complète (utilisé par l'écran d'initialisation).
  const setModules = useCallback((ids: ModuleId[]) => {
    const set = new Set<ModuleId>(ids.filter(id => ALL_MODULE_IDS.includes(id)))
    persist([...set])
    setActiveModules(set)
  }, [])

  // Termine l'onboarding : enregistre la sélection + marque l'écran comme vu.
  const completeOnboarding = useCallback((ids: ModuleId[]) => {
    setModules(ids)
    localStorage.setItem(ONBOARDING_KEY, "true")
  }, [setModules])

  return { activeModules, isActive, toggle, enableAll, setModules, completeOnboarding }
}
