export type NodeType = "SOURCE" | "COMPANY" | "CLIENT" | "PROJECT" | "INVOICE" | "QUOTE" | "REVENUE"

export type RawNode = {
  id:       string
  type:     NodeType
  label:    string
  parentId: string | null
  status?:  string
  amount?:  number
  meta: {
    href?:     string
    subtitle?: string
    color?:    string  // couleur personnalisée (SOURCE nodes)
    details?:  Array<{ label: string; value: string }>
  }
}

export type RawLink = {
  source: string
  target: string
}

// ── Visual constants ─────────────────────────────────────────────────────────

export const NODE_RADIUS: Record<NodeType, number> = {
  SOURCE:  28,
  COMPANY: 22,
  CLIENT:  15,
  PROJECT: 15,
  INVOICE: 13,
  QUOTE:   13,
  REVENUE: 11,
}

export const NODE_BASE_COLORS: Record<NodeType, string> = {
  SOURCE:  "#e879f9", // fuchsia — override par la couleur de la source
  COMPANY: "#f59e0b",
  CLIENT:  "#60a5fa",
  PROJECT: "#a78bfa",
  INVOICE: "#34d399",
  QUOTE:   "#22d3ee",
  REVENUE: "#fb923c", // orange — revenu reçu ou attendu
}

export const REVENUE_STATUS_COLOR: Record<string, string> = {
  RECEIVED: "#fb923c",  // orange vif   — reçu (= couleur de base)
  PENDING:  "#fed7aa",  // orange pâle  — en attente
}

// Couleurs de statut : rester dans la famille de teinte du type parent
// pour éviter toute confusion avec les autres types de nœuds.

export const INVOICE_STATUS_COLOR: Record<string, string> = {
  // Famille verte (INVOICE base = #34d399)
  PAID:      "#34d399",  // emeraude vif — payée (= couleur de base)
  SENT:      "#6ee7b7",  // emeraude clair — envoyée, en attente règlement
  ISSUED:    "#a7f3d0",  // emeraude pâle — émise, pas encore envoyée
  // Hors famille : états problématiques
  LATE:      "#f87171",  // rouge — en retard, urgent
  DRAFT:     "#9ca3af",  // gris — brouillon, pas encore finalisé
  CANCELLED: "#6b7280",  // gris foncé — annulée
}

export const PROJECT_STATUS_COLOR: Record<string, string> = {
  // Famille violette (PROJECT base = #a78bfa)
  ACTIVE:    "#a78bfa",  // violet vif — en cours (= couleur de base)
  COMPLETED: "#c4b5fd",  // violet clair — terminé, livré
  PAUSED:    "#7c3aed",  // violet foncé — en pause
  CANCELLED: "#6b7280",  // gris — annulé
}

export const NODE_TYPE_LABELS: Record<NodeType, string> = {
  SOURCE:  "Source fiscale",
  COMPANY: "Société",
  CLIENT:  "Contact",
  PROJECT: "Projet",
  INVOICE: "Facture",
  QUOTE:   "Devis",
  REVENUE: "Revenu",
}

export function nodeColor(node: RawNode): string {
  if (node.type === "INVOICE" && node.status) return INVOICE_STATUS_COLOR[node.status] ?? NODE_BASE_COLORS.INVOICE
  if (node.type === "PROJECT" && node.status) return PROJECT_STATUS_COLOR[node.status] ?? NODE_BASE_COLORS.PROJECT
  if (node.type === "REVENUE" && node.status) return REVENUE_STATUS_COLOR[node.status] ?? NODE_BASE_COLORS.REVENUE
  return NODE_BASE_COLORS[node.type]
}
