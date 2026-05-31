import { describe, it, expect } from "vitest"
import {
  lineTotal,
  sumLineTotals,
  netAmount,
  depositAmount,
  computeTaxBreakdown,
  computeDepositDeducted,
  isInvoiceSettled,
} from "@/lib/money"

describe("lineTotal", () => {
  it("multiplie quantité par prix unitaire", () => {
    expect(lineTotal(3, 100)).toBe(300)
    expect(lineTotal(0, 100)).toBe(0)
    expect(lineTotal(2.5, 40)).toBe(100)
  })
})

describe("sumLineTotals", () => {
  it("somme les totaux de lignes", () => {
    expect(sumLineTotals([{ total: 100 }, { total: 250 }, { total: 0 }])).toBe(350)
  })
  it("retourne 0 pour une liste vide", () => {
    expect(sumLineTotals([])).toBe(0)
  })
})

describe("netAmount", () => {
  it("retranche l'acompte du total HT", () => {
    expect(netAmount(1000, 300)).toBe(700)
  })
  it("peut être négatif (acompte supérieur)", () => {
    expect(netAmount(100, 300)).toBe(-200)
  })
})

describe("depositAmount", () => {
  it("calcule un pourcentage du total HT", () => {
    expect(depositAmount(1000, 30)).toBe(300)
    expect(depositAmount(1000, 0)).toBe(0)
    expect(depositAmount(2500, 40)).toBe(1000)
  })
})

describe("computeTaxBreakdown", () => {
  it("ventile la TVA par taux et calcule le TTC", () => {
    const lines = [
      { taxRate: 20, total: 1000 },
      { taxRate: 20, total: 500 },
      { taxRate: 10, total: 200 },
    ]
    const r = computeTaxBreakdown(lines, 1700)
    expect(r.byRate[20]).toBeCloseTo(300, 6)
    expect(r.byRate[10]).toBeCloseTo(20, 6)
    expect(r.totalTVA).toBeCloseTo(320, 6)
    expect(r.totalTTC).toBeCloseTo(2020, 6)
    expect(r.allZeroTax).toBe(false)
  })

  it("franchise en base (art. 293B) : toutes lignes à 0% → allZeroTax", () => {
    const lines = [
      { taxRate: 0, total: 800 },
      { taxRate: 0, total: 200 },
    ]
    const r = computeTaxBreakdown(lines, 1000)
    expect(r.totalTVA).toBe(0)
    expect(r.totalTTC).toBe(1000)
    expect(r.allZeroTax).toBe(true)
  })

  it("liste vide → TTC = totalHT, TVA nulle", () => {
    const r = computeTaxBreakdown([], 500)
    expect(r.totalTVA).toBe(0)
    expect(r.totalTTC).toBe(500)
    expect(r.allZeroTax).toBe(true)
  })
})

describe("computeDepositDeducted", () => {
  it("somme les acomptes réellement facturés", () => {
    expect(computeDepositDeducted([300, 200], 1000, 30)).toBe(500)
  })

  it("aucun acompte facturé mais % renseigné → fallback sur le % du devis", () => {
    expect(computeDepositDeducted([], 1000, 30)).toBe(300)
  })

  it("aucun acompte et % nul → 0", () => {
    expect(computeDepositDeducted([], 1000, 0)).toBe(0)
  })

  it("acomptes présents : le % n'est PAS appliqué en plus", () => {
    expect(computeDepositDeducted([400], 1000, 30)).toBe(400)
  })
})

describe("isInvoiceSettled", () => {
  it("réglé quand le total payé couvre le net (tolérance 1 centime)", () => {
    expect(isInvoiceSettled(700, 700)).toBe(true)
    expect(isInvoiceSettled(700, 699.99)).toBe(true) // tolérance
    expect(isInvoiceSettled(700, 800)).toBe(true)
  })

  it("non réglé quand le paiement est insuffisant", () => {
    expect(isInvoiceSettled(700, 699.9)).toBe(false)
    expect(isInvoiceSettled(700, 0)).toBe(false)
  })

  it("net nul ou négatif → jamais 'réglé' (évite de solder un net à 0)", () => {
    expect(isInvoiceSettled(0, 0)).toBe(false)
    expect(isInvoiceSettled(-50, 0)).toBe(false)
  })
})
