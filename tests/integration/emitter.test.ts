import { describe, it, expect } from "vitest"
import {
  createEmitter,
  updateEmitter,
  deleteEmitter,
  setDefaultEmitter,
  listEmitters,
  getDefaultEmitterId,
} from "@/actions/emitter"
import { prisma } from "@/lib/prisma"
import { setTestUser } from "./setup"
import { makeUser, makeClient, makeQuote, makeInvoice } from "./helpers/factories"

// Profils émetteurs multi-société : N par user, un seul par défaut, rattachés
// aux devis/factures via emitterProfileId (FK SET NULL à la suppression).

describe("profils émetteurs (mes sociétés)", () => {
  it("le premier profil créé devient par défaut, les suivants non", async () => {
    const user = await makeUser()
    setTestUser(user.id)

    const first = await createEmitter({ name: "Pedro Agency" })
    expect(first.isDefault).toBe(true)

    const second = await createEmitter({ name: "Autre Société" })
    expect(second.isDefault).toBe(false)
  })

  it("normalise les champs (trim, vide → null, valeurs par défaut)", async () => {
    const user = await makeUser()
    setTestUser(user.id)

    const e = await createEmitter({
      name: "  Pedro  ",
      siret: "  123  ",
      city: "   ",
      country: "  ",
      pdfAccentColor: "  ",
    })
    expect(e.name).toBe("Pedro")
    expect(e.siret).toBe("123")
    expect(e.city).toBeNull()
    expect(e.country).toBe("France")
    expect(e.pdfAccentColor).toBe("#6366f1")
  })

  it("createEmitter exige un nom", async () => {
    const user = await makeUser()
    setTestUser(user.id)
    await expect(createEmitter({ name: "   " })).rejects.toThrow(/nom/i)
  })

  it("setDefaultEmitter bascule le défaut de façon exclusive", async () => {
    const user = await makeUser()
    setTestUser(user.id)
    const a = await createEmitter({ name: "A" })
    const b = await createEmitter({ name: "B" })
    expect(a.isDefault).toBe(true)

    await setDefaultEmitter(b.id)

    const reloaded = await listEmitters()
    const map = new Map(reloaded.map((e) => [e.id, e.isDefault]))
    expect(map.get(a.id)).toBe(false)
    expect(map.get(b.id)).toBe(true)
  })

  it("getDefaultEmitterId retourne le défaut, sinon le premier disponible", async () => {
    const user = await makeUser()
    setTestUser(user.id)
    expect(await getDefaultEmitterId(user.id)).toBeNull()

    const a = await createEmitter({ name: "A" })
    expect(await getDefaultEmitterId(user.id)).toBe(a.id)
  })

  it("updateEmitter modifie les champs sans toucher au nom si vide", async () => {
    const user = await makeUser()
    setTestUser(user.id)
    const e = await createEmitter({ name: "Pedro", city: "Paris" })

    await updateEmitter(e.id, { name: "  ", city: "Lyon" })
    const after = await prisma.emitterProfile.findUnique({ where: { id: e.id } })
    expect(after?.name).toBe("Pedro")
    expect(after?.city).toBe("Lyon")
  })

  it("deleteEmitter détache devis/factures (emitterProfileId → null) sans les supprimer", async () => {
    const user = await makeUser()
    setTestUser(user.id)
    const emitter = await createEmitter({ name: "Pedro" })
    const client = await makeClient(user.id)
    const quote = await makeQuote(user.id, client.id, { number: "DEV-X1" })
    const invoice = await makeInvoice(user.id, client.id, { number: "FAC-X1" })
    await prisma.quote.update({ where: { id: quote.id }, data: { emitterProfileId: emitter.id } })
    await prisma.invoice.update({ where: { id: invoice.id }, data: { emitterProfileId: emitter.id } })

    await deleteEmitter(emitter.id)

    expect(await prisma.emitterProfile.findUnique({ where: { id: emitter.id } })).toBeNull()
    expect((await prisma.quote.findUnique({ where: { id: quote.id } }))?.emitterProfileId).toBeNull()
    expect((await prisma.invoice.findUnique({ where: { id: invoice.id } }))?.emitterProfileId).toBeNull()
  })

  it("supprimer le profil par défaut promeut le plus ancien restant", async () => {
    const user = await makeUser()
    setTestUser(user.id)
    const a = await createEmitter({ name: "A" }) // défaut
    const b = await createEmitter({ name: "B" })

    await deleteEmitter(a.id)
    const after = await prisma.emitterProfile.findUnique({ where: { id: b.id } })
    expect(after?.isDefault).toBe(true)
  })

  it("listEmitters isole par utilisateur", async () => {
    const user = await makeUser()
    const other = await makeUser()
    setTestUser(other.id)
    await createEmitter({ name: "Société autre" })
    setTestUser(user.id)
    await createEmitter({ name: "Ma société" })

    const mine = await listEmitters()
    expect(mine).toHaveLength(1)
    expect(mine[0].name).toBe("Ma société")
  })
})
