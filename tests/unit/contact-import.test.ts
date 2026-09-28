import { describe, it, expect } from "vitest"
import {
  parseVcf, fromPicker, normalizePhone, normalizeEmail, normalizeName, splitName, matchContacts, rematch,
  type ErpContact, type ImportedContact,
} from "@/lib/contact-import"

// Données FICTIVES uniquement (repo public) : noms génériques, numéros 06 12 34 56 78, domaines example.*

const APPLE_VCF = [
  "BEGIN:VCARD",
  "VERSION:3.0",
  "PRODID:-//Apple Inc.//iPhone OS 17.5//EN",
  "N:Dupont;Jean;;;",
  "FN:Jean Dupont",
  "ORG:Acme Corp;",
  "item1.EMAIL;type=INTERNET;type=pref:Jean.Dupont@Example.com",
  "EMAIL;type=INTERNET;type=HOME:jean@perso.example.org",
  "item2.TEL;type=pref:06 12 34 56 78",
  "item2.X-ABLabel:Mobile",
  "TEL;type=WORK:+33 1 23 45 67 89",
  "NOTE:Une note qui se replie",
  "  sur la ligne suivante",
  "PHOTO;ENCODING=b;TYPE=JPEG:/9j/4AAQSkZJRgABAQAAAQABAAD",
  " AAAAAAAAAAAAAAAAAA",
  "END:VCARD",
  "BEGIN:VCARD",
  "VERSION:4.0",
  "FN:Marie Curie",
  "TEL;TYPE=cell;VALUE=uri:tel:+33-6-98-76-54-32",
  "EMAIL:marie.curie@example.com",
  "END:VCARD",
].join("\r\n")

describe("normalisation", () => {
  it("ramène toutes les écritures d'un mobile FR au même E.164", () => {
    for (const raw of ["06 12 34 56 78", "+33 6 12 34 56 78", "0612345678", "06.12.34.56.78", "tel:+33-6-12-34-56-78", "0033 6 12 34 56 78"]) {
      expect(normalizePhone(raw)).toBe("+33612345678")
    }
    expect(normalizePhone("abc")).toBeNull()
    expect(normalizePhone("")).toBeNull()
  })
  it("emails en minuscules, rejet du bruit", () => {
    expect(normalizeEmail("  Jean.Dupont@Example.COM ")).toBe("jean.dupont@example.com")
    expect(normalizeEmail("pas un email")).toBeNull()
  })
  it("noms comparables sans accents ni ponctuation", () => {
    expect(normalizeName("Élodie  Le-Guen")).toBe("elodie le guen")
    expect(splitName("Jean Pierre Dupont")).toEqual({ firstName: "Jean", lastName: "Pierre Dupont" })
    expect(splitName("Prince")).toEqual({ firstName: "Prince" })
  })
})

describe("parseVcf", () => {
  const cards = parseVcf(APPLE_VCF)
  it("lit plusieurs cartes 3.0/4.0 dans un même fichier", () => {
    expect(cards).toHaveLength(2)
  })
  it("carte Apple : N structuré, groupes item1./item2., types, repli, PHOTO ignorée", () => {
    const j = cards[0]
    expect(j.name).toBe("Jean Dupont")
    expect(j.firstName).toBe("Jean"); expect(j.lastName).toBe("Dupont")
    expect(j.company).toBe("Acme Corp")
    expect(j.emails).toEqual(["jean.dupont@example.com", "jean@perso.example.org"])
    expect(j.phones).toEqual(["+33612345678", "+33123456789"])
  })
  it("carte 4.0 : FN seul → prénom/nom déduits, tel: URI normalisé", () => {
    const m = cards[1]
    expect(m.firstName).toBe("Marie"); expect(m.lastName).toBe("Curie")
    expect(m.phones).toEqual(["+33698765432"])
    expect(m.emails).toEqual(["marie.curie@example.com"])
  })
  it("décode le quoted-printable des vieux exports", () => {
    const c = parseVcf("BEGIN:VCARD\nVERSION:2.1\nFN;ENCODING=QUOTED-PRINTABLE;CHARSET=UTF-8:J=C3=A9r=C3=B4me\nEND:VCARD")
    expect(c[0].name).toBe("Jérôme")
  })
  it("ignore les cartes vides et le texte hors carte", () => {
    expect(parseVcf("bonjour\nBEGIN:VCARD\nVERSION:3.0\nEND:VCARD")).toHaveLength(0)
  })
})

describe("fromPicker", () => {
  it("normalise le résultat du Contact Picker", () => {
    const [c] = fromPicker([{ name: ["Jean Dupont"], email: ["JEAN@Example.com"], tel: ["06 12 34 56 78"] }])
    expect(c.source).toBe("picker")
    expect(c.firstName).toBe("Jean"); expect(c.lastName).toBe("Dupont")
    expect(c.emails).toEqual(["jean@example.com"]); expect(c.phones).toEqual(["+33612345678"])
  })
})

const erp: ErpContact[] = [
  { id: "a", name: "Jean Dupont",  firstName: "Jean",  lastName: "Dupont", label: null, email: "jean.dupont@example.com", personalEmail: null, phone: null,           company: "Acme" },
  { id: "b", name: "Marie Curie",  firstName: "Marie", lastName: "Curie",  label: null, email: null,                      personalEmail: null, phone: "06 98 76 54 32", company: null },
  { id: "c", name: "Paul Martin",  firstName: "Paul",  lastName: "Martin", label: null, email: null,                      personalEmail: null, phone: null,           company: null },
]
const imp = (over: Partial<ImportedContact> & { name: string }): ImportedContact =>
  ({ key: `k:${over.name}`, source: "vcf", emails: [], phones: [], ...over })

describe("matchContacts", () => {
  it("SÛR par email : complète l'email perso et le téléphone, pré-cochés", () => {
    const [p] = matchContacts([imp({ name: "Jean Dupont", emails: ["jean.dupont@example.com", "jean@perso.example.org"], phones: ["+33612345678"] })], erp, { proposeCreate: true })
    expect(p.match).toMatchObject({ clientId: "a", confidence: "SURE" })
    expect(p.changes).toEqual([
      { field: "personalEmail", from: null, to: "jean@perso.example.org", kind: "fill", checked: true },
      { field: "phone",         from: null, to: "+33612345678",           kind: "fill", checked: true },
    ])
  })
  it("SÛR par téléphone (numéro ERP non normalisé en base) : propose l'email", () => {
    const [p] = matchContacts([imp({ name: "M. Curie", phones: ["+33698765432"], emails: ["marie@example.com"] })], erp, { proposeCreate: true })
    expect(p.match).toMatchObject({ clientId: "b", confidence: "SURE" })
    expect(p.changes).toEqual([{ field: "email", from: null, to: "marie@example.com", kind: "fill", checked: true }])
  })
  it("PROBABLE : même nom, ordre inversé, rien à ajouter", () => {
    const [p] = matchContacts([imp({ name: "Dupont Jean" })], erp, { proposeCreate: true })
    expect(p.match).toMatchObject({ clientId: "a", confidence: "LIKELY" })
    expect(p.changes).toEqual([])
  })
  it("À VÉRIFIER : nom approchant → proposition présente mais DÉCOCHÉE", () => {
    const [p] = matchContacts([imp({ name: "Paul Martin Durand", emails: ["paul@example.com"] })], erp, { proposeCreate: true })
    expect(p.match).toMatchObject({ clientId: "c", confidence: "DOUBTFUL" })
    expect(p.changes[0]).toMatchObject({ field: "email", to: "paul@example.com", checked: false })
  })
  it("remplacement d'un téléphone existant : toujours décoché", () => {
    const [p] = matchContacts([imp({ name: "Marie Curie", phones: ["+33611111111"] })], erp, { proposeCreate: true })
    expect(p.match?.clientId).toBe("b")
    expect(p.changes).toEqual([{ field: "phone", from: "06 98 76 54 32", to: "+33611111111", kind: "replace", checked: false }])
  })
  it("inconnu : création proposée mais décochée (import téléphone), exclu côté Google", () => {
    const unknown = imp({ name: "Zoé Inconnue", emails: ["zoe@example.com"] })
    const [p] = matchContacts([unknown], erp, { proposeCreate: true })
    expect(p.match).toBeNull(); expect(p.createChecked).toBe(false)
    expect(matchContacts([unknown], erp, { proposeCreate: false })).toHaveLength(0)
  })
  it("Google : un contact déjà à jour n'est pas proposé", () => {
    expect(matchContacts([imp({ name: "Jean Dupont", emails: ["jean.dupont@example.com"] })], erp, { proposeCreate: false })).toHaveLength(0)
  })
  it("tri : sûrs, puis probables, puis à vérifier, puis inconnus", () => {
    const out = matchContacts([
      imp({ name: "Zoé Inconnue" }),
      imp({ name: "Paul Martin Durand", emails: ["p@example.com"] }),
      imp({ name: "Dupont Jean" }),
      imp({ name: "X", phones: ["+33698765432"], emails: ["m@example.com"] }),
    ], erp, { proposeCreate: true })
    expect(out.map((p) => p.match?.confidence ?? "NONE")).toEqual(["SURE", "LIKELY", "DOUBTFUL", "NONE"])
  })
  it("rematch manuel vers un contact sans lien apparent → À VÉRIFIER, changements recalculés", () => {
    const r = rematch(imp({ name: "Zoé Inconnue", emails: ["zoe@example.com"] }), erp[2])
    expect(r.match).toMatchObject({ clientId: "c", confidence: "DOUBTFUL" })
    expect(r.changes).toEqual([{ field: "email", from: null, to: "zoe@example.com", kind: "fill", checked: false }])
  })
})
