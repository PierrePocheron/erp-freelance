import { describe, it, expect } from "vitest"
import { readFileSync } from "node:fs"
import { ALL_MODULE_IDS } from "@/lib/module-defs"

// Un module s'ajoute à TROIS endroits (CLAUDE.md) : module-defs, la barre latérale et la
// palette ⌘K (liste statique séparée). L'oubli du 3ᵉ est déjà arrivé (#23) : ce test lit les
// deux fichiers de navigation et exige chaque identifiant de module dans chacun.
const moduleIdsIn = (path: string) =>
  new Set([...readFileSync(path, "utf8").matchAll(/moduleId:\s*"([a-z-]+)"/g)].map((m) => m[1]))

describe("câblage des modules", () => {
  const sidebar = moduleIdsIn("src/components/layout/Sidebar.tsx")
  const palette = moduleIdsIn("src/components/layout/CommandPalette.tsx")

  it.each(ALL_MODULE_IDS)("« %s » est dans la barre latérale et dans la palette ⌘K", (id) => {
    expect(sidebar, `absent de Sidebar.tsx (navItems)`).toContain(id)
    expect(palette, `absent de CommandPalette.tsx (ALL_NAV_ITEMS)`).toContain(id)
  })

  it("aucun identifiant inconnu dans la navigation", () => {
    const known = new Set<string>(ALL_MODULE_IDS)
    expect([...sidebar, ...palette].filter((id) => !known.has(id))).toEqual([])
  })
})
