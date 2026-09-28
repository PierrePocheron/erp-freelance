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

// Ajoute n mois à une date en clonant (ne mute pas l'argument).
//
// ⚠️ `setMonth` seul NORMALISE le débordement : 31 janvier + 1 mois donne
// « 31 février » → 3 mars. Une échéance mensuelle ancrée au 29, 30 ou 31 sautait
// donc un mois entier (février jamais facturé / jamais prélevé) puis dérivait
// définitivement au 3. On décale sur le 1er, puis on clampe au dernier jour du
// mois cible — le comportement attendu d'une échéance « le 31 de chaque mois ».
export function addMonths(date: Date, months: number): Date {
  const next = new Date(date)
  const day = next.getDate()
  next.setDate(1)
  next.setMonth(next.getMonth() + months)
  const lastDayOfTargetMonth = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate()
  next.setDate(Math.min(day, lastDayOfTargetMonth))
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
  if (frequency === "WEEKLY") {
    const next = new Date(date)
    next.setDate(next.getDate() + 7)
    return next
  }
  // Passe par addMonths, qui clampe au dernier jour du mois cible (cf. son
  // commentaire) : sans ça une échéance au 31 sautait février.
  if (frequency === "MONTHLY") return addMonths(date, 1)
  if (frequency === "QUARTERLY") return addMonths(date, 3)
  if (frequency === "YEARLY") return addMonths(date, 12)
  return new Date(date)
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
  return zonedInstant(y, m, d, 0, 0, timeZone)
}

/**
 * Instant correspondant à une HEURE MURALE dans un fuseau donné (2026-10-31 14:00
 * à Paris → l'instant UTC qui affiche 14 h à Paris ce jour-là). Même méthode que
 * `zonedMidnight` : on pose une hypothèse en UTC, on lit ce qu'elle donne dans le
 * fuseau, et on corrige de l'écart constaté.
 */
export function zonedInstant(
  y: number, m: number, d: number, hour = 0, minute = 0, timeZone = "Europe/Paris",
): Date {
  const guess = Date.UTC(y, m - 1, d, hour, minute)
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone, hour12: false, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })
      .formatToParts(new Date(guess)).map((p) => [p.type, p.value]),
  )
  // Heure lue dans le fuseau pour l'instant supposé → décalage du fuseau à cette date
  const seenAsUtc = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour) % 24, Number(parts.minute))
  return new Date(guess - (seenAsUtc - guess))
}

/**
 * Parse une date reçue d'un formulaire.
 *
 * `new Date("2026-10-31")` vaut minuit UTC — soit 02 h du matin à Paris : une
 * échéance saisie au 31 était stockée « le 31 à 02 h », donc marquée en retard
 * dès 02 h 00 le jour même, et affichée comme un créneau de nuit au calendrier
 * au lieu d'une journée entière. Une heure murale ("…T14:00") est de son côté
 * interprétée dans le fuseau du PROCESS, soit UTC en production (décalage de 2 h).
 * Ici, les deux formes sont lues en heure de Paris. Une chaîne déjà horodatée
 * (suffixe Z ou décalage) est un instant : elle passe telle quelle.
 */
export function parseCivilDate(s: string, timeZone = "Europe/Paris"): Date {
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  if (dateOnly) {
    const [, y, m, d] = dateOnly
    return zonedInstant(Number(y), Number(m), Number(d), 0, 0, timeZone)
  }
  const local = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?$/.exec(s)
  if (local) {
    const [, y, m, d, h, min] = local
    return zonedInstant(Number(y), Number(m), Number(d), Number(h), Number(min), timeZone)
  }
  return new Date(s)
}

/** Parse une date Google : date seule → minuit Europe/Paris ; dateTime ISO → tel quel. */
export function parseGoogleDate(s: string, timeZone = "Europe/Paris"): Date {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? zonedMidnight(s, timeZone) : new Date(s)
}

// ── Fuseau de l'app ───────────────────────────────────────────────────────────
// Vercel exécute les fonctions en UTC et REFUSE la variable d'environnement `TZ`
// (nom réservé) : impossible de régler le problème par la configuration. Tout ce
// qui raisonne en jours civils doit donc lire ses composantes dans le fuseau de
// l'app, jamais via getFullYear/getMonth/getDate/getHours (fuseau du process).

export const APP_TIME_ZONE = "Europe/Paris"

const PARTS_FMT = new Intl.DateTimeFormat("en-US", {
  timeZone: APP_TIME_ZONE, hour12: false,
  year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
})

/** Composantes civiles d'un instant DANS le fuseau de l'app (mois 1-12). */
export function zonedParts(date: Date): { year: number; month: number; day: number; hour: number; minute: number } {
  const p = Object.fromEntries(PARTS_FMT.formatToParts(date).map((x) => [x.type, x.value]))
  return {
    year: Number(p.year),
    month: Number(p.month),
    day: Number(p.day),
    // « 24 » est possible pour minuit avec hour12: false selon l'implémentation.
    hour: Number(p.hour) % 24,
    minute: Number(p.minute),
  }
}

/** "AAAA-MM-JJ" du jour civil d'un instant, dans le fuseau de l'app. */
export function zonedDateKey(date: Date): string {
  const { year, month, day } = zonedParts(date)
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
}

/** Minuit (dans le fuseau de l'app) du jour civil qui contient `date`. */
export function zonedDayStart(date: Date): Date {
  return zonedMidnight(zonedDateKey(date))
}

/**
 * Minuit du jour civil décalé de `days` jours — l'arithmétique se fait sur les
 * composantes civiles, donc une nuit de changement d'heure (23 h ou 25 h) ne
 * décale pas le résultat.
 */
export function zonedDayStartOffset(date: Date, days: number): Date {
  const { year, month, day } = zonedParts(date)
  const shifted = new Date(Date.UTC(year, month - 1, day + days))
  const key = `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}-${String(shifted.getUTCDate()).padStart(2, "0")}`
  return zonedMidnight(key)
}

/**
 * Jour de la semaine du jour civil, dans le fuseau de l'app (0 = dimanche).
 * Calculé depuis les composantes civiles : une fois l'année, le mois et le jour
 * connus, le jour de la semaine ne dépend plus d'aucun fuseau.
 */
export function zonedWeekday(date: Date): number {
  const { year, month, day } = zonedParts(date)
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay()
}

/** Dernier instant du jour civil (23:59:59.999 heure de l'app). */
export function zonedDayEnd(date: Date): Date {
  return new Date(zonedDayStartOffset(date, 1).getTime() - 1)
}

/**
 * L'instant tombe-t-il à minuit PILE dans le fuseau de l'app ? C'est la
 * convention « journée entière » du calendrier (une tâche sans heure). Testé
 * avec `getHours()`, une tâche saisie à minuit à Paris paraissait être à 22 h ou
 * 23 h en production, donc affichée comme un créneau de nuit.
 */
export function isZonedAllDay(date: Date): boolean {
  const { hour, minute } = zonedParts(date)
  return hour === 0 && minute === 0
}
