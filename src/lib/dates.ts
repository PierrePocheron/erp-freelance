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

// Garde-fou anti-boucle infinie : une fréquence inconnue (ex "CUSTOM") laisse
// la date inchangée dans advanceByFrequency, donc sans cette limite les
// boucles ci-dessous ne se termineraient jamais.
const MAX_OCCURRENCE_ITERATIONS = 1000

// Toutes les occurrences d'une récurrence (démarrant à `start`, cadencée par
// `frequency`) tombant dans la fenêtre [from, to] (bornes incluses). Utilisé
// pour projeter les dépenses récurrentes sur le calendrier sans matérialiser
// de lignes en base.
export function getOccurrencesInRange(start: Date, frequency: string, from: Date, to: Date): Date[] {
  if (to.getTime() < from.getTime()) return []

  let cursor = new Date(start)
  let iterations = 0

  // Avance jusqu'à entrer dans la fenêtre.
  while (cursor.getTime() < from.getTime()) {
    const next = advanceByFrequency(cursor, frequency)
    if (next.getTime() === cursor.getTime()) return [] // fréquence inconnue → aucune progression possible
    cursor = next
    if (++iterations > MAX_OCCURRENCE_ITERATIONS) return []
  }

  const occurrences: Date[] = []
  while (cursor.getTime() <= to.getTime()) {
    occurrences.push(new Date(cursor))
    const next = advanceByFrequency(cursor, frequency)
    if (next.getTime() === cursor.getTime()) break
    cursor = next
    if (++iterations > MAX_OCCURRENCE_ITERATIONS) break
  }
  return occurrences
}
