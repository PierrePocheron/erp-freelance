// Helpers de dates purs (sans I/O). Réplique exacte des calculs disséminés dans
// les Server Actions, isolés pour être testables (échéances, reconductions, retard).

const DAY_MS = 24 * 60 * 60 * 1000

// Ajoute n mois à une date en clonant (ne mute pas l'argument). S'appuie sur
// Date.setMonth, qui gère le report d'année et la normalisation des jours.
export function addMonths(date: Date, months: number): Date {
  const next = new Date(date)
  next.setMonth(next.getMonth() + months)
  return next
}

// Date d'expiration = maintenant + n jours (null si non renseigné).
export function expiresAtFromDays(days: number | null | undefined, now: Date = new Date()): Date | null {
  if (!days) return null
  return new Date(now.getTime() + days * DAY_MS)
}

// Nombre de jours de retard d'une facture (arrondi au jour supérieur). null si
// aucune échéance. Peut être négatif si l'échéance est dans le futur.
export function daysLate(dueDate: Date | null | undefined, now: Date = new Date()): number | null {
  if (!dueDate) return null
  return Math.ceil((now.getTime() - new Date(dueDate).getTime()) / DAY_MS)
}

export type RecurringFrequency = "MONTHLY" | "QUARTERLY" | "YEARLY"

// Avance une date selon la fréquence d'une facture récurrente. Une fréquence
// inconnue laisse la date inchangée (comportement historique).
export function advanceByFrequency(date: Date, frequency: string): Date {
  const next = new Date(date)
  if (frequency === "MONTHLY") next.setMonth(next.getMonth() + 1)
  else if (frequency === "QUARTERLY") next.setMonth(next.getMonth() + 3)
  else if (frequency === "YEARLY") next.setFullYear(next.getFullYear() + 1)
  return next
}
