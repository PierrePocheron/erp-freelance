import { describe, it, expect } from "vitest"
import { LayoutDashboard } from "lucide-react"
import { buildCrumbs } from "@/lib/breadcrumbs"

// Fil d'Ariane : c'est le seul repère de navigation sur grand écran (le titre de
// page y est masqué). Un id brut affiché ou un module perdu s'y verrait tout de
// suite, mais rien ne le couvrait.

const MODULES = [
  { href: "/", label: "Tableau de bord", icon: LayoutDashboard },
  { href: "/projets", label: "Projets", icon: LayoutDashboard },
  { href: "/facturation", label: "Facturation", icon: LayoutDashboard },
]

const labels = (path: string, dyn: Record<string, string> = {}) =>
  buildCrumbs(path, MODULES, dyn).map((c) => c.label)

describe("buildCrumbs", () => {
  it("racine → un seul crumb « Tableau de bord »", () => {
    expect(labels("/")).toEqual(["Tableau de bord"])
  })

  it("module connu → son libellé de navigation", () => {
    expect(labels("/projets")).toEqual(["Projets"])
  })

  it("module inconnu → segment capitalisé plutôt que rien", () => {
    expect(labels("/inconnu")).toEqual(["Inconnu"])
  })

  it("segment dynamique → libellé fourni par la page, jamais l'id", () => {
    expect(labels("/projets/clx123", { clx123: "Refonte Démo" })).toEqual(["Projets", "Refonte Démo"])
  })

  it("segment dynamique sans libellé → « Détail », et surtout pas l'id", () => {
    const crumbs = labels("/projets/clx123")
    expect(crumbs).toEqual(["Projets", "Détail"])
    expect(crumbs.join(" ")).not.toContain("clx123")
  })

  it("sous-route statique connue → son libellé", () => {
    expect(labels("/facturation/factures")).toEqual(["Facturation", "Factures"])
  })

  it("les href pointent le chemin RÉEL, pas le motif", () => {
    const crumbs = buildCrumbs("/projets/clx123/dev", MODULES, { clx123: "Refonte" })
    expect(crumbs.map((c) => c.href)).toEqual(["/projets", "/projets/clx123", "/projets/clx123/dev"])
  })
})
