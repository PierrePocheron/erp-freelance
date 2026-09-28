// Helpers de dates purs (sans I/O). Réplique exacte des calculs disséminés dans
// les Server Actions, isolés pour être testables (échéances, reconductions, retard).

const DAY_MS = 24 * 60 * 60 * 1000

// Formate une Date en "YYYY-MM-DD" en heure LOCALE, pour pré-remplir un champ date
// (<input type="date"> ou champ maison). NE PAS utiliser toISOString().slice(0,10) :
// il bascule l'instant en UTC, donc une date stockée à minuit local en fuseau UTC+
// (Paris) recule d'un jour à l'affichage — et se corrompt à chaque ré-enregistrement,
// car la sauvegarde, elle, reconstruit la date en heure locale (`${v}T00:00:00`).
export function toDateInput(date: Date): string {
  const d = new Date(date)
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

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

export type RecurringFrequency = "WEEKLY" | "MONTHLY" | "QUARTERLY" | "YEARLY"

// Avance une date selon la fréquence d'une facture récurrente. Une fréquence
// inconnue laisse la date inchangée (comportement historique).
export function advanceByFrequency(date: Date, frequency: string): Date {
  const next = new Date(date)
  if (frequency === "WEEKLY") next.setDate(next.getDate() + 7)
  else if (frequency === "MONTHLY") next.setMonth(next.getMonth() + 1)
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

/**
 * Instant correspondant à MINUIT d'une date civile ("AAAA-MM-JJ") dans un fuseau donné,
 * quel que soit le fuseau du serveur (Vercel tourne en UTC). Indispensable pour les
 * événements « journée entière » reçus en date seule (Google Agenda) : `new Date("2026-09-10")`
 * vaut minuit UTC = 02:00 à Paris, et l'événement débordait sur le lendemain.
 */
export function zonedMidnight(dateOnly: string, timeZone = "Europe/Paris"): Date {
  const [y, m, d] = dateOnly.split("-").map(Number)
  const guess = Date.UTC(y, m - 1, d)
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone, hour12: false, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })
      .formatToParts(new Date(guess)).map((p) => [p.type, p.value]),
  )
  // Heure lue dans le fuseau pour l'instant « minuit UTC » → décalage du fuseau à cette date
  const seenAsUtc = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour) % 24, Number(parts.minute))
  return new Date(guess - (seenAsUtc - guess))
}

/** Parse une date Google : date seule → minuit Europe/Paris ; dateTime ISO → tel quel. */
export function parseGoogleDate(s: string, timeZone = "Europe/Paris"): Date {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? zonedMidnight(s, timeZone) : new Date(s)
}
