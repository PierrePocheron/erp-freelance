"use client"

import { useState } from "react"

export type SortDir = "asc" | "desc"

/** Gère l'état de tri (colonne active + direction). */
export function useSortState(defaultCol?: string, defaultDir: SortDir = "asc") {
  const [sortCol, setSortCol] = useState<string | null>(defaultCol ?? null)
  const [sortDir, setSortDir] = useState<SortDir>(defaultDir)

  function toggle(col: string) {
    if (sortCol === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortCol(col)
      setSortDir("asc")
    }
  }

  return { sortCol, sortDir, toggle }
}

/** Comparateur générique : strings (fr), numbers, Dates, booleans, null last. */
export function cmp(
  a: string | number | boolean | Date | null | undefined,
  b: string | number | boolean | Date | null | undefined,
  dir: SortDir
): number {
  if (a == null && b == null) return 0
  if (a == null) return 1
  if (b == null) return -1
  const sign = dir === "asc" ? 1 : -1
  if (a instanceof Date && b instanceof Date) return sign * (a.getTime() - b.getTime())
  if (typeof a === "number" && typeof b === "number") return sign * (a - b)
  if (typeof a === "boolean" && typeof b === "boolean") return sign * (Number(a) - Number(b))
  return sign * String(a).localeCompare(String(b), "fr", { numeric: true })
}
