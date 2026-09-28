import { describe, it, expect } from "vitest"
import { parseAllowlist, hasAllowlist, isEmailAllowed } from "@/lib/auth-allowlist"

describe("liste blanche de connexion", () => {
  it("découpe sur virgules, points-virgules et espaces, normalise la casse", () => {
    expect(parseAllowlist(" A@x.fr , b@y.fr;C@z.fr\n")).toEqual(["a@x.fr", "b@y.fr", "c@z.fr"])
  })

  it("liste absente ou vide = pas de liste (la porte stricte est côté signIn)", () => {
    for (const raw of [undefined, null, "", "  ", ",,; "]) {
      expect(hasAllowlist(raw)).toBe(false)
      expect(isEmailAllowed("inconnu@example.com", raw)).toBe(true)
    }
  })

  it("n'autorise que les emails listés, insensible à la casse et aux espaces", () => {
    const raw = "moi@exemple.fr"
    expect(isEmailAllowed("moi@exemple.fr", raw)).toBe(true)
    expect(isEmailAllowed("  MOI@Exemple.FR ", raw)).toBe(true)
    expect(isEmailAllowed("autre@exemple.fr", raw)).toBe(false)
    // pas de correspondance partielle : un sous-domaine ou un suffixe ne passe pas
    expect(isEmailAllowed("moi@exemple.fr.attaquant.com", raw)).toBe(false)
    expect(isEmailAllowed("xmoi@exemple.fr", raw)).toBe(false)
  })

  it("refuse une session sans email", () => {
    expect(isEmailAllowed(null, "moi@exemple.fr")).toBe(false)
    expect(isEmailAllowed(undefined, "moi@exemple.fr")).toBe(false)
    expect(isEmailAllowed("", "moi@exemple.fr")).toBe(false)
  })
})
