import { describe, it, expect } from "vitest"
import { computeContactName } from "@/lib/contact"

// Cache d'affichage `Client.name` : priorité libellé > prénom+nom > société > fallback.

describe("computeContactName", () => {
  it("priorise le libellé quand il est renseigné", () => {
    expect(computeContactName({ label: "Compta Acme", firstName: "Jean", lastName: "Dupont", companyName: "Acme" })).toBe("Compta Acme")
  })

  it("compose prénom + nom à défaut de libellé", () => {
    expect(computeContactName({ firstName: "Jean", lastName: "Dupont" })).toBe("Jean Dupont")
  })

  it("tolère un prénom ou un nom manquant", () => {
    expect(computeContactName({ lastName: "Dupont" })).toBe("Dupont")
    expect(computeContactName({ firstName: "Jean" })).toBe("Jean")
  })

  it("retombe sur le nom de société si pas d'identité personnelle", () => {
    expect(computeContactName({ companyName: "Acme" })).toBe("Acme")
  })

  it("ignore les chaînes vides ou blanches", () => {
    expect(computeContactName({ label: "  ", firstName: " ", lastName: "Dupont" })).toBe("Dupont")
  })

  it("retourne « Sans nom » quand tout est vide", () => {
    expect(computeContactName({})).toBe("Sans nom")
    expect(computeContactName({ label: null, firstName: null, lastName: null, companyName: null })).toBe("Sans nom")
  })
})
