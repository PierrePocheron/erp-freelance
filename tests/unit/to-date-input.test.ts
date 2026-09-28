import { describe, it, expect } from "vitest"
import { toDateInput } from "@/lib/dates"

// `toDateInput` alimente les champs <input type="date">. Le piège qu'il existe
// pour éviter — `toISOString().slice(0, 10)`, qui renvoie la date UTC — n'était
// couvert par aucun test. Le projet vitest « unit » fige TZ=Europe/Paris.

describe("toDateInput", () => {
  it("rend la date civile locale, pas la date UTC", () => {
    // 23 h 30 UTC = 00 h 30 le lendemain à Paris : c'est LE cas que
    // toISOString().slice(0,10) casse (il renverrait le 15).
    expect(toDateInput(new Date("2026-03-15T23:30:00Z"))).toBe("2026-03-16")
    expect(toDateInput(new Date("2026-03-15T00:00:00Z"))).toBe("2026-03-15") // 01 h locale
  })

  it("complète mois et jour sur deux chiffres", () => {
    expect(toDateInput(new Date(2026, 0, 1))).toBe("2026-01-01")
    expect(toDateInput(new Date(2026, 11, 31))).toBe("2026-12-31")
    expect(toDateInput(new Date(2026, 8, 5))).toBe("2026-09-05")
  })

  it("aller-retour stable : ré-enregistrer ne décale pas le jour", () => {
    let d = new Date("2026-03-15T22:00:00Z") // 23 h à Paris
    for (let i = 0; i < 3; i++) {
      const s = toDateInput(d)
      expect(s).toBe("2026-03-15")
      d = new Date(`${s}T00:00:00`) // reconstruction faite par les formulaires
    }
  })

  it("ne mute pas la date passée", () => {
    const d = new Date(2026, 2, 15, 18, 30)
    toDateInput(d)
    expect([d.getDate(), d.getHours()]).toEqual([15, 18])
  })

  it("tient le changement d'heure", () => {
    // Nuit du 29/03/2026 : 02:00 → 03:00 à Paris.
    expect(toDateInput(new Date("2026-03-29T00:30:00Z"))).toBe("2026-03-29") // 01 h 30 locale
    expect(toDateInput(new Date("2026-03-29T01:30:00Z"))).toBe("2026-03-29") // 03 h 30 locale
    // Nuit du 25/10/2026 : 03:00 → 02:00.
    expect(toDateInput(new Date("2026-10-24T23:30:00Z"))).toBe("2026-10-25") // 01 h 30 locale
  })
})
