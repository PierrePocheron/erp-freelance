// Niveau d'intérêt / priorité d'un prospect (évaluation manuelle) : plus le site
// existant est mauvais, plus l'opportunité de refonte est forte — donc 1 = la
// priorité la plus haute. null = non évalué.
export const INTEREST_LEVELS: Record<number, { label: string; short: string; cls: string; dot: string }> = {
  1: { label: "Site éclaté", short: "Éclaté", cls: "bg-red-500/15 text-red-600 border-red-500/30",             dot: "bg-red-500" },
  2: { label: "Site moyen",  short: "Moyen",  cls: "bg-amber-500/15 text-amber-600 border-amber-500/30",       dot: "bg-amber-500" },
  3: { label: "Site ok",     short: "OK",     cls: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30", dot: "bg-emerald-500" },
}

export const INTEREST_ORDER = [1, 2, 3] as const
