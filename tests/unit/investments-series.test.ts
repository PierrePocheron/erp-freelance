import { describe, it, expect } from "vitest"
import { computeMonthlySeries, computeAnnualSeries, platformValueAt } from "@/lib/investments"

// Séries du rapport mensuel/annuel : ce sont les chiffres qu'on montre (et qu'on
// enverrait à un conseiller). Aucune n'était couverte, alors que la règle
// centrale du module est « un apport n'est JAMAIS un bénéfice ».
//
// ⚠️ La valeur d'une plateforme entre deux relevés est INTERPOLÉE (le gain est
// réparti linéairement, les flux comptés à leur date). Une fin de mois est le
// dernier milliseconde du mois, donc juste APRÈS un relevé daté du dernier jour :
// elle capte déjà une fraction du gain du mois suivant. D'où les tolérances
// ci-dessous sur les mois qui se terminent sur un relevé — ce n'est pas du flou,
// c'est le modèle. Les invariants, eux, sont exacts.
//
// Dates par composantes (pas de chaîne ISO) → indépendantes du fuseau.

const P = {
  entries: [
    { date: new Date(2026, 0, 31), capital: 1000, contribution: 1000 }, // janv. : dépôt 1000, relevé 1000
    { date: new Date(2026, 1, 15), capital: null, contribution: 500 },  // févr. : dépôt sec de 500
    { date: new Date(2026, 1, 28), capital: 1560, contribution: 0 },    // févr. : relevé 1560
    { date: new Date(2026, 2, 31), capital: 1600, contribution: 0 },    // mars : relevé 1600
  ],
}
const FROM = new Date(2026, 0, 1).getTime()
const TO = new Date(2026, 2, 31, 23, 59, 59, 999).getTime()

describe("computeMonthlySeries", () => {
  const rows = computeMonthlySeries([P], FROM, TO)

  it("une ligne par mois de la période", () => {
    expect(rows.map((r) => r.ym)).toEqual(["2026-01", "2026-02", "2026-03"])
  })

  it("sépare la valeur, les apports et le gain de chaque mois", () => {
    const [jan, fev, mars] = rows
    // Janvier : le dépôt de 1 000 n'est pas un bénéfice (le gain n'est que le
    // jour d'interpolation qui déborde de février).
    expect(jan.value).toBeCloseTo(1002.14, 1)
    expect(jan.deposits).toBe(1000)
    expect(jan.gain).toBeCloseTo(2.14, 1)

    expect(fev.value).toBeCloseTo(1561.29, 1)
    expect(fev.deposits).toBe(500)
    expect(fev.contributions).toBe(500)
    expect(fev.gain).toBeCloseTo(59.15, 1) // ≈ 1 560 − 1 000 − 500, part d'interpolation incluse
    expect(fev.cumulContributions).toBe(1500)

    expect(mars.value).toBe(1600)
    expect(mars.gain).toBeCloseTo(38.71, 1)
    // Exact : mars se termine sur le dernier relevé, plus rien à interpoler.
    expect(mars.cumulGain).toBeCloseTo(100, 6)
  })

  it("invariant : apports cumulés + gains cumulés = valeur finale", () => {
    const last = rows[rows.length - 1]
    expect(last.cumulContributions + last.cumulGain).toBeCloseTo(last.value, 6)
  })

  it("un retrait n'est pas une perte", () => {
    const retrait = {
      entries: [
        { date: new Date(2026, 0, 31), capital: 1000, contribution: 1000 },
        { date: new Date(2026, 1, 10), capital: null, contribution: -300 },
        { date: new Date(2026, 1, 28), capital: 720, contribution: 0 },
      ],
    }
    const [, fev] = computeMonthlySeries([retrait], FROM, new Date(2026, 1, 28, 23, 59).getTime())
    expect(fev.withdrawals).toBe(-300)
    expect(fev.contributions).toBe(-300)
    expect(fev.value).toBe(720)
    expect(fev.gain).toBeCloseTo(19.29, 1) // ≈ 720 − 1 000 + 300
  })

  it("période inversée → série vide", () => {
    expect(computeMonthlySeries([P], TO, FROM)).toEqual([])
    expect(computeAnnualSeries([P], TO, FROM)).toEqual([])
  })
})

describe("computeAnnualSeries", () => {
  it("borne la première année au début de la période (valeur de départ interpolée)", () => {
    const rows = computeAnnualSeries([P], new Date(2026, 1, 1).getTime(), TO)
    expect(rows).toHaveLength(1)
    expect(rows[0].year).toBe(2026)
    expect(rows[0].value).toBe(1600)
    expect(rows[0].contributions).toBe(500)
    expect(rows[0].gain).toBeCloseTo(97.86, 1) // ≈ 1 600 − 1 000 (au 31/01) − 500
  })
})

describe("platformValueAt", () => {
  it("avant tout relevé, ne compte que les flux déjà passés", () => {
    expect(platformValueAt(P.entries, new Date(2026, 0, 1).getTime())).toBe(0)
  })

  it("entre deux relevés, interpole le gain et compte les flux à leur date", () => {
    // Entre le relevé du 31/01 (1000) et celui du 28/02 (1560), avec un dépôt de
    // 500 le 15/02 : au 20/02 on a 1000 + 500 + la part de gain écoulée.
    expect(platformValueAt(P.entries, new Date(2026, 1, 20).getTime())).toBeCloseTo(1542.86, 1)
  })

  it("après le dernier relevé, garde sa valeur", () => {
    expect(platformValueAt(P.entries, new Date(2026, 5, 1).getTime())).toBe(1600)
  })
})
