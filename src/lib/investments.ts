// Calculs purs du module Investissements (importable serveur + client, testable).
//
// Modèle : chaque relevé (InvestmentEntry) porte le CAPITAL total sur la plateforme
// à une date + l'APPORT net de la poche ce jour-là (+ dépôt / − retrait), déjà inclus
// dans le capital. Les bénéfices ne comptent jamais les apports :
//   gain d'un intervalle = capital_fin − capital_début − apport_fin
// La rentabilité « vraie » (indépendante du timing des apports) est le rendement
// pondéré par le temps (TWR) : produit des (1 + rendement) de chaque sous-période.

export type InvestmentType = "CROWDLENDING" | "CROWDFUNDING" | "IMMOBILIER" | "PEA" | "AUTRE"

export const INVESTMENT_TYPE_META: Record<InvestmentType, { label: string; icon: string; cls: string; color: string }> = {
  CROWDLENDING: { label: "Crowdlending", icon: "🤝", cls: "bg-indigo-500/15 text-indigo-600 border-indigo-500/25", color: "#6366f1" },
  CROWDFUNDING: { label: "Crowdfunding", icon: "🚀", cls: "bg-violet-500/15 text-violet-600 border-violet-500/25", color: "#8b5cf6" },
  IMMOBILIER:   { label: "Immobilier",   icon: "🏘️", cls: "bg-amber-500/15 text-amber-600 border-amber-500/25",   color: "#f59e0b" },
  PEA:          { label: "PEA / Bourse", icon: "📊", cls: "bg-emerald-500/15 text-emerald-600 border-emerald-500/25", color: "#10b981" },
  AUTRE:        { label: "Autre",        icon: "💠", cls: "bg-slate-500/15 text-slate-600 border-slate-500/25",   color: "#64748b" },
}

export const ALL_INVESTMENT_TYPES: InvestmentType[] = ["CROWDLENDING", "CROWDFUNDING", "IMMOBILIER", "PEA", "AUTRE"]

/**
 * Métadonnées d'affichage pour un type de plateforme. Le type est désormais une chaîne
 * LIBRE : les presets connus (cf. INVESTMENT_TYPE_META) gardent leur icône/couleur ;
 * un type personnalisé retombe sur un rendu neutre avec son propre libellé.
 */
export function metaForType(type: string): { label: string; icon: string; cls: string; color: string } {
  return (
    (INVESTMENT_TYPE_META as Record<string, { label: string; icon: string; cls: string; color: string }>)[type] ?? {
      label: type,
      icon: "🏷️",
      cls: "bg-slate-500/15 text-slate-600 border-slate-500/25",
      color: "#64748b",
    }
  )
}

// Palette stable (par index de plateforme) pour les courbes du graphe.
export const PLATFORM_COLORS = [
  "#6366f1", "#10b981", "#f59e0b", "#ec4899", "#06b6d4",
  "#8b5cf6", "#ef4444", "#14b8a6", "#eab308", "#3b82f6",
]

const MS_DAY = 86_400_000
const DAYS_MONTH = 30.44
const DAYS_YEAR = 365.25
// En deçà de ce span, on n'extrapole pas un rendement à l'année/au mois (quelques jours
// annualisés donnent des pourcentages délirants) : on reporte le rendement cumulé brut.
const MIN_ANNUALIZE_DAYS = 14
const toDate = (d: Date | string) => (d instanceof Date ? d : new Date(d))

// Plages de temps partagées par le graphe ET les statistiques.
export const RANGES = [
  { key: "3M",  label: "3 mois",  days: 91 },
  { key: "6M",  label: "6 mois",  days: 183 },
  { key: "12M", label: "12 mois", days: 365 },
  { key: "2A",  label: "2 ans",   days: 730 },
  { key: "3A",  label: "3 ans",   days: 1096 },
  { key: "ALL", label: "Tout",    days: null },
] as const
export type RangeKey = (typeof RANGES)[number]["key"]

/** Borne gauche (ms) d'une plage. 0 = « Tout » (couvre tous les relevés). */
export function rangeStartMs(range: RangeKey, nowMs: number): number {
  const days = RANGES.find((r) => r.key === range)?.days ?? null
  return days === null || nowMs === 0 ? 0 : nowMs - days * MS_DAY
}

export const RANGE_LABEL: Record<RangeKey, string> = {
  "3M": "3 mois", "6M": "6 mois", "12M": "12 mois", "2A": "2 ans", "3A": "3 ans", ALL: "depuis le début",
}

export type EntryLite = { date: Date | string; capital: number | null; contribution: number }

export type Interval = {
  from: Date
  to: Date
  days: number
  gain: number         // € gagnés (hors apport)
  returnPct: number    // rendement de la sous-période
  monthlyPct: number   // rendement ramené au mois (compound)
  contribution: number // apport à la fin de l'intervalle
  startCapital: number
  endCapital: number
}

export type PlatformStats = {
  totalContributions: number  // Σ apports (posé de ma poche)
  currentCapital: number      // dernier relevé
  firstDate: Date | null
  lastDate: Date | null
  profit: number              // capital actuel − apports
  roi: number                 // profit / apports (rentabilité simple)
  twr: number                 // rendement pondéré par le temps (cumulé)
  annualizedPct: number       // TWR annualisé
  monthlyAvgPct: number       // équivalent mensuel du TWR (lissé)
  intervals: Interval[]
  entryCount: number
  daysSinceLast: number | null
  isStale: boolean            // dernier relevé > ~1 mois → inviter à mettre à jour
  contributionsMissing: boolean // capital > 0 mais aucun apport renseigné → rentabilité impossible
}

/** Statistiques d'une plateforme à partir de ses relevés (ordre quelconque). */
export function computePlatformStats(entriesInput: EntryLite[], now: Date = new Date()): PlatformStats {
  const entries = entriesInput
    .map((e) => ({ date: toDate(e.date), capital: e.capital, contribution: e.contribution }))
    .sort((a, b) => a.date.getTime() - b.date.getTime())

  const totalContributions = entries.reduce((s, e) => s + e.contribution, 0)
  // Apports BRUTS (dépôts seuls) : dénominateur de rentabilité robuste quand les apports
  // nets sont ≤ 0 (on a retiré autant ou plus qu'on a déposé).
  const grossContributions = entries.reduce((s, e) => (e.contribution > 0 ? s + e.contribution : s), 0)
  // Valorisations (relevés) = entrées avec un capital ; les dépôts/retraits purs
  // (capital null) sont des flux, dissociés des relevés.
  const vals = entries.filter((e): e is { date: Date; capital: number; contribution: number } => e.capital != null)
  const first = vals[0] ?? null
  const last = vals[vals.length - 1] ?? null

  // Somme des apports (tous types d'entrées, relevés comme dépôts) survenus dans (t1, t2]
  const flowsBetween = (t1: number, t2: number) =>
    entries.reduce((s, e) => (e.date.getTime() > t1 && e.date.getTime() <= t2 ? s + e.contribution : s), 0)

  // Capital actuel = dernier relevé + dépôts POSTÉRIEURS à ce relevé (encore non
  // reflétés dans une valorisation). Sans ça, un dépôt fait après le dernier relevé
  // (ou une plateforme sans aucun relevé) donnerait un profit faussement négatif.
  const flowsAfterLast = last ? flowsBetween(last.date.getTime(), Infinity) : totalContributions
  const currentCapital = (last ? last.capital : 0) + flowsAfterLast
  const profit = currentCapital - totalContributions
  // Rentabilité simple. Si les apports nets sont ≤ 0 (retraits ≥ dépôts), on rapporte au
  // brut déposé pour ne pas afficher 0 % à côté d'un profit réel.
  const roi = totalContributions > 0 ? profit / totalContributions
    : grossContributions > 0 ? profit / grossContributions : 0

  const intervals: Interval[] = []
  let twrFactor = 1
  for (let i = 1; i < vals.length; i++) {
    const a = vals[i - 1]
    const b = vals[i]
    const spanMs = b.date.getTime() - a.date.getTime()
    const days = Math.max(0, spanMs / MS_DAY)
    // Flux dans (a, b] + base « Modified-Dietz » : chaque apport est pondéré par la
    // fraction de l'intervalle où il est resté investi. Sans ça, un gros dépôt en début
    // d'intervalle gonfle le rendement (base = capital de début seul) et une ouverture à
    // capital 0 l'annule (base 0) ; la base moyenne rend le rendement fidèle au timing.
    let flows = 0
    let weighted = 0
    for (const e of entries) {
      const t = e.date.getTime()
      if (t > a.date.getTime() && t <= b.date.getTime()) {
        flows += e.contribution
        weighted += e.contribution * (spanMs > 0 ? (b.date.getTime() - t) / spanMs : 0)
      }
    }
    const gain = b.capital - a.capital - flows
    const base = a.capital + weighted
    const returnPct = base > 0 ? gain / base : 0
    // Une sous-période ne peut pas perdre plus de 100 % : plancher à −1 pour ne pas rendre
    // le facteur TWR négatif (→ NaN à l'annualisation) ni gonfler une reprise ultérieure.
    const rClamped = Math.max(-1, returnPct)
    const monthlyPct = base > 0 && days > 0 ? Math.pow(1 + rClamped, DAYS_MONTH / days) - 1 : 0
    intervals.push({ from: a.date, to: b.date, days, gain, returnPct, monthlyPct, contribution: flows, startCapital: a.capital, endCapital: b.capital })
    twrFactor *= 1 + rClamped
  }
  const twr = twrFactor - 1
  const totalDays = first && last ? Math.max(0, (last.date.getTime() - first.date.getTime()) / MS_DAY) : 0
  // Base d'annualisation plancherée à 0 (perte ≥ 100 % → −100 %) : jamais un nombre négatif
  // élevé à une puissance fractionnaire (= NaN). Span trop court → pas d'extrapolation.
  const twrPow = Math.max(0, 1 + twr)
  const annualizedPct = totalDays >= MIN_ANNUALIZE_DAYS ? Math.pow(twrPow, DAYS_YEAR / totalDays) - 1 : twr
  const monthlyAvgPct = totalDays >= MIN_ANNUALIZE_DAYS ? Math.pow(twrPow, DAYS_MONTH / totalDays) - 1 : twr

  const daysSinceLast = last ? (now.getTime() - last.date.getTime()) / MS_DAY : null
  const isStale = daysSinceLast !== null && daysSinceLast > 31
  // Apports jamais renseignés (AUCUNE entrée avec un apport ≠ 0) alors qu'il y a du capital
  // → bénéfices incalculables. On teste l'ABSENCE d'apport, pas une somme nette nulle : un
  // dépôt puis un retrait égal ne sont pas « non renseignés ».
  const contributionsMissing = !entries.some((e) => e.contribution !== 0) && currentCapital > 0

  return {
    totalContributions, currentCapital, firstDate: first?.date ?? null, lastDate: last?.date ?? null,
    profit, roi, twr, annualizedPct, monthlyAvgPct, intervals, entryCount: entries.length, daysSinceLast, isStale,
    contributionsMissing,
  }
}

// ── Statistiques sur une fenêtre temporelle (pilotées par le filtre du graphe) ──

export type PeriodStats = {
  hasData: boolean
  startCapital: number  // capital au début de la fenêtre (0 si la fenêtre couvre tout)
  endCapital: number    // capital actuel
  apports: number       // apports effectués DANS la fenêtre
  gain: number          // endCapital − startCapital − apports
  returnPct: number     // rendement pondéré par le temps sur la fenêtre
  annualizedPct: number
  monthlyPct: number
  days: number
}

/**
 * Capital « le long de la courbe » au temps t, CONSCIENT DES DÉPÔTS : entre deux
 * relevés la croissance est répartie dans le temps et chaque dépôt est une marche
 * (comme sur le graphe). Une interpolation linéaire naïve serait gonflée par un gros
 * dépôt situé entre les deux relevés. null si t est hors de la plage des relevés.
 */
export function capitalAt(vals: { t: number; capital: number }[], flows: { t: number; amount: number }[], t: number): number | null {
  if (vals.length === 0 || t < vals[0].t || t > vals[vals.length - 1].t) return null
  const flowsIn = (t1: number, t2: number) => flows.reduce((s, f) => (f.t > t1 && f.t <= t2 ? s + f.amount : s), 0)
  for (let i = 0; i < vals.length - 1; i++) {
    const a = vals[i], b = vals[i + 1]
    if (t >= a.t && t <= b.t) {
      if (b.t === a.t) return b.capital
      const growth = b.capital - a.capital - flowsIn(a.t, b.t)
      return a.capital + growth * ((t - a.t) / (b.t - a.t)) + flowsIn(a.t, t)
    }
  }
  return vals[vals.length - 1].capital
}

/**
 * Statistiques restreintes à la fenêtre [fromMs, maintenant]. Si `fromMs` précède le
 * premier relevé, la fenêtre couvre tout et on retombe sur les stats globales.
 */
export function computePeriodStats(entriesInput: EntryLite[], fromMs: number): PeriodStats {
  const entries = entriesInput
    .map((e) => ({ t: toDate(e.date).getTime(), capital: e.capital, contribution: e.contribution }))
    .sort((a, b) => a.t - b.t)
  const vals = entries.filter((e): e is { t: number; capital: number; contribution: number } => e.capital != null)
  if (vals.length === 0) return { hasData: false, startCapital: 0, endCapital: 0, apports: 0, gain: 0, returnPct: 0, annualizedPct: 0, monthlyPct: 0, days: 0 }

  const first = vals[0]
  const last = vals[vals.length - 1]
  const flowsBetween = (t1: number, t2: number) =>
    entries.reduce((s, e) => (e.t > t1 && e.t <= t2 ? s + e.contribution : s), 0)
  const flows = entries.filter((e) => e.contribution !== 0).map((e) => ({ t: e.t, amount: e.contribution }))
  const coversAll = fromMs <= first.t
  const winStart = coversAll ? first.t : fromMs
  // Capital de départ CONSCIENT DES DÉPÔTS (pas une interpolation linéaire naïve).
  // Fallback si la fenêtre est ENTIÈREMENT postérieure au dernier relevé (capitalAt renvoie
  // null car fromMs > last.t) = dernier capital connu + les dépôts faits APRÈS ce relevé mais
  // AVANT le début de fenêtre. Sinon ces dépôts (comptés dans endCapital mais pas dans les
  // apports de la fenêtre) fuiraient en faux bénéfice.
  const startCapital = coversAll ? 0 : (capitalAt(vals.map((v) => ({ t: v.t, capital: v.capital })), flows, fromMs) ?? (last.capital + flowsBetween(last.t, fromMs)))
  // apports = flux survenus dans la fenêtre
  const apports = entries.reduce((s, e) => (coversAll || e.t > fromMs ? s + e.contribution : s), 0)
  // capital actuel = dernier relevé + dépôts postérieurs (non encore valorisés)
  const endCapital = last.capital + flowsBetween(last.t, Infinity)
  const gain = endCapital - startCapital - apports

  const windowVals = coversAll ? vals : vals.filter((v) => v.t > fromMs)
  const synth = [{ t: winStart, capital: startCapital }, ...windowVals]
  let f = 1
  for (let i = 1; i < synth.length; i++) {
    const a = synth[i - 1], b = synth[i]
    const g = b.capital - a.capital - flowsBetween(a.t, b.t)
    const r = a.capital > 0 ? g / a.capital : 0
    f *= 1 + Math.max(-1, r) // plancher −100 % par sous-période (évite un facteur négatif → NaN)
  }
  const returnPct = f - 1
  const days = Math.max(0, (last.t - winStart) / MS_DAY)
  const powBase = Math.max(0, 1 + returnPct) // base plancherée à 0 → jamais de NaN via Math.pow
  const annualizedPct = days >= MIN_ANNUALIZE_DAYS ? Math.pow(powBase, DAYS_YEAR / days) - 1 : returnPct
  const monthlyPct = days >= MIN_ANNUALIZE_DAYS ? Math.pow(powBase, DAYS_MONTH / days) - 1 : returnPct

  return { hasData: true, startCapital, endCapital, apports, gain, returnPct, annualizedPct, monthlyPct, days }
}

// ── Série mensuelle (rapport à envoyer au conseiller) ───────────────────────────

/** Valeur d'UNE plateforme au temps t (ms), consciente des dépôts (mêmes règles que la courbe). */
export function platformValueAt(entriesInput: EntryLite[], t: number): number {
  const es = entriesInput
    .map((e) => ({ t: toDate(e.date).getTime(), capital: e.capital, contribution: e.contribution }))
    .sort((a, b) => a.t - b.t)
  const vals = es.filter((e): e is { t: number; capital: number; contribution: number } => e.capital != null)
  const flowsUpTo = (tt: number) => es.reduce((s, e) => (e.t <= tt ? s + e.contribution : s), 0)
  if (vals.length === 0) return flowsUpTo(t) // que des flux, aucun relevé
  const first = vals[0]
  const last = vals[vals.length - 1]
  if (t < first.t) return flowsUpTo(t) // avant le 1er relevé : cumul des dépôts antérieurs
  if (t >= last.t) return last.capital + es.reduce((s, e) => (e.t > last.t && e.t <= t ? s + e.contribution : s), 0)
  const flows = es.filter((e) => e.contribution !== 0).map((e) => ({ t: e.t, amount: e.contribution }))
  return capitalAt(vals.map((v) => ({ t: v.t, capital: v.capital })), flows, t) ?? last.capital
}

export type MonthlyRow = {
  ym: string           // "2026-01"
  label: string        // "janv. 2026"
  value: number        // valeur totale en fin de mois
  contributions: number// apports du mois (net)
  gain: number         // gain du mois hors apports
  returnPct: number    // performance du mois
  cumulContributions: number
  cumulGain: number
}

/**
 * Série mensuelle agrégée sur [fromMs, toMs] : pour chaque mois, la valeur totale de fin de
 * mois, les apports du mois, le gain (hors apports) et la performance. `new Date(y, m, …)`
 * est déterministe (dates construites avec arguments) → pas d'impureté en rendu.
 */
export function computeMonthlySeries(platforms: { entries: EntryLite[] }[], fromMs: number, toMs: number): MonthlyRow[] {
  if (toMs < fromMs) return []
  const totalValueAt = (t: number) => platforms.reduce((s, p) => s + platformValueAt(p.entries, t), 0)
  const contributionsBetween = (t1: number, t2: number) =>
    platforms.reduce((s, p) => s + p.entries.reduce((ss, e) => {
      const et = toDate(e.date).getTime()
      return et > t1 && et <= t2 ? ss + e.contribution : ss
    }, 0), 0)

  const from = new Date(fromMs)
  const to = new Date(toMs)
  const endY = to.getFullYear()
  const endM = to.getMonth()
  const rows: MonthlyRow[] = []
  let cumulContributions = 0
  let cumulGain = 0
  let y = from.getFullYear()
  let m = from.getMonth()
  let guard = 0
  while ((y < endY || (y === endY && m <= endM)) && guard++ < 600) {
    const monthStartMinus1 = new Date(y, m, 1).getTime() - 1        // juste avant le mois
    const monthEnd = new Date(y, m + 1, 1).getTime() - 1           // fin du dernier jour
    const valStart = totalValueAt(monthStartMinus1)
    const valEnd = totalValueAt(monthEnd)
    const contributions = contributionsBetween(monthStartMinus1, monthEnd)
    const gain = valEnd - valStart - contributions
    cumulContributions += contributions
    cumulGain += gain
    rows.push({
      ym: `${y}-${String(m + 1).padStart(2, "0")}`,
      label: new Date(y, m, 1).toLocaleDateString("fr-FR", { month: "short", year: "numeric" }),
      value: valEnd,
      contributions,
      gain,
      returnPct: valStart > 0 ? gain / valStart : 0,
      cumulContributions,
      cumulGain,
    })
    m++
    if (m > 11) { m = 0; y++ }
  }
  return rows
}

export type GlobalStats = {
  totalContributions: number
  currentCapital: number
  profit: number
  roi: number
  monthlyAvgPct: number // moyenne pondérée par le capital
  platformCount: number
}

/** Agrège les stats de plusieurs plateformes (rentabilité mensuelle pondérée par le capital). */
export function aggregateGlobal(stats: PlatformStats[]): GlobalStats {
  const totalContributions = stats.reduce((s, p) => s + p.totalContributions, 0)
  const currentCapital = stats.reduce((s, p) => s + p.currentCapital, 0)
  const profit = currentCapital - totalContributions
  const roi = totalContributions > 0 ? profit / totalContributions : 0
  const weight = stats.reduce((s, p) => s + p.currentCapital, 0)
  const monthlyAvgPct = weight > 0 ? stats.reduce((s, p) => s + p.monthlyAvgPct * p.currentCapital, 0) / weight : 0
  return { totalContributions, currentCapital, profit, roi, monthlyAvgPct, platformCount: stats.length }
}

// ── Formatage ─────────────────────────────────────────────────────────────────
// Espace INSÉCABLE ( ) avant € / % : correct en typographie française et évite que
// « 6 260 » et « € » se retrouvent sur deux lignes (wrap dans l'infobulle du graphe).
export const fmtEur = (n: number) =>
  `${n.toLocaleString("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })} €`
export const fmtEur2 = (n: number) =>
  `${n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`
export const fmtPct = (r: number) =>
  `${(r * 100).toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`
export const fmtPctSigned = (r: number) => `${r >= 0 ? "+" : ""}${fmtPct(r)}`
