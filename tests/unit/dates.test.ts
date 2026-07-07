import { describe, it, expect } from "vitest"
import { addMonths, expiresAtFromDays, daysLate, advanceByFrequency, getOccurrencesInRange } from "@/lib/dates"

describe("addMonths", () => {
  it("ajoute des mois sans muter l'argument", () => {
    const base = new Date("2026-01-15T00:00:00Z")
    const out = addMonths(base, 3)
    expect(out.getMonth()).toBe(base.getMonth() + 3) // 0→3 (avril)
    expect(base.toISOString()).toBe("2026-01-15T00:00:00.000Z") // inchangé
  })

  it("gère le passage d'année", () => {
    const base = new Date("2026-11-10T00:00:00Z")
    const out = addMonths(base, 3) // nov + 3 = février année suivante
    expect(out.getFullYear()).toBe(2027)
    expect(out.getMonth()).toBe(1) // février
  })

  it("période de 12 mois → +1 an même jour", () => {
    const base = new Date("2026-06-01T00:00:00Z")
    const out = addMonths(base, 12)
    expect(out.getFullYear()).toBe(2027)
    expect(out.getMonth()).toBe(base.getMonth())
  })
})

describe("expiresAtFromDays", () => {
  const now = new Date("2026-05-01T00:00:00Z")
  it("null/0/undefined → null (pas d'échéance)", () => {
    expect(expiresAtFromDays(null, now)).toBeNull()
    expect(expiresAtFromDays(0, now)).toBeNull()
    expect(expiresAtFromDays(undefined, now)).toBeNull()
  })
  it("n jours → maintenant + n jours", () => {
    const out = expiresAtFromDays(30, now)!
    expect(out.getTime() - now.getTime()).toBe(30 * 24 * 60 * 60 * 1000)
  })
})

describe("daysLate", () => {
  const now = new Date("2026-05-10T00:00:00Z")
  it("pas d'échéance → null", () => {
    expect(daysLate(null, now)).toBeNull()
    expect(daysLate(undefined, now)).toBeNull()
  })
  it("échéance passée → nombre de jours positif (arrondi au sup.)", () => {
    expect(daysLate(new Date("2026-05-05T00:00:00Z"), now)).toBe(5)
    // 4 jours et demi de retard → arrondi à 5
    expect(daysLate(new Date("2026-05-05T12:00:00Z"), now)).toBe(5)
  })
  it("échéance future → valeur négative", () => {
    expect(daysLate(new Date("2026-05-15T00:00:00Z"), now)).toBe(-5)
  })
})

describe("advanceByFrequency", () => {
  const base = new Date("2026-01-31T00:00:00Z")
  it("MONTHLY → +1 mois", () => {
    expect(advanceByFrequency(base, "MONTHLY").getMonth()).toBe(2) // mars (31 jan + 1 mois normalisé)
  })
  it("QUARTERLY → +3 mois", () => {
    const out = advanceByFrequency(new Date("2026-01-15T00:00:00Z"), "QUARTERLY")
    expect(out.getMonth()).toBe(3) // avril
  })
  it("YEARLY → +1 an", () => {
    const out = advanceByFrequency(new Date("2026-01-15T00:00:00Z"), "YEARLY")
    expect(out.getFullYear()).toBe(2027)
  })
  it("fréquence inconnue → date inchangée", () => {
    const src = new Date("2026-01-15T00:00:00Z")
    expect(advanceByFrequency(src, "WEEKLY").getTime()).toBe(src.getTime())
  })
  it("ne mute pas l'argument", () => {
    const src = new Date("2026-01-15T00:00:00Z")
    advanceByFrequency(src, "YEARLY")
    expect(src.toISOString()).toBe("2026-01-15T00:00:00.000Z")
  })
})

describe("getOccurrencesInRange", () => {
  it("MONTHLY sur une fenêtre de 3 mois → 3 occurrences", () => {
    const start = new Date("2026-01-05T00:00:00Z")
    const from  = new Date("2026-01-01T00:00:00Z")
    const to    = new Date("2026-03-31T00:00:00Z")
    const out = getOccurrencesInRange(start, "MONTHLY", from, to)
    expect(out.map(d => d.toISOString().slice(0, 10))).toEqual(["2026-01-05", "2026-02-05", "2026-03-05"])
  })

  it("start bien avant from → avance jusqu'à la fenêtre avant de collecter", () => {
    const start = new Date("2025-01-05T00:00:00Z")
    const from  = new Date("2026-01-01T00:00:00Z")
    const to    = new Date("2026-01-31T00:00:00Z")
    const out = getOccurrencesInRange(start, "MONTHLY", from, to)
    expect(out).toHaveLength(1)
    expect(out[0].toISOString().slice(0, 10)).toBe("2026-01-05")
  })

  it("occurrence exactement sur la borne from → incluse", () => {
    const start = new Date("2026-01-01T00:00:00Z")
    const out = getOccurrencesInRange(start, "MONTHLY", new Date("2026-01-01T00:00:00Z"), new Date("2026-01-31T00:00:00Z"))
    expect(out).toHaveLength(1)
  })

  it("occurrence exactement sur la borne to → incluse", () => {
    const start = new Date("2026-01-31T00:00:00Z")
    const out = getOccurrencesInRange(start, "MONTHLY", new Date("2026-01-01T00:00:00Z"), new Date("2026-01-31T00:00:00Z"))
    expect(out).toHaveLength(1)
  })

  it("YEARLY qui ne retombe jamais dans une fenêtre de 3 mois → aucune occurrence", () => {
    const start = new Date("2026-06-15T00:00:00Z")
    const from  = new Date("2026-01-01T00:00:00Z")
    const to    = new Date("2026-03-31T00:00:00Z")
    expect(getOccurrencesInRange(start, "YEARLY", from, to)).toEqual([])
  })

  it("start après to → aucune occurrence", () => {
    const start = new Date("2026-06-01T00:00:00Z")
    const out = getOccurrencesInRange(start, "MONTHLY", new Date("2026-01-01T00:00:00Z"), new Date("2026-03-31T00:00:00Z"))
    expect(out).toEqual([])
  })

  it("to avant from → aucune occurrence", () => {
    const out = getOccurrencesInRange(new Date("2026-01-01T00:00:00Z"), "MONTHLY", new Date("2026-03-01T00:00:00Z"), new Date("2026-01-01T00:00:00Z"))
    expect(out).toEqual([])
  })

  it("fréquence inconnue avec start déjà dans la fenêtre → cette seule occurrence (pas de projection)", () => {
    const out = getOccurrencesInRange(new Date("2026-01-01T00:00:00Z"), "WEEKLY", new Date("2026-01-01T00:00:00Z"), new Date("2026-03-01T00:00:00Z"))
    expect(out.map(d => d.toISOString().slice(0, 10))).toEqual(["2026-01-01"])
  })

  it("fréquence inconnue avec start hors fenêtre → aucune occurrence (pas de boucle infinie)", () => {
    const out = getOccurrencesInRange(new Date("2025-01-01T00:00:00Z"), "WEEKLY", new Date("2026-01-01T00:00:00Z"), new Date("2026-03-01T00:00:00Z"))
    expect(out).toEqual([])
  })
})
