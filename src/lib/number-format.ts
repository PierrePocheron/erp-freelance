// Utilitaires de numérotation — partagés entre server actions et composants client

export type NumberFormat =
  | "PREFIX-YYYY-NNN"   // FAC-2026-001  (annuel, 3 chiffres)
  | "PREFIX-YYMM-NN"    // FAC-2605-01   (mensuel, 2 chiffres)
  | "PREFIX-YYYYMM-NN"  // FAC-202605-01 (mensuel long, 2 chiffres)
  | "YYMM-NNN"          // 2605-001      (sans préfixe, mensuel)
  | "PREFIX-YYYY-NN"    // FAC-2026-01   (annuel, 2 chiffres)
  | "PREFIXYYMMNN"      // FA260501      (mensuel compact, sans séparateur)

export function buildNumberParts(
  format: NumberFormat,
  prefix: string,
  now: Date
): { scopePrefix: string; digits: number } {
  const yyyy = String(now.getFullYear())
  const yy = yyyy.slice(-2)
  const mm = String(now.getMonth() + 1).padStart(2, "0")

  switch (format) {
    case "PREFIX-YYYY-NNN":  return { scopePrefix: `${prefix}-${yyyy}-`, digits: 3 }
    case "PREFIX-YYYY-NN":   return { scopePrefix: `${prefix}-${yyyy}-`, digits: 2 }
    case "PREFIX-YYMM-NN":   return { scopePrefix: `${prefix}-${yy}${mm}-`, digits: 2 }
    case "PREFIX-YYYYMM-NN": return { scopePrefix: `${prefix}-${yyyy}${mm}-`, digits: 2 }
    case "YYMM-NNN":         return { scopePrefix: `${yy}${mm}-`, digits: 3 }
    case "PREFIXYYMMNN":     return { scopePrefix: `${prefix}${yy}${mm}`, digits: 2 }
    default:                 return { scopePrefix: `${prefix}-${yyyy}-`, digits: 3 }
  }
}

export function buildNumberPreview(format: NumberFormat, prefix: string): string {
  const { scopePrefix, digits } = buildNumberParts(format, prefix, new Date())
  return `${scopePrefix}${"1".padStart(digits, "0")}`
}

export const FORMAT_OPTIONS: { value: NumberFormat; label: string }[] = [
  { value: "PREFIX-YYYY-NNN",  label: "PREFIX-AAAA-001  —  annuel, 3 chiffres" },
  { value: "PREFIX-YYYY-NN",   label: "PREFIX-AAAA-01   —  annuel, 2 chiffres" },
  { value: "PREFIX-YYMM-NN",   label: "PREFIX-AAMM-01   —  mensuel, 2 chiffres" },
  { value: "PREFIX-YYYYMM-NN", label: "PREFIX-AAAAMM-01 —  mensuel long" },
  { value: "YYMM-NNN",         label: "AAMM-001         —  mensuel sans préfixe" },
  { value: "PREFIXYYMMNN",     label: "PREFIXAAMMNN     —  mensuel compact (FA260501)" },
]
