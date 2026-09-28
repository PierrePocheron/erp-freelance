import { describe, it, expect } from "vitest"
import { parseCivilDate, zonedDateKey, isZonedAllDay } from "@/lib/dates"

// TZ=UTC (fuseau de la production). Les dates saisies dans un formulaire arrivent
// en chaîne : « 2026-10-31 » d'un <input type="date">, « 2026-10-31T14:00 » d'un
// datetime-local. `new Date(...)` les lit en UTC — d'où un décalage de 2 h en prod.

describe("dates de formulaire", () => {
  it("une date seule devient MINUIT à Paris, pas minuit UTC", () => {
    expect(parseCivilDate("2026-10-31").toISOString()).toBe("2026-10-30T23:00:00.000Z") // hiver, UTC+1
    expect(parseCivilDate("2026-07-31").toISOString()).toBe("2026-07-30T22:00:00.000Z") // été, UTC+2
  })

  it("la date reste la bonne au calendrier et compte comme journée entière", () => {
    const echeance = parseCivilDate("2026-10-31")
    expect(zonedDateKey(echeance)).toBe("2026-10-31")
    expect(isZonedAllDay(echeance)).toBe(true)
    // Avec `new Date("2026-10-31")` : 02 h du matin à Paris → ni journée entière…
    expect(isZonedAllDay(new Date("2026-10-31"))).toBe(false)
  })

  it("une heure murale est interprétée à Paris", () => {
    // 14 h saisies à Paris = 12 h UTC en été.
    expect(parseCivilDate("2026-07-31T14:00").toISOString()).toBe("2026-07-31T12:00:00.000Z")
    // …et 13 h UTC en hiver.
    expect(parseCivilDate("2026-11-30T14:00").toISOString()).toBe("2026-11-30T13:00:00.000Z")
  })

  it("une chaîne déjà horodatée passe telle quelle", () => {
    expect(parseCivilDate("2026-07-31T12:00:00Z").toISOString()).toBe("2026-07-31T12:00:00.000Z")
  })

  it("une échéance du 31 n'est pas « en retard » le 31 au matin", () => {
    const echeance = parseCivilDate("2026-10-31")
    // `markLateInvoices` compare à minuit (Paris) du jour courant.
    const le31AuMatin = parseCivilDate("2026-10-31")       // minuit Paris du 31
    const le1erNovembre = parseCivilDate("2026-11-01")
    expect(echeance < le31AuMatin).toBe(false)             // pas encore en retard
    expect(echeance < le1erNovembre).toBe(true)            // en retard le lendemain
  })
})
