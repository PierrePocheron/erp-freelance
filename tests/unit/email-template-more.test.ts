import { describe, it, expect, vi, afterEach } from "vitest"
import {
  renderTemplate,
  residualTemplateVars,
  isValidEmailAddress,
  bodyToHtml,
  stripMarkdown,
  TEMPLATE_VARIABLES,
} from "@/lib/email-template"

// Prospect entièrement fictif.
const base = { name: "Alice Martin", firstName: "Alice", lastName: "Martin" }

const render = (body: string, prospect: Parameters<typeof renderTemplate>[1]) =>
  renderTemplate({ subject: "", body }, prospect)

describe("renderTemplate — toutes les variables documentées", () => {
  afterEach(() => vi.useRealTimers())

  it("chaque clé de TEMPLATE_VARIABLES est résolue quand le champ est renseigné", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-06-15T12:00:00Z"))
    const prospect = {
      ...base,
      company: "Fournil Test",
      websiteUrl: "https://exemple.test",
      city: "Villeneuve",
      region: "Région Test",
      businessDescription: "Boulangerie",
      cms: "local.fr",
      seoScore: 42,
      seoIssues: "  pas de balise title  ",
      publicationManager: "Bob Durand",
      domainCreatedAt: "2021-06-11",
    }
    const body = TEMPLATE_VARIABLES.map((v) => `{{${v.key}}}`).join("|")
    const { body: out, missing } = render(body, prospect)
    expect(missing).toEqual([])
    expect(out).toBe(
      [
        "Alice", "Martin", "Alice Martin", "Fournil Test", "https://exemple.test",
        "Villeneuve", "Région Test", "Boulangerie", "local.fr", "42",
        "pas de balise title", "Bob Durand", "5 ans",
      ].join("|"),
    )
  })

  it("score SEO à 0 est une vraie valeur (pas « manquant »)", () => {
    expect(render("{{score_seo}}", { ...base, seoScore: 0 })).toEqual({ subject: "", body: "0", missing: [] })
  })

  it("nom_complet vide, problèmes SEO blancs, score null → manquants", () => {
    const { body, missing } = render("{{nom_complet}}{{problemes_seo}}{{score_seo}}{{cms}}", {
      name: "",
      seoIssues: "   ",
      seoScore: null,
    })
    expect(body).toBe("")
    expect(missing).toEqual(["nom_complet", "problemes_seo", "score_seo", "cms"])
  })

  it("variables substituées aussi dans le sujet", () => {
    const r = renderTemplate({ subject: "Pour {{societe}}", body: "x" }, { ...base, company: "Société Test" })
    expect(r.subject).toBe("Pour Société Test")
  })
})

describe("renderTemplate — âge du site", () => {
  afterEach(() => vi.useRealTimers())
  const now = new Date("2026-06-15T12:00:00Z")

  it.each([
    ["2025-06-14", "1 an"],
    ["2024-01-01", "2 ans"],
    ["2026-01-01", "moins d'un an"],
  ])("%s → %s", (createdAt, expected) => {
    vi.useFakeTimers()
    vi.setSystemTime(now)
    expect(render("{{age_site}}", { ...base, domainCreatedAt: createdAt }).body).toBe(expected)
  })

  it("accepte un objet Date", () => {
    vi.useFakeTimers()
    vi.setSystemTime(now)
    expect(render("{{age_site}}", { ...base, domainCreatedAt: new Date("2016-01-01") }).body).toBe("10 ans")
  })

  it("date absente ou invalide → manquante", () => {
    expect(render("{{age_site}}", { ...base, domainCreatedAt: null }).missing).toEqual(["age_site"])
    expect(render("{{age_site}}", { ...base, domainCreatedAt: "pas-une-date" }).missing).toEqual(["age_site"])
  })
})

describe("residualTemplateVars", () => {
  it("liste les variables restantes, dédoublonnées, sur plusieurs textes", () => {
    expect(residualTemplateVars("Bonjour {{prenom}}", "{{ societe }} et {{prenom}}")).toEqual(["prenom", "societe"])
  })

  it("aucun texte ou aucun marqueur → []", () => {
    expect(residualTemplateVars()).toEqual([])
    expect(residualTemplateVars("Bonjour Alice", "{ prenom }")).toEqual([])
  })
})

describe("isValidEmailAddress", () => {
  it.each([
    ["alice@exemple.test", true],
    ["  alice@exemple.test  ", true],
    ["alice@exemple", false],
    ["alice exemple@test.fr", false],
    ["@exemple.test", false],
    ["", false],
    [null, false],
    [undefined, false],
  ])("%s → %s", (email, ok) => {
    expect(isValidEmailAddress(email as string | null | undefined)).toBe(ok)
  })
})

describe("bodyToHtml / stripMarkdown — gras Markdown", () => {
  it("**texte** → <b> après échappement (pas d'injection via le gras)", () => {
    expect(bodyToHtml("Offre **<i>spéciale</i>** ici")).toBe(
      "<p>Offre <b>&lt;i&gt;spéciale&lt;/i&gt;</b> ici</p>",
    )
  })

  it("plusieurs gras non gourmands sur une ligne", () => {
    expect(bodyToHtml("**a** et **b**")).toBe("<p><b>a</b> et <b>b</b></p>")
  })

  it("stripMarkdown retire les marqueurs, laisse le reste", () => {
    expect(stripMarkdown("**Bonjour** Alice, **à bientôt**")).toBe("Bonjour Alice, à bientôt")
    expect(stripMarkdown("pas de gras * ici")).toBe("pas de gras * ici")
  })
})
