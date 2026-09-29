// Gardes de transition pures pour les machines à états devis/facture. Centralise
// les règles de verrouillage d'édition et de transition appliquées côté serveur,
// pour pouvoir les tester sans base ni session.

export type InvoiceStatus =
  | "DRAFT"
  | "ISSUED"
  | "SENT"
  | "LATE"
  | "PAID"
  | "CANCELLED"

export type QuoteStatus =
  | "DRAFT"
  | "VALIDATED"
  | "SENT"
  | "ACCEPTED"
  | "SIGNED"
  | "REFUSED"
  | "EXPIRED"

// Une facture n'est éditable (lignes, montants, conditions) qu'à l'état brouillon.
export function isInvoiceEditable(status: string): boolean {
  return status === "DRAFT"
}

// Un devis n'est éditable qu'à l'état brouillon.
export function isQuoteEditable(status: string): boolean {
  return status === "DRAFT"
}

// Seule une facture en brouillon peut être émise.
export function canIssueInvoice(status: string): boolean {
  return status === "DRAFT"
}

// On annule une facture déjà émise (ni brouillon, ni déjà annulée).
export function canCancelInvoice(status: string): boolean {
  return status !== "DRAFT" && status !== "CANCELLED"
}

// Seul un devis validé (pas encore envoyé) peut repasser en brouillon.
export function canRevertQuoteToDraft(status: string): boolean {
  return status === "VALIDATED"
}

// Statuts qui comptent dans un agrégat « facturé ». Un BROUILLON n'est pas un
// engagement (montants encore modifiables, jamais transmis), une facture ANNULÉE
// n'en est plus un — or le workflow de correction est « annuler + dupliquer »,
// donc chaque correction gonflait les totaux qui ne filtraient pas.
export const BILLABLE_INVOICE_STATUSES = ["ISSUED", "SENT", "LATE", "PAID"] as const

export function isBillableInvoice(status: string): boolean {
  return (BILLABLE_INVOICE_STATUSES as readonly string[]).includes(status)
}

// Statuts d'une facture émise mais pas encore réglée (l'encours).
export const UNPAID_INVOICE_STATUSES = ["ISSUED", "SENT", "LATE"] as const

// Libellé et teinte d'un statut de facture — UNE seule table. Trois copies locales
// ne connaissaient que DRAFT/SENT/PAID/LATE : une facture émise ou annulée
// s'affichait « ISSUED » / « CANCELLED » en brut, sans couleur.
export const INVOICE_STATUS_META: Record<InvoiceStatus, { label: string; cls: string }> = {
  DRAFT:     { label: "Brouillon", cls: "bg-muted text-muted-foreground border-border" },
  ISSUED:    { label: "Émise",     cls: "bg-violet-500/15 text-violet-600 border-violet-500/20" },
  SENT:      { label: "Envoyée",   cls: "bg-blue-500/15 text-blue-600 border-blue-500/20" },
  PAID:      { label: "Payée",     cls: "bg-emerald-500/15 text-emerald-600 border-emerald-500/20" },
  LATE:      { label: "En retard", cls: "bg-red-500/15 text-red-600 border-red-500/20" },
  CANCELLED: { label: "Annulée",   cls: "bg-muted text-muted-foreground border-border line-through" },
}

export function invoiceStatusMeta(status: string): { label: string; cls: string } {
  return INVOICE_STATUS_META[status as InvoiceStatus] ?? { label: status, cls: "bg-muted text-muted-foreground border-border" }
}
