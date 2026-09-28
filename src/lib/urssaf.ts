import { zonedMidnight, zonedParts } from "@/lib/dates"

// Logique pure du module de déclarations URSSAF (auto-entrepreneur).
// Périodes de déclaration, échéances et calcul des cotisations — testable
// sans base ni session. Les taux proviennent de UserProfile (configurables).

export type FiscalCategory = "BNC" | "BIC_SERVICES" | "BIC_SALES"
export type DeclarationFrequency = "MONTHLY" | "QUARTERLY"

export const FISCAL_CATEGORY_LABELS: Record<FiscalCategory, string> = {
  BNC:          "Recettes des activités libérales (BNC)",
  BIC_SERVICES: "Prestations de services (BIC)",
  BIC_SALES:    "Ventes de marchandises (BIC)",
}

export const FISCAL_CATEGORY_SHORT: Record<FiscalCategory, string> = {
  BNC:          "BNC",
  BIC_SERVICES: "BIC presta",
  BIC_SALES:    "BIC ventes",
}

// ── Périodes ──────────────────────────────────────────────────────────────────
// Clé de période : "2026-T2" (trimestriel) ou "2026-07" (mensuel).

// ⚠️ Toutes les bornes de ce fichier sont construites en heure de PARIS, jamais
// via `new Date(y, m, d)` (qui suit le fuseau du process). En production, Vercel
// tourne en UTC et refuse la variable `TZ` (nom réservé) : un encaissement du
// 1er juillet à 00 h 30 heure de Paris serait sinon rangé dans le trimestre
// précédent, et l'échéance du 31 juillet affichée au 1er août.
export function periodKey(date: Date, frequency: DeclarationFrequency): string {
  const { year: y, month } = zonedParts(date)
  const m = month - 1 // 0-based
  if (frequency === "QUARTERLY") return `${y}-T${Math.floor(m / 3) + 1}`
  return `${y}-${String(m + 1).padStart(2, "0")}`
}

/** Minuit (heure de Paris) du 1er jour d'un mois donné ; `month` est 0-based et peut déborder. */
function monthStart(year: number, month: number): Date {
  const y = year + Math.floor(month / 12)
  const m = ((month % 12) + 12) % 12
  return zonedMidnight(`${y}-${String(m + 1).padStart(2, "0")}-01`)
}

export function isQuarterKey(key: string): boolean {
  return /-T[1-4]$/.test(key)
}

/** Bornes civiles de la période : [start inclus, end inclus (fin de journée)]. */
export function periodBounds(key: string): { start: Date; end: Date } {
  const [yStr, part] = key.split("-")
  const y = Number(yStr)
  let startMonth: number
  let endMonth: number // exclusive
  if (part.startsWith("T")) {
    const q = Number(part.slice(1))
    startMonth = (q - 1) * 3
    endMonth = startMonth + 3
  } else {
    startMonth = Number(part) - 1
    endMonth = startMonth + 1
  }
  const start = monthStart(y, startMonth)
  // Fin = dernier instant de la veille du mois suivant (donc 23:59:59.999 à Paris).
  const end = new Date(monthStart(y, endMonth).getTime() - 1)
  return { start, end }
}

/** Échéance URSSAF : dernier jour du mois suivant la fin de période. */
export function declarationDueDate(key: string): Date {
  const { end } = periodBounds(key)
  const { year, month } = zonedParts(end)
  // Dernier instant du mois SUIVANT la fin de période (mois 0-based : month, +1 = suivant).
  return new Date(monthStart(year, month + 1).getTime() - 1)
}

/**
 * Premier jour où la période devient déclarable sur autoentrepreneur.urssaf.fr —
 * le mois suivant la fin de la période (T2 avr–juin → déclarable dès le 1er juillet).
 */
export function declarationAvailableFrom(key: string): Date {
  const { end } = periodBounds(key)
  const { year, month } = zonedParts(end)
  return monthStart(year, month) // month est 1-based ici → 0-based du mois suivant
}

/** Période précédente ("2026-T1" → "2025-T4", "2026-01" → "2025-12"). */
export function previousPeriod(key: string): string {
  const [yStr, part] = key.split("-")
  const y = Number(yStr)
  if (part.startsWith("T")) {
    const q = Number(part.slice(1))
    return q === 1 ? `${y - 1}-T4` : `${y}-T${q - 1}`
  }
  const m = Number(part)
  return m === 1
    ? `${y - 1}-12`
    : `${y}-${String(m - 1).padStart(2, "0")}`
}

/** Période suivante ("2026-T4" → "2027-T1"). */
export function nextPeriod(key: string): string {
  const [yStr, part] = key.split("-")
  const y = Number(yStr)
  if (part.startsWith("T")) {
    const q = Number(part.slice(1))
    return q === 4 ? `${y + 1}-T1` : `${y}-T${q + 1}`
  }
  const m = Number(part)
  return m === 12
    ? `${y + 1}-01`
    : `${y}-${String(m + 1).padStart(2, "0")}`
}

const MONTHS_FR = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
]

/** "2026-T2" → "T2 2026 · avril – juin" ; "2026-07" → "Juillet 2026". */
export function periodLabel(key: string): string {
  const [yStr, part] = key.split("-")
  if (part.startsWith("T")) {
    const q = Number(part.slice(1))
    const m0 = (q - 1) * 3
    return `T${q} ${yStr} · ${MONTHS_FR[m0]} – ${MONTHS_FR[m0 + 2]}`
  }
  const m = Number(part) - 1
  const name = MONTHS_FR[m]
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} ${yStr}`
}

/**
 * Période à déclarer maintenant : la dernière période ÉCHUE.
 * Début juillet en trimestriel → on déclare T2 (avr–juin).
 */
export function periodToDeclare(now: Date, frequency: DeclarationFrequency): string {
  return previousPeriod(periodKey(now, frequency))
}

// ── Calcul des cotisations ────────────────────────────────────────────────────

export type CategoryRates = {
  cotisations: number // % du CA
  vl:          number // % versement libératoire de l'impôt sur le revenu
  cfp:         number // % contribution formation professionnelle
}

export type UrssafRates = Record<FiscalCategory, CategoryRates>

/** Extrait les taux depuis les colonnes plates de UserProfile. */
export function ratesFromProfile(p: {
  rateBNCCotisations: number; rateBNCVL: number; rateBNCCFP: number
  rateBICServicesCotisations: number; rateBICServicesVL: number; rateBICServicesCFP: number
  rateBICSalesCotisations: number; rateBICSalesVL: number; rateBICSalesCFP: number
}): UrssafRates {
  return {
    BNC:          { cotisations: p.rateBNCCotisations,         vl: p.rateBNCVL,         cfp: p.rateBNCCFP },
    BIC_SERVICES: { cotisations: p.rateBICServicesCotisations, vl: p.rateBICServicesVL, cfp: p.rateBICServicesCFP },
    BIC_SALES:    { cotisations: p.rateBICSalesCotisations,    vl: p.rateBICSalesVL,    cfp: p.rateBICSalesCFP },
  }
}

export type CategoryContribution = {
  amount:      number // CA déclaré
  cotisations: number
  vl:          number
  cfp:         number
}

export type ContributionEstimate = {
  byCategory: Record<FiscalCategory, CategoryContribution>
  totalCA:          number
  totalCotisations: number
  totalVL:          number
  totalCFP:         number
  totalDue:         number // cotisations + CFP + VL
}

/**
 * Estimation des sommes dues à l'URSSAF, arrondies à l'euro par composante et
 * par catégorie (comportement observé sur autoentrepreneur.urssaf.fr).
 */
export function computeContributions(
  amounts: Partial<Record<FiscalCategory, number>>,
  rates: UrssafRates,
  vlEnabled: boolean
): ContributionEstimate {
  const categories: FiscalCategory[] = ["BNC", "BIC_SERVICES", "BIC_SALES"]
  const byCategory = {} as Record<FiscalCategory, CategoryContribution>
  let totalCA = 0, totalCotisations = 0, totalVL = 0, totalCFP = 0

  for (const cat of categories) {
    const ca = amounts[cat] ?? 0
    const r  = rates[cat]
    const cotisations = Math.round(ca * r.cotisations / 100)
    const vl          = vlEnabled ? Math.round(ca * r.vl / 100) : 0
    const cfp         = Math.round(ca * r.cfp / 100)
    byCategory[cat] = { amount: ca, cotisations, vl, cfp }
    totalCA          += ca
    totalCotisations += cotisations
    totalVL          += vl
    totalCFP         += cfp
  }

  return {
    byCategory,
    totalCA,
    totalCotisations,
    totalVL,
    totalCFP,
    totalDue: totalCotisations + totalCFP + totalVL,
  }
}
