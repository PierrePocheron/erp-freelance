import { describe, it, expect } from "vitest"
import { avatarColor, initials, AVATAR_COLORS } from "@/lib/initials"

describe("initials (pastille contact)", () => {
  it("deux mots → 1re lettre de chacun", () => {
    expect(initials("alice martin")).toBe("AM")
  })

  it("un mot → 2 premières lettres ; espaces tolérés", () => {
    expect(initials("  bob  ")).toBe("BO")
    expect(initials("  alice   martin  durand ")).toBe("AM")
  })

  it("nom vide → « ? »", () => {
    expect(initials("")).toBe("?")
    expect(initials("   ")).toBe("?")
  })
})

describe("avatarColor", () => {
  it("déterministe et insensible à la casse", () => {
    expect(avatarColor("Alice Martin")).toBe(avatarColor("alice martin"))
  })

  it("toujours une couleur de la palette, même sur hash négatif / chaîne vide", () => {
    for (const n of ["", "a", "Zoé", "x".repeat(200), "Émilie Dûpont-Ñ"]) {
      expect(AVATAR_COLORS).toContain(avatarColor(n))
    }
  })

  it("répartit des noms différents sur plusieurs couleurs", () => {
    const colors = new Set(["Alice", "Bob", "Chloé", "David", "Eve", "Fanny", "Gus", "Hugo"].map(avatarColor))
    expect(colors.size).toBeGreaterThan(1)
  })
})
