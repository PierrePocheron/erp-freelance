import { describe, it, expect } from "vitest"
import { classifyTech, resolveTech, suggestFamily, GROUP_META, GROUP_ORDER, ALL_TECHS } from "@/lib/tech-icons"

// La table est éditée à la main : ces tests figent les pièges déjà rencontrés.
describe("classification des technos", () => {
  it("reconnaît les noms verbeux réels", () => {
    expect(classifyTech("Spring Cloud Gateway").family).toBe("BACKEND")
    expect(classifyTech("SpotBugs + FindSecBugs (SAST)").group).toBe("Sécurité — SAST")
    expect(classifyTech("FastAPI").kind).toBe("framework")
    expect(classifyTech("PostgreSQL").family).toBe("DATABASE")
  })

  it("garde la ponctuation signifiante (C# ne se réduit pas à « c »)", () => {
    expect(resolveTech("C#")?.slug).toBe("csharp")
    expect(classifyTech("C#").family).toBe("BACKEND")
  })

  it("n'attrape pas une techno par une sous-chaîne au milieu d'un mot", () => {
    // « digital » contient « git » : ce faux positif classait la compétence en DevOps.
    expect(classifyTech("Marketing digital").tech).toBeNull()
    expect(suggestFamily("Marketing digital")).not.toBe("DEVOPS")
    // mais le mot entier fonctionne
    expect(resolveTech("Git")?.slug).toBe("git")
  })

  it("classe une migration en concept malgré la techno citée", () => {
    expect(classifyTech("Migration Spring Boot 3.5 → 4.x").family).toBe("CONCEPT")
  })

  it("laisse la famille indéterminée sur un nom inconnu", () => {
    expect(suggestFamily("Truc totalement inconnu")).toBeNull()
  })

  it("déclare chaque sous-groupe utilisé par la table", () => {
    for (const t of ALL_TECHS) {
      if (!t.group) continue
      expect(GROUP_META[t.group], `couleur manquante pour ${t.group}`).toBeDefined()
      expect(GROUP_ORDER, `ordre manquant pour ${t.group}`).toContain(t.group)
    }
  })

  it("n'a pas de clé en double dans une même entrée", () => {
    for (const t of ALL_TECHS) expect(new Set(t.keys).size, `clé dupliquée sur ${t.label}`).toBe(t.keys.length)
  })
})
