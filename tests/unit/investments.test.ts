import { describe, it, expect } from "vitest"
import { computePlatformStats, aggregateGlobal } from "@/lib/investments"

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
