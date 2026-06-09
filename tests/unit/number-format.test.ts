import { describe, it, expect } from "vitest"
import { buildNumberParts, buildNumberPreview, type NumberFormat } from "@/lib/number-format"

// Date fixe : 7 mai 2026 → yyyy=2026, yy=26, mm=05.
const D = new Date("2026-05-07T10:00:00Z")

describe("buildNumberParts", () => {
  it("PREFIX-YYYY-NNN → préfixe annuel, 3 chiffres", () => {
    expect(buildNumberParts("PREFIX-YYYY-NNN", "FAC", D)).toEqual({ scopePrefix: "FAC-2026-", digits: 3 })
  })

  it("PREFIX-YYYY-NN → préfixe annuel, 2 chiffres", () => {
    expect(buildNumberParts("PREFIX-YYYY-NN", "FAC", D)).toEqual({ scopePrefix: "FAC-2026-", digits: 2 })
  })

  it("PREFIX-YYMM-NN → préfixe mensuel court (YYMM), 2 chiffres", () => {
    expect(buildNumberParts("PREFIX-YYMM-NN", "DEV", D)).toEqual({ scopePrefix: "DEV-2605-", digits: 2 })
  })

  it("PREFIX-YYYYMM-NN → préfixe mensuel long (YYYYMM), 2 chiffres", () => {
    expect(buildNumberParts("PREFIX-YYYYMM-NN", "DEV", D)).toEqual({ scopePrefix: "DEV-202605-", digits: 2 })
  })

  it("YYMM-NNN → sans préfixe, mensuel, 3 chiffres", () => {
    expect(buildNumberParts("YYMM-NNN", "FAC", D)).toEqual({ scopePrefix: "2605-", digits: 3 })
  })

  it("format inconnu → retombe sur l'annuel 3 chiffres", () => {
    expect(buildNumberParts("BOGUS" as NumberFormat, "FAC", D)).toEqual({ scopePrefix: "FAC-2026-", digits: 3 })
  })

  it("janvier est zero-paddé sur 2 chiffres dans le mois", () => {
    const jan = new Date("2026-01-09T10:00:00Z")
    expect(buildNumberParts("PREFIX-YYMM-NN", "FAC", jan).scopePrefix).toBe("FAC-2601-")
  })
})

describe("buildNumberPreview", () => {
  it("rend le premier numéro zero-paddé selon le format", () => {
    // buildNumberPreview utilise la date courante : on ne teste que la partie séquence.
    expect(buildNumberPreview("PREFIX-YYYY-NNN", "FAC")).toMatch(/^FAC-\d{4}-001$/)
    expect(buildNumberPreview("PREFIX-YYMM-NN", "FAC")).toMatch(/^FAC-\d{4}-01$/)
    expect(buildNumberPreview("YYMM-NNN", "FAC")).toMatch(/^\d{4}-001$/)
  })
})
