import { describe, it, expect } from "vitest"
import { periodKey, periodBounds, declarationDueDate, declarationAvailableFrom, periodToDeclare } from "@/lib/urssaf"

// TZ=UTC : le fuseau de la production. Chaque assertion échouait avant que les
// bornes ne soient construites en heure de Paris — avec, à la clé, du chiffre
// d'affaires déclaré dans le mauvais trimestre.

describe("période d'un encaissement", () => {
  it("un encaissement du 1er juillet à 00 h 30 (Paris) appartient au T3, pas au T2", () => {
    const paiement = new Date("2026-06-30T22:30:00Z") // = 01/07/2026 00 h 30 à Paris
    expect(periodKey(paiement, "QUARTERLY")).toBe("2026-T3")
    expect(periodKey(paiement, "MONTHLY")).toBe("2026-07")

    const t3 = periodBounds("2026-T3")
    const t2 = periodBounds("2026-T2")
    expect(paiement >= t3.start && paiement <= t3.end).toBe(true)
    expect(paiement >= t2.start && paiement <= t2.end).toBe(false)
  })

  it("le dernier instant d'un trimestre est bien 23:59:59.999 heure de Paris", () => {
    const t2 = periodBounds("2026-T2")
    expect(t2.start.toISOString()).toBe("2026-03-31T22:00:00.000Z") // 01/04 00:00 Paris
    expect(t2.end.toISOString()).toBe("2026-06-30T21:59:59.999Z")   // 30/06 23:59:59.999 Paris
  })

  it("les bornes d'un trimestre d'hiver suivent le décalage UTC+1", () => {
    const t1 = periodBounds("2026-T1")
    expect(t1.start.toISOString()).toBe("2025-12-31T23:00:00.000Z") // 01/01 00:00 Paris
    expect(t1.end.toISOString()).toBe("2026-03-31T21:59:59.999Z")   // 31/03 23:59:59.999 Paris (été)
  })

  it("une période mensuelle de février bissextile couvre bien 29 jours", () => {
    const fev = periodBounds("2028-02")
    expect(fev.start.toISOString()).toBe("2028-01-31T23:00:00.000Z")
    expect(fev.end.toISOString()).toBe("2028-02-29T22:59:59.999Z")
  })
})

describe("échéances de déclaration", () => {
  it("le T2 est dû le 31 juillet, pas le 1er août", () => {
    const due = declarationDueDate("2026-T2")
    expect(due.toISOString()).toBe("2026-07-31T21:59:59.999Z") // 31/07 23:59:59.999 Paris
  })

  it("le T4 est dû le 31 janvier de l'année suivante", () => {
    const due = declarationDueDate("2026-T4")
    expect(due.toISOString()).toBe("2027-01-31T22:59:59.999Z") // 31/01 23:59:59.999 Paris (hiver)
  })

  it("la déclaration s'ouvre au 1er du mois suivant, à minuit heure de Paris", () => {
    expect(declarationAvailableFrom("2026-T2").toISOString()).toBe("2026-06-30T22:00:00.000Z") // 01/07 00:00 Paris
  })
})

describe("période à déclarer", () => {
  it("le 1er juillet à 00 h 30 (Paris), c'est encore le T2 qu'on déclare", () => {
    // Avant correction, `periodKey` renvoyait 2026-T2 pour cet instant (heure UTC
    // encore en juin) et la fonction proposait donc de déclarer le T1.
    expect(periodToDeclare(new Date("2026-06-30T22:30:00Z"), "QUARTERLY")).toBe("2026-T2")
  })

  it("le 30 juin à 23 h 30 (Paris), on déclare encore le T1", () => {
    expect(periodToDeclare(new Date("2026-06-30T21:30:00Z"), "QUARTERLY")).toBe("2026-T1")
  })
})
