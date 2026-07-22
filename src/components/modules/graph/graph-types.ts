export type NodeType = "SOURCE" | "COMPANY" | "CLIENT" | "PROSPECT" | "PERSONAL" | "PROJECT" | "INVOICE" | "QUOTE" | "REVENUE" | "RESALE" | "APPLICATION"

export type RawNode = {
  id:         string
  type:       NodeType
  label:      string
  parentId:   string | null
  status?:    string
  amount?:    number
  incomplete?: boolean
  /** Nœud replié au chargement (hubs volumineux, ex. Prospection et ses ~230 enfants) */
  defaultCollapsed?: boolean
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
  SOURCE:      28,
  COMPANY:     22,
  CLIENT:      15,
  PROSPECT:    11,
  PERSONAL:    14,
  PROJECT:     15,
  INVOICE:     13,
  QUOTE:       13,
  REVENUE:     11,
  RESALE:      10,
  APPLICATION: 12,
}

export const NODE_BASE_COLORS: Record<NodeType, string> = {
  SOURCE:      "#e879f9", // fuchsia — override par la couleur de la source
  COMPANY:     "#f59e0b",
  CLIENT:      "#60a5fa",
  PROSPECT:    "#fb7185", // rose — prospect (démarchage, pas encore client)
  PERSONAL:    "#2dd4bf", // teal — proche / contact perso
  PROJECT:     "#a78bfa",
  INVOICE:     "#34d399",
  QUOTE:       "#22d3ee",
  REVENUE:     "#fb923c", // orange — revenu reçu ou attendu
  RESALE:      "#14b8a6", // teal — revente d'objets perso (Vinted/LBC/Momox)
  APPLICATION: "#818cf8", // indigo — candidature / entretien
}

export const REVENUE_STATUS_COLOR: Record<string, string> = {
  RECEIVED: "#fb923c",  // orange vif   — reçu (= couleur de base)
  PENDING:  "#fed7aa",  // orange pâle  — en attente
}

export const RESALE_STATUS_COLOR: Record<string, string> = {
  RECEIVED: "#14b8a6",  // teal vif   — vendu & encaissé (= couleur de base)
  PENDING:  "#99f6e4",  // teal pâle  — vendu, argent pas encore reçu
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

export const APPLICATION_STATUS_COLOR: Record<string, string> = {
  WISHLIST:   "#94a3b8",
  APPLIED:    "#60a5fa",
  SCREENING:  "#c084fc",
  INTERVIEW:  "#818cf8",
  TECHNICAL:  "#818cf8",
  FINAL:      "#7c3aed",
  OFFER:      "#34d399",
  ACCEPTED:   "#22c55e",
  REJECTED:   "#f87171",
  WITHDRAWN:  "#9ca3af",
  GHOSTED:    "#6b7280",
}

export const NODE_TYPE_LABELS: Record<NodeType, string> = {
  SOURCE:      "Source fiscale",
  COMPANY:     "Société",
  CLIENT:      "Contact",
  PROSPECT:    "Prospect",
  PERSONAL:    "Perso",
  PROJECT:     "Projet",
  INVOICE:     "Facture",
  QUOTE:       "Devis",
  REVENUE:     "Revenu",
  RESALE:      "Revente",
  APPLICATION: "Candidature",
}

export function nodeColor(node: RawNode): string {
  if (node.type === "INVOICE"      && node.status) return INVOICE_STATUS_COLOR[node.status]      ?? NODE_BASE_COLORS.INVOICE
  if (node.type === "PROJECT"      && node.status) return PROJECT_STATUS_COLOR[node.status]      ?? NODE_BASE_COLORS.PROJECT
  if (node.type === "REVENUE"      && node.status) return REVENUE_STATUS_COLOR[node.status]      ?? NODE_BASE_COLORS.REVENUE
  if (node.type === "RESALE"       && node.status) return RESALE_STATUS_COLOR[node.status]       ?? NODE_BASE_COLORS.RESALE
  if (node.type === "APPLICATION"  && node.status) return APPLICATION_STATUS_COLOR[node.status]  ?? NODE_BASE_COLORS.APPLICATION
  return NODE_BASE_COLORS[node.type]
}
