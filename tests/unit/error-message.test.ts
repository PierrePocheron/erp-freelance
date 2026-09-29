import { describe, it, expect } from "vitest"
import { errorMessage } from "@/lib/error-message"

describe("errorMessage", () => {
  it("garde un message métier", () => {
    expect(errorMessage(new Error("Le client n'a pas d'adresse email"), "x")).toBe("Le client n'a pas d'adresse email")
  })
  it("remplace le message masqué par Next en production", () => {
    const masked = new Error("An error occurred in the Server Components render. The specific message is omitted in production builds to avoid leaking sensitive details.")
    expect(errorMessage(masked, "Envoi impossible")).toBe("Envoi impossible")
  })
  it("valeur non-Error ou message vide → libellé de repli", () => {
    expect(errorMessage("boom", "Repli")).toBe("Repli")
    expect(errorMessage(new Error(""), "Repli")).toBe("Repli")
  })
})
