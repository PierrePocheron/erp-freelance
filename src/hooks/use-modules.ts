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

export type ModuleDef = {
  id:          ModuleId
  label:       string
  description: string
  icon:        string   // emoji pour affichage rapide
}

export const MODULE_DEFS: ModuleDef[] = [
  {
    id:          "contacts",
    label:       "Contacts / CRM",
    description: "Gestion des contacts, prospects, clients et interactions",
    icon:        "👥",
  },
  {
    id:          "societes",
    label:       "Sociétés",
    description: "Répertoire des entreprises clientes avec leurs projets et contacts",
    icon:        "🏢",
  },
  {
    id:          "facturation",
    label:       "Facturation",
    description: "Devis, factures, acomptes et conditions de paiement",
    icon:        "💳",
  },
  {
    id:          "revenus",
    label:       "Revenus",
    description: "Suivi des revenus manuels, récurrents et récapitulatif fiscal",
    icon:        "💰",
  },
  {
    id:          "projets",
    label:       "Projets",
    description: "Suivi des projets, jalons, temps passé et statut",
    icon:        "💻",
  },
  {
    id:          "taches",
    label:       "Tâches",
    description: "Gestion des tâches et kanban global",
    icon:        "✅",
  },
  {
    id:          "calendrier",
    label:       "Calendrier",
    description: "Agenda, rappels, interactions et événements",
    icon:        "📅",
  },
  {
    id:          "graph",
    label:       "Graph relationnel",
    description: "Vue graphe de toutes vos relations clients / projets / factures",
    icon:        "🕸️",
  },
]

export const ALL_MODULE_IDS = MODULE_DEFS.map(m => m.id)

const STORAGE_KEY = "erp-active-modules"

function readFromStorage(): Set<ModuleId> {
  if (typeof window === "undefined") return new Set(ALL_MODULE_IDS)
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return new Set(ALL_MODULE_IDS)   // tous actifs par défaut
    const parsed = JSON.parse(raw) as ModuleId[]
    return new Set(parsed.filter(id => ALL_MODULE_IDS.includes(id)))
  } catch {
    return new Set(ALL_MODULE_IDS)
  }
}

// ── Hook ───────────────────────────────────────────────────────────────────────

export function useModules() {
  const [activeModules, setActiveModules] = useState<Set<ModuleId>>(
    () => new Set(ALL_MODULE_IDS)  // SSR-safe default
  )

  // Hydrate depuis localStorage côté client
  useEffect(() => {
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
    const all = new Set(ALL_MODULE_IDS)
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...all]))
    setActiveModules(all)
  }, [])

  return { activeModules, isActive, toggle, enableAll }
}
