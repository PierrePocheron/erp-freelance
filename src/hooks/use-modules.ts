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

export type ModuleDef = {
  id:            ModuleId
  label:         string
  description:   string
  icon:          string   // emoji pour affichage rapide
  defaultActive: boolean  // false → désactivé par défaut, activation manuelle requise
}

export const MODULE_DEFS: ModuleDef[] = [
  {
    id: "contacts", label: "Contacts / CRM", icon: "👥", defaultActive: true,
    description: "Gestion des contacts, prospects, clients et interactions",
  },
  {
    id: "societes", label: "Sociétés", icon: "🏢", defaultActive: true,
    description: "Répertoire des entreprises clientes avec leurs projets et contacts",
  },
  {
    id: "facturation", label: "Facturation", icon: "💳", defaultActive: true,
    description: "Devis, factures, acomptes et conditions de paiement",
  },
  {
    id: "revenus", label: "Revenus", icon: "💰", defaultActive: true,
    description: "Suivi des revenus manuels, récurrents et récapitulatif fiscal",
  },
  {
    id: "projets", label: "Projets", icon: "💻", defaultActive: true,
    description: "Suivi des projets, jalons, temps passé et statut",
  },
  {
    id: "taches", label: "Tâches", icon: "✅", defaultActive: true,
    description: "Gestion des tâches et kanban global",
  },
  {
    id: "calendrier", label: "Calendrier", icon: "📅", defaultActive: true,
    description: "Agenda, rappels, interactions et événements",
  },
  {
    id: "graph", label: "Graph relationnel", icon: "🕸️", defaultActive: true,
    description: "Vue graphe de toutes vos relations clients / projets / factures",
  },
  {
    id: "sante", label: "Santé", icon: "🏥", defaultActive: false,
    description: "Suivi des blessures, maladies, consultations et remboursements",
  },
  {
    id: "entretien", label: "Entretiens", icon: "💼", defaultActive: false,
    description: "Suivi des candidatures, processus de recrutement et démarchage",
  },
]

export const ALL_MODULE_IDS = MODULE_DEFS.map(m => m.id)
// IDs actifs par défaut (modules avec defaultActive: true)
const DEFAULT_ACTIVE_IDS = MODULE_DEFS.filter(m => m.defaultActive).map(m => m.id)

const STORAGE_KEY = "erp-active-modules"

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

  // Hydrate depuis localStorage côté client
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActiveModules(readFromStorage())
  }, [])

  const isActive = useCallback(
    (id: ModuleId) => activeModules.has(id),
    [activeModules]
  )

  const toggle = useCallback((id: ModuleId) => {
    setActiveModules(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]))
      return next
    })
  }, [])

  const enableAll = useCallback(() => {
    const all = new Set<ModuleId>(ALL_MODULE_IDS)
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...all]))
    setActiveModules(all)
  }, [])

  return { activeModules, isActive, toggle, enableAll }
}
