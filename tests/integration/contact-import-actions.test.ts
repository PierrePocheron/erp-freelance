import { describe, it, expect, vi, afterEach } from "vitest"
import {
  previewVcfImport,
  previewPickedImport,
  previewGoogleEnrichment,
  rematchProposal,
  applyContactImport,
} from "@/actions/contact-import"
import { hasContactsScope, getGoogleContactsToken, fetchGoogleContacts, CONTACTS_SCOPES } from "@/lib/google-contacts"
import { prisma } from "@/lib/prisma"
import { setTestUser } from "./setup"
import { makeUser, makeClient } from "./helpers/factories"

// Import de contacts (vCard, Contact Picker, Google People) : prévisualisation
// sans écriture, application des décisions (anti-IDOR, normalisation), et
// client Google People (fetch MOCKÉ — aucun appel réseau, aucun vrai jeton).
// Données FACTICES uniquement.

const fetchMock = vi.fn()
afterEach(() => {
  fetchMock.mockReset()
  vi.unstubAllGlobals()
})
function stubFetch(impl: (url: string, init?: RequestInit) => Response | Promise<Response>) {
  fetchMock.mockImplementation(async (url: string | URL, init?: RequestInit) => impl(String(url), init))
  vi.stubGlobal("fetch", fetchMock)
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })

async function asNewUser() {
  const u = await makeUser()
  setTestUser(u.id)
  return u
}

const BOTH_SCOPES = `openid email ${CONTACTS_SCOPES.join(" ")}`
async function googleAccount(userId: string, over: Record<string, unknown> = {}) {
  return prisma.account.create({
    data: {
      userId, type: "oauth", provider: "google", providerAccountId: `fake-${userId}`,
      scope: BOTH_SCOPES, access_token: "fake-access-token",
      expires_at: Math.floor(Date.now() / 1000) + 3600, ...over,
    },
  })
}

const VCF = [
  "BEGIN:VCARD", "VERSION:3.0", "N:Test;Jean;;;", "FN:Jean Test",
  "EMAIL;type=INTERNET:jean.test@example.com", "TEL;type=CELL:06 00 00 00 01", "END:VCARD",
  "BEGIN:VCARD", "VERSION:3.0", "FN:Zoé Inconnue", "EMAIL:zoe@example.com", "END:VCARD",
].join("\r\n")

// ── Prévisualisation vCard ───────────────────────────────────────────────────

describe("previewVcfImport", () => {
  it("rapproche des contacts du user, propose la création des inconnus, n'écrit rien", async () => {
    const user = await asNewUser()
    const jean = await makeClient(user.id, { type: "CLIENT", name: "Jean Test", firstName: "Jean", lastName: "Test", email: "jean.test@example.com" })

    const proposals = await previewVcfImport(VCF)

    expect(proposals).toHaveLength(2)
    const [sure, unknown] = proposals
    expect(sure.match).toMatchObject({ clientId: jean.id, confidence: "SURE" })
    expect(sure.changes).toEqual([{ field: "phone", from: null, to: "+33600000001", kind: "fill", checked: true }])
    expect(unknown).toMatchObject({ match: null, createChecked: false })
    expect((await prisma.client.findUnique({ where: { id: jean.id } }))?.phone).toBeNull()
    expect(await prisma.client.count()).toBe(1)
  })

  it("isolation : un contact d'autrui avec le même email n'est jamais proposé", async () => {
    const owner = await makeUser()
    await makeClient(owner.id, { name: "Jean Test", email: "jean.test@example.com" })
    await asNewUser()

    const proposals = await previewVcfImport(VCF)
    expect(proposals.every((p) => p.match === null && p.candidates.length === 0)).toBe(true)
  })

  it("refuse un fichier trop gros ou sans carte lisible", async () => {
    await asNewUser()
    await expect(previewVcfImport("x".repeat(5_000_001))).rejects.toThrow("Fichier trop volumineux")
    await expect(previewVcfImport("pas une vcard")).rejects.toThrow("Aucun contact lisible")
  })
})

describe("previewPickedImport", () => {
  it("rapproche par téléphone et plafonne à 500 contacts", async () => {
    const user = await asNewUser()
    const marie = await makeClient(user.id, { name: "Marie Exemple", firstName: "Marie", lastName: "Exemple", phone: "06 00 00 00 02" })

    const [p] = await previewPickedImport([{ name: ["M. Exemple"], tel: ["+33 6 00 00 00 02"], email: ["marie@example.com"] }])
    expect(p.match).toMatchObject({ clientId: marie.id, confidence: "SURE" })
    expect(p.changes).toEqual([{ field: "email", from: null, to: "marie@example.com", kind: "fill", checked: true }])

    const many = Array.from({ length: 501 }, (_, i) => ({ name: [`Contact ${i}`] }))
    expect(await previewPickedImport(many)).toHaveLength(500)
  })

  it("sélection vide → erreur", async () => {
    await asNewUser()
    await expect(previewPickedImport([])).rejects.toThrow("Aucun contact sélectionné")
  })

  // BUG mineur (src/lib/contact-import.ts:185-186) — fromPicker remplace un nom vide par
  // « Sans nom » AVANT de filtrer, donc le filtre ne retire jamais rien : des entrées
  // vides donnent des propositions fantômes au lieu de l'erreur « Aucun contact
  // sélectionné » (src/actions/contact-import.ts:35).
  it("une sélection d'entrées vides est refusée", async () => {
    await asNewUser()
    await expect(previewPickedImport([{}, { name: [""], email: [], tel: [] }])).rejects.toThrow("Aucun contact sélectionné")
  })
})

// ── Google Contacts ──────────────────────────────────────────────────────────

describe("previewGoogleEnrichment", () => {
  it("sans compte Google ou avec un seul des deux scopes → NO_SCOPE, aucun appel réseau", async () => {
    const user = await asNewUser()
    stubFetch(() => json({}))
    await expect(previewGoogleEnrichment()).rejects.toThrow("NO_SCOPE")

    await googleAccount(user.id, { scope: "openid https://www.googleapis.com/auth/contacts.readonly" })
    await expect(previewGoogleEnrichment()).rejects.toThrow("NO_SCOPE")
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("scopes accordés mais jeton absent ou expiré sans refresh → erreur d'autorisation", async () => {
    const user = await asNewUser()
    stubFetch(() => json({}))
    await googleAccount(user.id, { access_token: null })
    await expect(previewGoogleEnrichment()).rejects.toThrow("Jeton Google indisponible")

    await prisma.account.updateMany({ where: { userId: user.id }, data: { access_token: "fake-old", expires_at: 1, refresh_token: null } })
    await expect(previewGoogleEnrichment()).rejects.toThrow("Jeton Google indisponible")
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("propose uniquement l'enrichissement des contacts existants (pas de création)", async () => {
    const user = await asNewUser()
    await googleAccount(user.id)
    const jean = await makeClient(user.id, { name: "Jean Test", firstName: "Jean", lastName: "Test", email: "jean.test@example.com" })
    stubFetch((url) => url.includes("/people/me/connections")
      ? json({ connections: [{ resourceName: "people/c1", names: [{ displayName: "Jean Test" }], emailAddresses: [{ value: "jean.test@example.com" }], phoneNumbers: [{ value: "06 00 00 00 03" }] }] })
      : json({ otherContacts: [{ resourceName: "otherContacts/o1", emailAddresses: [{ value: "inconnu@example.org" }] }] }))

    const { proposals, scanned } = await previewGoogleEnrichment()

    expect(scanned).toBe(2)
    expect(proposals).toHaveLength(1)
    expect(proposals[0].match).toMatchObject({ clientId: jean.id, confidence: "SURE" })
    expect(proposals[0].changes).toEqual([{ field: "phone", from: null, to: "+33600000003", kind: "fill", checked: true }])
    for (const [, init] of fetchMock.mock.calls) {
      expect((init as RequestInit).headers).toEqual({ Authorization: "Bearer fake-access-token" })
    }
    expect(await prisma.client.count()).toBe(1)
  })

  it("jeton expiré : rafraîchi via l'endpoint OAuth (mocké) puis persisté", async () => {
    const user = await asNewUser()
    await googleAccount(user.id, { access_token: "fake-old", refresh_token: "fake-refresh", expires_at: 1 })
    stubFetch((url) => url.startsWith("https://oauth2.googleapis.com/token")
      ? json({ access_token: "fake-new", expires_in: 3600 })
      : json({}))

    expect(await getGoogleContactsToken(user.id)).toBe("fake-new")
    const acc = await prisma.account.findFirst({ where: { userId: user.id } })
    expect(acc?.access_token).toBe("fake-new")
    expect(acc?.expires_at).toBeGreaterThan(Math.floor(Date.now() / 1000))
  })
})

describe("google-contacts", () => {
  it("hasContactsScope exige les deux scopes, sur le compte du user uniquement", async () => {
    const owner = await makeUser()
    await googleAccount(owner.id)
    const user = await makeUser()
    expect(await hasContactsScope(owner.id)).toBe(true)
    expect(await hasContactsScope(user.id)).toBe(false)
    await googleAccount(user.id, { scope: "openid https://www.googleapis.com/auth/contacts.other.readonly" })
    expect(await hasContactsScope(user.id)).toBe(false)
  })

  it("getGoogleContactsToken : null si le scope contacts manque", async () => {
    const user = await makeUser()
    await googleAccount(user.id, { scope: "openid https://www.googleapis.com/auth/calendar" })
    expect(await getGoogleContactsToken(user.id)).toBeNull()
  })

  it("fetchGoogleContacts : pagination, normalisation, contacts vides ignorés", async () => {
    stubFetch((url) => {
      const u = new URL(url)
      if (u.pathname.endsWith("/people/me/connections")) {
        if (u.searchParams.get("pageToken") === "p2") {
          return json({ connections: [
            { names: [{ unstructuredName: "Marie Exemple" }], phoneNumbers: [{ value: "pas un numéro" }] },
            { names: [{ givenName: "Paul", familyName: "Exemple" }] },
          ] })
        }
        return json({ nextPageToken: "p2", connections: [
          {
            resourceName: "people/c1",
            names: [{ displayName: "Jean Test", givenName: " Jean ", familyName: " Test " }],
            emailAddresses: [{ value: " Jean.Test@Example.com " }, { value: "jean.test@example.com" }, {}],
            phoneNumbers: [{ value: "06 00 00 00 01", canonicalForm: "+33600000001" }, { value: "06 00 00 00 02" }],
            organizations: [{ name: " Exemple SARL " }],
          },
          { resourceName: "people/vide" },
        ] })
      }
      return json({ otherContacts: [{ resourceName: "otherContacts/o1", emailAddresses: [{ value: "contact@example.org" }] }] })
    })

    const out = await fetchGoogleContacts("fake-token")

    expect(out).toEqual([
      { key: "people/c1", source: "google", name: "Jean Test", firstName: "Jean", lastName: "Test",
        emails: ["jean.test@example.com"], phones: ["+33600000001", "+33600000002"], company: "Exemple SARL" },
      { key: "google:Marie Exemple:", source: "google", name: "Marie Exemple", firstName: undefined, lastName: undefined,
        emails: [], phones: [], company: undefined },
      { key: "google:Paul Exemple:", source: "google", name: "Paul Exemple", firstName: "Paul", lastName: "Exemple",
        emails: [], phones: [], company: undefined },
      { key: "otherContacts/o1", source: "google-other", name: "contact@example.org", firstName: undefined, lastName: undefined,
        emails: ["contact@example.org"], phones: [], company: undefined },
    ])
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it("fetchGoogleContacts : s'arrête à 10 pages par liste", async () => {
    stubFetch((url) => url.includes("/otherContacts")
      ? json({ otherContacts: [] })
      : json({ nextPageToken: "encore", connections: [{ names: [{ displayName: "Boucle" }] }] }))

    const out = await fetchGoogleContacts("fake-token")
    expect(out).toHaveLength(10)
    expect(fetchMock).toHaveBeenCalledTimes(11)
  })

  it.each([
    [429, "Quota Google atteint"],
    [401, "Accès Google refusé"],
    [403, "Accès Google refusé"],
    [500, "Google People API 500"],
  ])("fetchGoogleContacts : HTTP %i → erreur explicite", async (status, message) => {
    stubFetch(() => json({ error: "x" }, status))
    await expect(fetchGoogleContacts("fake-token")).rejects.toThrow(message)
  })
})

// ── Rapprochement manuel ─────────────────────────────────────────────────────

describe("rematchProposal", () => {
  const imported = { key: "k1", source: "vcf" as const, name: "Zoé Inconnue", emails: ["zoe@example.com"], phones: [] }

  it("recalcule le rapprochement vers un contact du user", async () => {
    const user = await asNewUser()
    const paul = await makeClient(user.id, { name: "Paul Exemple" })
    const r = await rematchProposal(imported, paul.id)
    expect(r.match).toMatchObject({ clientId: paul.id, confidence: "DOUBTFUL" })
    expect(r.changes).toEqual([{ field: "email", from: null, to: "zoe@example.com", kind: "fill", checked: false }])
  })

  it("isolation : contact d'autrui → introuvable", async () => {
    const owner = await makeUser()
    const victim = await makeClient(owner.id, { name: "Victime" })
    await asNewUser()
    await expect(rematchProposal(imported, victim.id)).rejects.toThrow("Contact introuvable")
  })
})

// ── Application des décisions ────────────────────────────────────────────────

describe("applyContactImport — enrichissement", () => {
  it("applique les champs autorisés normalisés, ignore les champs interdits et les valeurs invalides", async () => {
    const user = await asNewUser()
    const c = await makeClient(user.id, { type: "PROSPECT", name: "Jean Test", firstName: "Jean", lastName: "Test" })

    const res = await applyContactImport([
      {
        clientId: c.id,
        changes: [
          { field: "email", to: "  Jean.Test@Example.COM " },
          { field: "personalEmail", to: "pas-un-email" },
          { field: "phone", to: "06 00 00 00 04" },
          { field: "userId" as never, to: "pirate" },
          { field: "type" as never, to: "CLIENT" },
        ],
      },
      { clientId: c.id, changes: [{ field: "email", to: "   " }] }, // rien d'applicable → ignoré
    ])

    expect(res).toEqual({ updated: 1, created: 0 })
    expect(await prisma.client.findUnique({ where: { id: c.id } })).toMatchObject({
      userId: user.id, type: "PROSPECT", name: "Jean Test",
      email: "jean.test@example.com", personalEmail: null, phone: "+33600000004",
    })
  })

  it("prénom/nom modifiés → nom d'affichage recalculé (le libellé reste prioritaire)", async () => {
    const user = await asNewUser()
    const plain = await makeClient(user.id, { name: "Jean Test", firstName: "Jean", lastName: "Test" })
    const labelled = await makeClient(user.id, { name: "Le plombier", label: "Le plombier", firstName: "Luc" })

    await applyContactImport([
      { clientId: plain.id, changes: [{ field: "lastName", to: " Exemple " }] },
      { clientId: labelled.id, changes: [{ field: "firstName", to: "Lucas" }] },
    ])

    expect(await prisma.client.findUnique({ where: { id: plain.id } })).toMatchObject({ lastName: "Exemple", name: "Jean Exemple" })
    expect(await prisma.client.findUnique({ where: { id: labelled.id } })).toMatchObject({ firstName: "Lucas", name: "Le plombier" })
  })

  it("isolation : la fiche d'autrui n'est pas modifiée", async () => {
    const owner = await makeUser()
    const victim = await makeClient(owner.id, { name: "Victime", email: "victime@example.com" })
    await asNewUser()

    const res = await applyContactImport([{ clientId: victim.id, changes: [{ field: "email", to: "pirate@example.com" }, { field: "firstName", to: "Pirate" }] }])

    expect(res).toEqual({ updated: 0, created: 0 })
    expect(await prisma.client.findUnique({ where: { id: victim.id } })).toMatchObject({
      name: "Victime", email: "victime@example.com", firstName: null,
    })
  })
})

describe("applyContactImport — création", () => {
  it("crée des contacts « à compléter » normalisés, avec la provenance en note", async () => {
    const user = await asNewUser()

    const res = await applyContactImport([
      { clientId: null, changes: [], create: { firstName: " Zoé ", lastName: " Exemple ", name: "Zoé Exemple", email: " ZOE@Example.com ", phone: "06 00 00 00 05", company: " Exemple SARL ", source: "vcf" } },
      { clientId: null, changes: [], create: { name: "Le fleuriste", phone: "pas un numéro", source: "google" } },
      { clientId: null, changes: [], create: { name: "", company: "Seulement société", source: "picker" } },
      { clientId: null, changes: [] }, // ni cible ni création → ignoré
    ])

    expect(res).toEqual({ updated: 0, created: 3 })
    const rows = await prisma.client.findMany({ where: { userId: user.id }, orderBy: { name: "asc" } })
    expect(rows.map((r) => ({ type: r.type, name: r.name, label: r.label, firstName: r.firstName, email: r.email, phone: r.phone, company: r.company }))).toEqual([
      { type: "TO_COMPLETE", name: "Le fleuriste", label: "Le fleuriste", firstName: null, email: null, phone: "pas un numéro", company: null },
      { type: "TO_COMPLETE", name: "Seulement société", label: null, firstName: null, email: null, phone: null, company: "Seulement société" },
      { type: "TO_COMPLETE", name: "Zoé Exemple", label: null, firstName: "Zoé", email: "zoe@example.com", phone: "+33600000005", company: "Exemple SARL" },
    ])
    expect(rows[0].notes).toMatch(/^Importé depuis Google Contacts le /)
    expect(rows[1].notes).toMatch(/^Importé depuis le carnet du téléphone le /)
    expect(rows[2].notes).toMatch(/^Importé depuis un fichier \.vcf le /)
  })

  it("un contact sans nom ni coordonnées n'est pas créé", async () => {
    const user = await asNewUser()
    const res = await applyContactImport([{ clientId: null, changes: [], create: { name: "  ", email: "invalide", source: "vcf" } }])
    expect(res).toEqual({ updated: 0, created: 0 })
    expect(await prisma.client.count({ where: { userId: user.id } })).toBe(0)
  })
})
