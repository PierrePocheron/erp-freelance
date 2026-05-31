// Calculs monétaires purs (sans I/O), partagés entre les Server Actions, le rendu
// PDF et l'affichage. Tout est en euros HT sauf mention contraire ; aucune logique
// d'arrondi n'est introduite ici afin de conserver le comportement historique.

export type MoneyLine = { taxRate: number; total: number }

// Total d'une ligne = quantité × prix unitaire.
export function lineTotal(quantity: number, unitPrice: number): number {
  return quantity * unitPrice
}

// Somme des totaux de lignes (totalHT d'un document).
export function sumLineTotals(lines: { total: number }[]): number {
  return lines.reduce((s, l) => s + l.total, 0)
}

// Montant net à payer = total HT − acompte déjà déduit.
export function netAmount(totalHT: number, depositDeducted: number): number {
  return totalHT - depositDeducted
}

// Montant d'un acompte théorique = total HT × pourcentage.
export function depositAmount(totalHT: number, depositPercent: number): number {
  return totalHT * (depositPercent / 100)
}

export type TaxBreakdown = {
  byRate: Record<number, number>
  totalTVA: number
  totalTTC: number
  allZeroTax: boolean
}

// Ventilation de la TVA par taux + TTC. Réplique exacte du calcul du PDF.
export function computeTaxBreakdown(lines: MoneyLine[], totalHT: number): TaxBreakdown {
  const byRate: Record<number, number> = {}
  for (const l of lines) {
    byRate[l.taxRate] = (byRate[l.taxRate] ?? 0) + l.total * (l.taxRate / 100)
  }
  const totalTVA = Object.values(byRate).reduce((s, v) => s + v, 0)
  return {
    byRate,
    totalTVA,
    totalTTC: totalHT + totalTVA,
    allZeroTax: totalTVA === 0,
  }
}

// Acompte à déduire sur une facture de solde : on retient les acomptes réellement
// facturés (factures DEPOSIT non annulées) ; à défaut, on retombe sur le % du devis.
export function computeDepositDeducted(
  depositInvoiceTotals: number[],
  quoteTotalHT: number,
  quoteDepositPercent: number
): number {
  const sum = depositInvoiceTotals.reduce((s, t) => s + t, 0)
  if (sum === 0 && quoteDepositPercent > 0) {
    return depositAmount(quoteTotalHT, quoteDepositPercent)
  }
  return sum
}

// Une facture est soldée lorsque le total réglé couvre le net (tolérance 1 centime).
export function isInvoiceSettled(net: number, totalPaid: number): boolean {
  return net > 0 && totalPaid >= net - 0.01
}
