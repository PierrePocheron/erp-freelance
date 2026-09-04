import { describe, it, expect } from "vitest"
import { zonedMidnight, parseGoogleDate } from "@/lib/dates"

// Minuit Europe/Paris = 22:00Z en été (UTC+2), 23:00Z en hiver (UTC+1), quel que soit le TZ du process.
describe("zonedMidnight", () => {
  it("été : minuit Paris = 22:00 UTC la veille", () => {
    expect(zonedMidnight("2026-09-10").toISOString()).toBe("2026-09-09T22:00:00.000Z")
  })
  it("hiver : minuit Paris = 23:00 UTC la veille", () => {
    expect(zonedMidnight("2026-01-10").toISOString()).toBe("2026-01-09T23:00:00.000Z")
  })
  it("autre fuseau : minuit New York (EDT) = 04:00 UTC", () => {
    expect(zonedMidnight("2026-09-10", "America/New_York").toISOString()).toBe("2026-09-10T04:00:00.000Z")
  })
  it("parseGoogleDate : date seule → minuit Paris, dateTime → inchangé", () => {
    expect(parseGoogleDate("2026-09-10").toISOString()).toBe("2026-09-09T22:00:00.000Z")
    expect(parseGoogleDate("2026-09-10T16:00:00+02:00").toISOString()).toBe("2026-09-10T14:00:00.000Z")
  })
  it("un événement Google d'un jour (fin exclusive) reste sur un seul jour vu de Paris", () => {
    const start = parseGoogleDate("2026-09-09"), end = parseGoogleDate("2026-09-10")
    const lastInclusive = new Date(end.getTime() - 1)
    const dayIn = (d: Date) => new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", day: "2-digit" }).format(d)
    expect(dayIn(start)).toBe("09"); expect(dayIn(lastInclusive)).toBe("09")
  })
})
