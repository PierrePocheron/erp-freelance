"use client"

import { useCallback, useEffect, useState } from "react"

// ── Définition des modules disponibles ────────────────────────────────────────

export type ModuleId =
  | "contacts"
  | "societes"
  | "facturation"
  | "revenus"
  | "projets"
  | "taches"
  | "calendrier"
  | "graph"
  | "sante"
  | "entretien"

// Catégorie d'un module — structure l'écran d'initialisation.
export type ModuleCategory = "core" | "recommended" | "bonus"

export const CATEGORY_META: Record<ModuleCategory, { label: string; description: string }> = {
  core:        { label: "Essentiels",  description: "Le socle d'un freelance : contacts, facturation, projets, tâches" },
  recommended: { label: "Recommandés", description: "Confort au quotidien : sociétés, revenus, calendrier" },
  bonus:       { label: "Bonus",       description: "Suivis optionnels selon vos besoins" },
}

export type ModuleDef = {
  id:            ModuleId
  label:         string
  description:   string
  icon:          string         // emoji pour affichage rapide
  category:      ModuleCategory
  defaultActive: boolean        // false → désactivé par défaut, activation manuelle requise
}

export const MODULE_DEFS: ModuleDef[] = [
  {
    id: "contacts", label: "Contacts / CRM", icon: "👥", category: "core", defaultActive: true,
    description: "Gestion des contacts, prospects, clients et interactions",
  },
  {
    id: "facturation", label: "Facturation", icon: "💳", category: "core", defaultActive: true,
    description: "Devis, factures, acomptes et conditions de paiement",
  },
  {
    id: "projets", label: "Projets", icon: "💻", category: "core", defaultActive: true,
    description: "Suivi des projets, jalons, temps passé et statut",
  },
  {
    id: "taches", label: "Tâches", icon: "✅", category: "core", defaultActive: true,
    description: "Gestion des tâches et kanban global",
  },
  {
    id: "societes", label: "Sociétés", icon: "🏢", category: "recommended", defaultActive: true,
    description: "Répertoire des entreprises clientes avec leurs projets et contacts",
  },
  {
    id: "revenus", label: "Revenus", icon: "💰", category: "recommended", defaultActive: true,
    description: "Suivi des revenus manuels, récurrents et récapitulatif fiscal",
  },
  {
    id: "calendrier", label: "Calendrier", icon: "📅", category: "recommended", defaultActive: true,
    description: "Agenda, rappels, interactions et événements",
  },
  {
    id: "graph", label: "Graph relationnel", icon: "🕸️", category: "bonus", defaultActive: false,
    description: "Vue graphe de toutes vos relations clients / projets / factures",
  },
  {
    id: "sante", label: "Santé", icon: "🏥", category: "bonus", defaultActive: false,
    description: "Suivi des blessures, maladies, consultations et remboursements",
  },
  {
    id: "entretien", label: "Entretiens", icon: "💼", category: "bonus", defaultActive: false,
    description: "Suivi des candidatures, processus de recrutement et démarchage",
  },
]

export const ALL_MODULE_IDS = MODULE_DEFS.map(m => m.id)
// Catégories ordonnées pour l'affichage de l'onboarding.
export const CATEGORY_ORDER: ModuleCategory[] = ["core", "recommended", "bonus"]
// IDs actifs par défaut (modules avec defaultActive: true) = pré-sélection onboarding.
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
export const MODULES_COOKIE = "erp-active-modules"
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
