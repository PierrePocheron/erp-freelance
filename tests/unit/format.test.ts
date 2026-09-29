import { describe, it, expect } from "vitest"
import { amount0, amount2, amountAuto, eur0, eur2, eurAuto } from "@/lib/format"

const nb = (s: string) => s.replace(/[  ]/g, " ") // séparateurs Intl → espace simple

describe("formatage des montants (#44)", () => {
  it("2 décimales, arrondi au centime", () => {
    expect(nb(amount2(1234.5))).toBe("1 234,50")
    expect(nb(eur2(6.666))).toBe("6,67 €")
  })
  it("arrondi à l'euro", () => {
    expect(nb(amount0(1234.5))).toBe("1 235")
    expect(nb(eur0(9.99))).toBe("10 €")
  })
  it("auto : entier sans décimales, sinon 2", () => {
    expect(nb(amountAuto(1200))).toBe("1 200")
    expect(nb(eurAuto(1234.5))).toBe("1 234,50 €")
    expect(nb(eurAuto(9.99))).toBe("9,99 €")
  })
  it("zéro normalisé (jamais « -0,00 »)", () => {
    expect(amount2(-0.004)).toBe("0,00")
    expect(amount0(-0.4)).toBe("0")
  })
  it("espace insécable avant le symbole", () => {
    expect(eur2(1)).toMatch(/ €$/)
  })
  it("valeur non finie → 0", () => {
    expect(amount2(NaN)).toBe("0,00")
  })
})
