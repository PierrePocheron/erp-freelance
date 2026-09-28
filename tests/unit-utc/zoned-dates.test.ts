import { describe, it, expect } from "vitest"
import { zonedParts, zonedDateKey, zonedDayStart, zonedDayStartOffset, zonedDayEnd, isZonedAllDay } from "@/lib/dates"

// Ce fichier tourne avec TZ=UTC : c'est le fuseau de la production (Vercel
// n'accepte pas `TZ`, le nom est réservé). Chaque test échouerait avec les
// getters natifs (getHours, getDate…), qui lisent le fuseau du process.

describe("composantes civiles dans le fuseau de l'app", () => {
  it("lit l'heure de Paris, pas celle du process", () => {
    // 22 h UTC le 9 septembre = minuit à Paris le 10 (été, UTC+2).
    expect(zonedParts(new Date("2026-09-09T22:00:00Z"))).toMatchObject({ year: 2026, month: 9, day: 10, hour: 0, minute: 0 })
    // 23 h UTC le 9 novembre = minuit à Paris le 10 (hiver, UTC+1).
    expect(zonedParts(new Date("2026-11-09T23:00:00Z"))).toMatchObject({ month: 11, day: 10, hour: 0 })
  })

  it("donne la bonne date civile en fin de journée UTC", () => {
    expect(zonedDateKey(new Date("2026-09-09T22:00:00Z"))).toBe("2026-09-10")
    expect(zonedDateKey(new Date("2026-12-31T23:30:00Z"))).toBe("2027-01-01") // bascule d'année
  })
})

describe("journée entière", () => {
  it("reconnaît minuit à Paris, été comme hiver", () => {
    expect(isZonedAllDay(new Date("2026-09-09T22:00:00Z"))).toBe(true)  // minuit Paris, été
    expect(isZonedAllDay(new Date("2026-11-09T23:00:00Z"))).toBe(true)  // minuit Paris, hiver
  })

  it("ne confond pas minuit UTC avec une journée entière", () => {
    // Minuit UTC = 02 h à Paris : c'est un créneau, pas une journée entière.
    expect(isZonedAllDay(new Date("2026-09-10T00:00:00Z"))).toBe(false)
    expect(isZonedAllDay(new Date("2026-09-09T22:30:00Z"))).toBe(false)
  })
})

describe("bornes de journée", () => {
  it("minuit de Paris, pas minuit UTC", () => {
    const start = zonedDayStart(new Date("2026-09-10T08:00:00Z")) // 10 h à Paris
    expect(start.toISOString()).toBe("2026-09-09T22:00:00.000Z")
    expect(zonedDayEnd(new Date("2026-09-10T08:00:00Z")).toISOString()).toBe("2026-09-10T21:59:59.999Z")
  })

  it("décale d'un jour CIVIL, y compris sur une nuit de changement d'heure", () => {
    const veille = new Date("2026-10-24T12:00:00Z") // 24 octobre (heure d'été)
    // La nuit du 25 octobre dure 25 h : un simple +24 h retomberait le 25 à 23 h.
    expect(zonedDayStartOffset(veille, 1).toISOString()).toBe("2026-10-24T22:00:00.000Z") // 25/10 00:00 Paris
    expect(zonedDayStartOffset(veille, 2).toISOString()).toBe("2026-10-25T23:00:00.000Z") // 26/10 00:00 Paris (UTC+1)
  })

  it("passe d'un mois et d'une année à l'autre", () => {
    expect(zonedDateKey(zonedDayStartOffset(new Date("2026-01-31T12:00:00Z"), 1))).toBe("2026-02-01")
    expect(zonedDateKey(zonedDayStartOffset(new Date("2026-12-31T12:00:00Z"), 1))).toBe("2027-01-01")
    expect(zonedDateKey(zonedDayStartOffset(new Date("2026-03-01T12:00:00Z"), -1))).toBe("2026-02-28")
  })
})
