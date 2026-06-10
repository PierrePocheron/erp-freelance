export type NodeType = "SOURCE" | "COMPANY" | "CLIENT" | "PROJECT" | "INVOICE" | "QUOTE"

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
  CLIENT:  14,
  PROJECT: 14,
  INVOICE: 10,
  QUOTE:   10,
}

export const NODE_BASE_COLORS: Record<NodeType, string> = {
  SOURCE:  "#e879f9", // fuchsia — override par la couleur de la source
  COMPANY: "#f59e0b",
  CLIENT:  "#60a5fa",
  PROJECT: "#a78bfa",
  INVOICE: "#34d399",
  QUOTE:   "#22d3ee",
}

export const INVOICE_STATUS_COLOR: Record<string, string> = {
  PAID:      "#34d399",
  SENT:      "#60a5fa",
  ISSUED:    "#a78bfa",
  LATE:      "#f87171",
  DRAFT:     "#9ca3af",
  CANCELLED: "#6b7280",
}

export const PROJECT_STATUS_COLOR: Record<string, string> = {
  ACTIVE:    "#a78bfa",
  COMPLETED: "#34d399",
  PAUSED:    "#f59e0b",
  CANCELLED: "#6b7280",
}

export const NODE_TYPE_LABELS: Record<NodeType, string> = {
  SOURCE:  "Source fiscale",
  COMPANY: "Société",
  CLIENT:  "Contact",
  PROJECT: "Projet",
  INVOICE: "Facture",
  QUOTE:   "Devis",
}

export function nodeColor(node: RawNode): string {
  if (node.type === "INVOICE" && node.status) return INVOICE_STATUS_COLOR[node.status] ?? NODE_BASE_COLORS.INVOICE
  if (node.type === "PROJECT" && node.status) return PROJECT_STATUS_COLOR[node.status] ?? NODE_BASE_COLORS.PROJECT
  return NODE_BASE_COLORS[node.type]
}
