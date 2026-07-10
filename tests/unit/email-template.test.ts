import { describe, it, expect } from "vitest"
import { renderTemplate, bodyToHtml } from "@/lib/email-template"

const prospect = {
  name: "Jean Dupont",
  firstName: "Jean",
  lastName: "Dupont",
  company: "Boulangerie Dupont",
  websiteUrl: "https://boulangerie-dupont.fr",
  city: "Lyon",
  region: null,
  businessDescription: null,
}

describe("renderTemplate", () => {
  it("substitue les variables par les champs du prospect", () => {
    const { subject, body, missing } = renderTemplate(
      { subject: "Votre site {{site}}", body: "Bonjour {{prenom}}, j'ai vu le site de {{societe}} à {{ville}}." },
      prospect
    )
    expect(subject).toBe("Votre site https://boulangerie-dupont.fr")
    expect(body).toBe("Bonjour Jean, j'ai vu le site de Boulangerie Dupont à Lyon.")
    expect(missing).toEqual([])
  })

  it("tolère les espaces dans les accolades ({{ prenom }})", () => {
    const { body } = renderTemplate({ subject: "s", body: "Bonjour {{ prenom }} !" }, prospect)
    expect(body).toBe("Bonjour Jean !")
  })

  it("variable inconnue → substituée par vide + remontée dans missing", () => {
    const { body, missing } = renderTemplate({ subject: "s", body: "Salut {{pseudo}}" }, prospect)
    expect(body).toBe("Salut ")
    expect(missing).toEqual(["pseudo"])
  })

  it("champ null/vide → vide + remonté dans missing (une seule fois)", () => {
    const { body, missing } = renderTemplate(
      { subject: "s", body: "{{region}} et {{region}} et {{description}}" },
      prospect
    )
    expect(body).toBe(" et  et ")
    expect(missing).toEqual(["region", "description"])
  })
})

describe("bodyToHtml", () => {
  it("convertit les doubles sauts de ligne en paragraphes et échappe le HTML", () => {
    const html = bodyToHtml("Bonjour <b>Jean</b>\n\nLigne 2\nLigne 3")
    expect(html).toBe("<p>Bonjour &lt;b&gt;Jean&lt;/b&gt;</p>\n<p>Ligne 2<br />Ligne 3</p>")
  })
})
