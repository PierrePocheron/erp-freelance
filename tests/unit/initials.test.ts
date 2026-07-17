import { describe, it, expect } from "vitest"
import { initialsOf } from "@/lib/initials"

// Initiales du logo PDF par défaut : « Pierre Pocheron » → « PP », un seul mot
// → 2 premières lettres, fallback email puis « • ».

describe("initialsOf", () => {
  it("prend la 1re lettre des deux premiers mots", () => {
    expect(initialsOf("Pierre Pocheron", null)).toBe("PP")
  })

  it("ignore les mots au-delà du deuxième", () => {
    expect(initialsOf("Jean Marie Le Pennec", null)).toBe("JM")
  })

  it("un seul mot → ses 2 premières lettres", () => {
    expect(initialsOf("Pierre", null)).toBe("PI")
  })

  it("met en capitales quelle que soit la casse d'entrée", () => {
    expect(initialsOf("pierre pocheron", null)).toBe("PP")
    expect(initialsOf("pedro", null)).toBe("PE")
  })

  it("tolère les espaces multiples et en bordure", () => {
    expect(initialsOf("  pierre   pocheron  ", null)).toBe("PP")
  })

  it("nom absent → 1re lettre de l'email en capitale", () => {
    expect(initialsOf(null, "pierre@exemple.fr")).toBe("P")
    expect(initialsOf("   ", "jean@dupont.fr")).toBe("J")
  })

  it("nom et email absents → « • »", () => {
    expect(initialsOf(null, null)).toBe("•")
    expect(initialsOf("", "")).toBe("•")
  })
})
