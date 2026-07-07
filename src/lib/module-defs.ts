// Constantes de modules — sans directive "use client" pour être importables côté serveur et client.

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
  | "impots"

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
  icon:          string
  category:      ModuleCategory
  defaultActive: boolean
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
    id: "impots", label: "Impôts / URSSAF", icon: "🏛️", category: "recommended", defaultActive: true,
    description: "Déclarations URSSAF, cotisations et suivi des factures déclarées",
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
export const CATEGORY_ORDER: ModuleCategory[] = ["core", "recommended", "bonus"]
export const MODULES_COOKIE = "erp-active-modules"
