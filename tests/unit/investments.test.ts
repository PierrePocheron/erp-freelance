import { describe, it, expect } from "vitest"
import { computePlatformStats, computePeriodStats, aggregateGlobal } from "@/lib/investments"

describe("computePlatformStats — exemple robo.cash", () => {
  // 1000 € posés, puis +200 € à 3 mois (capital 1250), puis +1000 € à 1 an (capital 2400).
  const entries = [
    { date: "2025-01-01T00:00:00Z", capital: 1000, contribution: 1000 },
    { date: "2025-04-01T00:00:00Z", capital: 1250, contribution: 200 },
    { date: "2026-01-01T00:00:00Z", capital: 2400, contribution: 1000 },
  ]
  const s = computePlatformStats(entries, new Date("2026-01-05T00:00:00Z"))

  it("somme les apports (posé de ma poche)", () => {
    expect(s.totalContributions).toBe(2200)
  })
  it("prend le dernier capital comme valeur actuelle", () => {
    expect(s.currentCapital).toBe(2400)
  })
  it("calcule les bénéfices SANS compter les apports", () => {
    expect(s.profit).toBe(200) // 50 (1er intervalle) + 150 (2e), les dépôts exclus
  })
  it("dérive une rentabilité simple correcte", () => {
    expect(s.roi).toBeCloseTo(200 / 2200, 6)
  })
  it("décompose les intervalles (gain hors apport)", () => {
    expect(s.intervals).toHaveLength(2)
    expect(s.intervals[0].gain).toBeCloseTo(50, 6)  // 1250 − 1000 − 200
    expect(s.intervals[1].gain).toBeCloseTo(150, 6) // 2400 − 1250 − 1000
    expect(s.intervals[0].returnPct).toBeCloseTo(0.05, 6) // 50 / 1000
  })
  it("chaîne le rendement pondéré par le temps (TWR)", () => {
    // (1 + 50/1000) × (1 + 150/1250) − 1 = 1.05 × 1.12 − 1
    expect(s.twr).toBeCloseTo(1.05 * 1.12 - 1, 6)
  })
})

describe("computePlatformStats — cas limites", () => {
  it("relevé unique : aucun bénéfice, aucun intervalle", () => {
    const s = computePlatformStats([{ date: "2026-01-01", capital: 500, contribution: 500 }], new Date("2026-01-02"))
    expect(s.profit).toBe(0)
    expect(s.roi).toBe(0)
    expect(s.intervals).toHaveLength(0)
    expect(s.twr).toBe(0)
  })
  it("marque un capital périmé après ~1 mois", () => {
    const recent = computePlatformStats([{ date: "2026-01-01", capital: 100, contribution: 100 }], new Date("2026-01-10"))
    expect(recent.isStale).toBe(false)
    const old = computePlatformStats([{ date: "2026-01-01", capital: 100, contribution: 100 }], new Date("2026-02-20"))
    expect(old.isStale).toBe(true)
  })
})

describe("contributionsMissing (apports non renseignés)", () => {
  it("true quand il y a du capital mais aucun apport (import Notion)", () => {
    const s = computePlatformStats([
      { date: "2025-02-05", capital: 4417.49, contribution: 0 },
      { date: "2026-07-02", capital: 4949.90, contribution: 0 },
    ], new Date("2026-07-10"))
    expect(s.contributionsMissing).toBe(true)
  })
  it("false dès qu'un apport est renseigné", () => {
    const s = computePlatformStats([{ date: "2025-01-01", capital: 1000, contribution: 1000 }], new Date("2026-01-01"))
    expect(s.contributionsMissing).toBe(false)
  })
})

describe("computePeriodStats (stats par plage de temps)", () => {
  const entries = [
    { date: "2025-01-01", capital: 1000, contribution: 1000 },
    { date: "2025-07-01", capital: 1050, contribution: 0 },
    { date: "2026-01-01", capital: 1100, contribution: 0 },
  ]
  it("fromMs ancien → couvre tout (= stats globales)", () => {
    const p = computePeriodStats(entries, 0)
    expect(p.startCapital).toBe(0)
    expect(p.apports).toBe(1000)
    expect(p.gain).toBeCloseTo(100, 6) // 1100 − 0 − 1000
  })
  it("fenêtre partielle : capital de départ interpolé, apports de la fenêtre seulement", () => {
    const from = new Date("2025-07-01").getTime()
    const p = computePeriodStats(entries, from)
    expect(p.startCapital).toBeCloseTo(1050, 6)
    expect(p.apports).toBe(0)
    expect(p.gain).toBeCloseTo(50, 6) // 1100 − 1050 − 0
  })
})

describe("dépôts dissociés (entrées capital null)", () => {
  it("compte le dépôt dans les apports et l'exclut du gain", () => {
    const s = computePlatformStats([
      { date: "2025-01-01", capital: 0, contribution: 0 },      // relevé
      { date: "2025-02-01", capital: null, contribution: 1000 }, // dépôt (flux)
      { date: "2025-06-01", capital: 1050, contribution: 0 },   // relevé
    ], new Date("2025-06-05"))
    expect(s.totalContributions).toBe(1000)
    expect(s.currentCapital).toBe(1050)
    expect(s.profit).toBeCloseTo(50, 6) // 1050 − 1000
    expect(s.intervals).toHaveLength(1) // 2 valorisations → 1 intervalle
    expect(s.intervals[0].gain).toBeCloseTo(50, 6) // 1050 − 0 − 1000 (dépôt exclu)
    expect(s.contributionsMissing).toBe(false)
  })
})

describe("indépendance dépôts / relevés (cas limites)", () => {
  it("0 dépôt : le gain d'un relevé est de la pure croissance", () => {
    const s = computePlatformStats([
      { date: "2025-01-01", capital: 1000, contribution: 0 },
      { date: "2025-02-01", capital: 1010, contribution: 0 },
    ], new Date("2025-02-05"))
    expect(s.totalContributions).toBe(0)
    expect(s.intervals[0].gain).toBeCloseTo(10, 6)
  })

  it("plusieurs dépôts entre deux relevés (même mois) : tous comptés, exclus du gain", () => {
    const s = computePlatformStats([
      { date: "2025-01-01", capital: 1000, contribution: 1000 },
      { date: "2025-06-10", capital: null, contribution: 100 },
      { date: "2025-06-20", capital: null, contribution: 200 },
      { date: "2025-07-01", capital: 1350, contribution: 0 },
    ], new Date("2025-07-05"))
    expect(s.totalContributions).toBe(1300)
    expect(s.profit).toBeCloseTo(50, 6)          // 1350 − 1300
    expect(s.intervals).toHaveLength(1)          // 2 valorisations
    expect(s.intervals[0].gain).toBeCloseTo(50, 6) // 1350 − 1000 − (100+200)
  })

  it("dépôt APRÈS le dernier relevé : intégré au capital actuel (pas un faux -)", () => {
    const s = computePlatformStats([
      { date: "2025-01-01", capital: 1000, contribution: 1000 },
      { date: "2025-02-01", capital: 1010, contribution: 0 },
      { date: "2025-02-15", capital: null, contribution: 500 }, // dépôt après le dernier relevé
    ], new Date("2025-02-20"))
    expect(s.currentCapital).toBeCloseTo(1510, 6) // 1010 + 500
    expect(s.profit).toBeCloseTo(10, 6)           // pas −490
  })

  it("dépôt AVANT le premier relevé : baked dans le relevé", () => {
    const s = computePlatformStats([
      { date: "2025-01-01", capital: null, contribution: 500 },
      { date: "2025-02-01", capital: 520, contribution: 0 },
    ], new Date("2025-02-05"))
    expect(s.currentCapital).toBe(520)
    expect(s.profit).toBeCloseTo(20, 6)
  })

  it("que des dépôts, aucun relevé : capital = apports, profit 0", () => {
    const s = computePlatformStats([
      { date: "2025-01-01", capital: null, contribution: 500 },
      { date: "2025-02-01", capital: null, contribution: 300 },
    ], new Date("2025-02-05"))
    expect(s.currentCapital).toBe(800)
    expect(s.profit).toBe(0)
    expect(s.intervals).toHaveLength(0)
  })

  it("fenêtre entièrement postérieure au dernier relevé : report à plat, gain 0", () => {
    const entries = [
      { date: "2025-10-01", capital: 1000, contribution: 1000 },
      { date: "2025-11-01", capital: 1500, contribution: 0 }, // dernier relevé
    ]
    const from = new Date("2026-06-01").getTime() // bien après le dernier relevé
    const p = computePeriodStats(entries, from)
    expect(p.startCapital).toBe(1500) // dernier capital connu, pas celui du 1er relevé
    expect(p.gain).toBeCloseTo(0, 6)  // aucune croissance mesurée dans la fenêtre
  })

  it("période démarrant dans un écart avec gros dépôt (cas Swaper) : pas de faux -", () => {
    const entries = [
      { date: "2025-02-05", capital: 0, contribution: 0 },
      { date: "2025-06-01", capital: null, contribution: 200 },
      { date: "2026-05-01", capital: null, contribution: 1000 },
      { date: "2026-05-28", capital: 1200, contribution: 0 },
      { date: "2026-08-17", capital: 1211.30, contribution: 0 },
    ]
    const from = new Date("2025-08-17").getTime() // fenêtre 12 mois
    const p = computePeriodStats(entries, from)
    expect(p.startCapital).toBeCloseTo(200, 2)  // conscient du dépôt (pas ~485 interpolé)
    expect(p.gain).toBeCloseTo(11.30, 2)        // 1211.30 − 200 − 1000 (pas −275)
    expect(p.returnPct).toBeGreaterThan(0)
  })
})

describe("robustesse des performances (régression audit)", () => {
  it("#1 apports qui s'annulent (dépôt +2000, retrait −2000) : PAS « à renseigner », profit exact", () => {
    const s = computePlatformStats([
      { date: "2025-01-01", capital: null, contribution: 2000 },
      { date: "2025-06-01", capital: 2200, contribution: 0 },
      { date: "2025-07-01", capital: null, contribution: -2000 },
    ], new Date("2025-07-15"))
    expect(s.totalContributions).toBe(0)
    expect(s.currentCapital).toBeCloseTo(200, 6)
    expect(s.profit).toBeCloseTo(200, 6)
    expect(s.contributionsMissing).toBe(false) // des apports SONT saisis, ils se compensent
  })

  it("#2 ouverture à capital 0 puis dépôt : le TWR n'est plus écrasé à 0", () => {
    const s = computePlatformStats([
      { date: "2025-01-01", capital: 0, contribution: 0 },
      { date: "2025-02-01", capital: null, contribution: 1000 },
      { date: "2025-03-01", capital: 1050, contribution: 0 },
    ], new Date("2025-03-05"))
    expect(s.profit).toBeCloseTo(50, 6)
    expect(s.twr).toBeGreaterThan(0)              // avant : 0
    expect(s.annualizedPct).toBeGreaterThan(0)
    expect(Number.isFinite(s.annualizedPct)).toBe(true)
  })

  it("#3 gros dépôt en début d'intervalle : base Modified-Dietz → rendement ~5 %, pas 50 %", () => {
    const s = computePlatformStats([
      { date: "2025-01-01", capital: 1000, contribution: 1000 },
      { date: "2025-01-02", capital: null, contribution: 9000 },
      { date: "2026-01-01", capital: 10500, contribution: 0 },
    ], new Date("2026-01-05"))
    expect(s.profit).toBeCloseTo(500, 6)
    expect(s.intervals[0].returnPct).toBeGreaterThan(0.04)
    expect(s.intervals[0].returnPct).toBeLessThan(0.06) // ~5,0 %, plus le 50 % gonflé
    expect(s.annualizedPct).toBeLessThan(0.10)
  })

  it("#5 perte > 100 % d'un intervalle : annualisé/mensuel finis (plancher −100 %), pas NaN", () => {
    const s = computePlatformStats([
      { date: "2026-01-01", capital: 1000, contribution: 1000 },
      { date: "2026-01-15", capital: null, contribution: 5000 },
      { date: "2026-02-01", capital: 2000, contribution: 0 },
    ], new Date("2026-02-05"))
    expect(Number.isFinite(s.annualizedPct)).toBe(true)
    expect(Number.isFinite(s.monthlyAvgPct)).toBe(true)
    expect(s.annualizedPct).toBeGreaterThanOrEqual(-1)
    expect(s.profit).toBeCloseTo(-4000, 6)
  })

  it("#6 même perte via computePeriodStats : rendement de fenêtre fini (pas de NaN propagé au global)", () => {
    const entries = [
      { date: "2026-01-01", capital: 1000, contribution: 1000 },
      { date: "2026-01-15", capital: null, contribution: 5000 },
      { date: "2026-02-01", capital: 2000, contribution: 0 },
    ]
    const p = computePeriodStats(entries, 0)
    expect(Number.isFinite(p.returnPct)).toBe(true)
    expect(Number.isFinite(p.annualizedPct)).toBe(true)
    expect(Number.isFinite(p.monthlyPct)).toBe(true)
  })

  it("#7 span très court (2 jours) : pas d'annualisation délirante", () => {
    const s = computePlatformStats([
      { date: "2026-01-01T09:00:00", capital: 1000, contribution: 1000 },
      { date: "2026-01-03T09:00:00", capital: 1020, contribution: 0 },
    ], new Date("2026-01-04"))
    expect(s.twr).toBeCloseTo(0.02, 6)
    expect(s.annualizedPct).toBeLessThan(1)        // avant : ~3620 %
    expect(s.annualizedPct).toBeCloseTo(0.02, 6)   // reporte le cumulé, pas d'extrapolation
  })

  it("#8 apports nets ≤ 0 (retrait > dépôts) : ROI cohérent avec le profit, pas 0", () => {
    const s = computePlatformStats([
      { date: "2026-01-01", capital: 1000, contribution: 1000 },
      { date: "2026-07-01", capital: 1500, contribution: 0 },
      { date: "2026-08-01", capital: null, contribution: -1200 },
    ], new Date("2026-08-05"))
    expect(s.currentCapital).toBeCloseTo(300, 6)
    expect(s.profit).toBeCloseTo(500, 6)
    expect(s.roi).toBeGreaterThan(0)               // avant : 0 (dénominateur net ≤ 0)
    expect(s.contributionsMissing).toBe(false)
  })

  it("#9 dépôt après le dernier relevé mais avant la fenêtre : ne fuit pas en bénéfice", () => {
    const entries = [
      { date: "2025-10-01", capital: 1000, contribution: 1000 },
      { date: "2025-11-01", capital: 1500, contribution: 0 },
      { date: "2025-12-01", capital: null, contribution: 500 }, // dépôt post-dernier-relevé
    ]
    const p = computePeriodStats(entries, new Date("2026-01-01").getTime())
    expect(p.startCapital).toBeCloseTo(2000, 6)    // 1500 + dépôt 500 réintégré
    expect(p.gain).toBeCloseTo(0, 6)               // avant : +500 fantôme
  })
})

describe("aggregateGlobal", () => {
  it("agrège apports, valeur et bénéfices sur plusieurs plateformes", () => {
    const a = computePlatformStats([{ date: "2026-01-01", capital: 1200, contribution: 1000 }], new Date("2026-02-01"))
    const b = computePlatformStats([{ date: "2026-01-01", capital: 500, contribution: 500 }], new Date("2026-02-01"))
    const g = aggregateGlobal([a, b])
    expect(g.totalContributions).toBe(1500)
    expect(g.currentCapital).toBe(1700)
    expect(g.profit).toBe(200)
    expect(g.platformCount).toBe(2)
  })
})
