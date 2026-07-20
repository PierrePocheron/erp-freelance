"use client"

const MONTH_LABELS = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
]

function daysInMonth(year: number, month1: number): number {
  return new Date(year, month1, 0).getDate()
}

const pad = (n: number) => String(n).padStart(2, "0")

/**
 * Champ date en trois selects séparés — jour / mois / année. Plus direct
 * qu'un input date pour choisir une date de prélèvement, et les selects
 * natifs donnent la roue à scroll sur mobile (iOS/Android).
 * Valeur au format "YYYY-MM-DD" (comme un input type=date).
 */
export function DatePartsField({
  value,
  onChange,
  yearsBack = 6,
  yearsForward = 3,
}: {
  value: string
  onChange: (value: string) => void
  yearsBack?: number
  yearsForward?: number
}) {
  const today = new Date()
  const fallback = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`
  const [y, m, d] = (/^\d{4}-\d{2}-\d{2}$/.test(value) ? value : fallback).split("-").map(Number)

  const currentYear = today.getFullYear()
  const years: number[] = []
  for (let yy = currentYear + yearsForward; yy >= currentYear - yearsBack; yy--) years.push(yy)
  // Une date hors plage (vieil historique importé) reste sélectionnable
  if (!years.includes(y)) {
    years.push(y)
    years.sort((a, b) => b - a)
  }

  function commit(year: number, month1: number, day: number) {
    // Clampe le jour au dernier jour du mois (31 → 28/29/30 selon le mois)
    const maxDay = daysInMonth(year, month1)
    onChange(`${year}-${pad(month1)}-${pad(Math.min(day, maxDay))}`)
  }

  const selectCls =
    "h-9 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"

  return (
    <div className="flex gap-1.5">
      <select
        aria-label="Jour"
        value={d}
        onChange={(e) => commit(y, m, Number(e.target.value))}
        className={`${selectCls} w-[4.25rem]`}
      >
        {Array.from({ length: daysInMonth(y, m) }, (_, i) => i + 1).map((day) => (
          <option key={day} value={day}>{day}</option>
        ))}
      </select>
      <select
        aria-label="Mois"
        value={m}
        onChange={(e) => commit(y, Number(e.target.value), d)}
        className={`${selectCls} flex-1 min-w-0`}
      >
        {MONTH_LABELS.map((label, i) => (
          <option key={i + 1} value={i + 1}>{label}</option>
        ))}
      </select>
      <select
        aria-label="Année"
        value={y}
        onChange={(e) => commit(Number(e.target.value), m, d)}
        className={`${selectCls} w-[4.75rem]`}
      >
        {years.map((year) => (
          <option key={year} value={year}>{year}</option>
        ))}
      </select>
    </div>
  )
}
