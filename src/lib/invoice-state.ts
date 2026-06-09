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
