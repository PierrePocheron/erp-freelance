import { describe, it, expect } from "vitest"
import {
  createQuoteWithLines,
  createInvoice,
  createInvoiceFromQuote,
  updateQuoteEmitter,
  updateInvoiceEmitter,
  updateQuoteStatus,
} from "@/actions/facturation"
import { createEmitter, setDefaultEmitter } from "@/actions/emitter"
import { prisma } from "@/lib/prisma"
import { setTestUser } from "./setup"
import { makeUser, makeClient } from "./helpers/factories"

// Rattachement de l'émetteur aux documents : pré-renseigné avec l'émetteur par
// défaut à la création, hérité du devis par la facture, modifiable uniquement en
// brouillon, figé au-delà.

describe("émetteur des documents (devis / factures)", () => {
  it("un devis créé est rattaché à l'émetteur par défaut", async () => {
    const user = await makeUser()
    setTestUser(user.id)
    const emitter = await createEmitter({ name: "Pedro" })
    const client = await makeClient(user.id)

    const quote = await createQuoteWithLines(user.id, {
      clientId: client.id,
      lines: [{ description: "Site", quantity: 1, unitPrice: 1000, taxRate: 0 }],
    })
    expect(quote.emitterProfileId).toBe(emitter.id)
  })

  it("sans aucun émetteur configuré, le devis est créé sans émetteur (null)", async () => {
    const user = await makeUser()
    setTestUser(user.id)
    const client = await makeClient(user.id)

    const quote = await createQuoteWithLines(user.id, {
      clientId: client.id,
      lines: [{ description: "Site", quantity: 1, unitPrice: 1000, taxRate: 0 }],
    })
    expect(quote.emitterProfileId).toBeNull()
  })

  it("une facture issue d'un devis hérite de l'émetteur du devis", async () => {
    const user = await makeUser()
    setTestUser(user.id)
    const a = await createEmitter({ name: "A" }) // défaut
    const b = await createEmitter({ name: "B" })
    const client = await makeClient(user.id)

    const quote = await createQuoteWithLines(user.id, {
      clientId: client.id,
      lines: [{ description: "Site", quantity: 1, unitPrice: 1000, taxRate: 0 }],
    })
    // On bascule l'émetteur du devis sur B avant de générer la facture.
    await updateQuoteEmitter(quote.id, b.id)

    const invoice = await createInvoiceFromQuote(quote.id, user.id, "FINAL")
    expect(invoice.emitterProfileId).toBe(b.id)
    expect(a.id).not.toBe(b.id)
  })

  it("createInvoice standalone prend l'émetteur par défaut courant", async () => {
    const user = await makeUser()
    setTestUser(user.id)
    const a = await createEmitter({ name: "A" })
    const b = await createEmitter({ name: "B" })
    await setDefaultEmitter(b.id)
    const client = await makeClient(user.id)

    const invoice = await createInvoice(user.id, { clientId: client.id })
    expect(invoice.emitterProfileId).toBe(b.id)
    expect(a.isDefault).toBe(true) // a était défaut à sa création, b l'est devenu
  })

  it("updateQuoteEmitter refuse un émetteur d'un autre utilisateur", async () => {
    const user = await makeUser()
    const other = await makeUser()
    setTestUser(other.id)
    const foreign = await createEmitter({ name: "Étrangère" })
    setTestUser(user.id)
    const client = await makeClient(user.id)
    const quote = await createQuoteWithLines(user.id, {
      clientId: client.id,
      lines: [{ description: "X", quantity: 1, unitPrice: 100, taxRate: 0 }],
    })

    await expect(updateQuoteEmitter(quote.id, foreign.id)).rejects.toThrow(/introuvable/i)
  })

  it("updateQuoteEmitter est refusé quand le devis n'est plus en brouillon", async () => {
    const user = await makeUser()
    setTestUser(user.id)
    const a = await createEmitter({ name: "A" })
    const b = await createEmitter({ name: "B" })
    const client = await makeClient(user.id)
    const quote = await createQuoteWithLines(user.id, {
      clientId: client.id,
      lines: [{ description: "X", quantity: 1, unitPrice: 100, taxRate: 0 }],
    })
    await updateQuoteStatus(quote.id, user.id, "VALIDATED")

    await expect(updateQuoteEmitter(quote.id, b.id)).rejects.toThrow(/verrouillé/i)
    const after = await prisma.quote.findUnique({ where: { id: quote.id } })
    expect(after?.emitterProfileId).toBe(a.id)
  })

  it("updateInvoiceEmitter est refusé sur une facture émise", async () => {
    const user = await makeUser()
    setTestUser(user.id)
    const a = await createEmitter({ name: "A" })
    const b = await createEmitter({ name: "B" })
    const client = await makeClient(user.id)
    const invoice = await createInvoice(user.id, { clientId: client.id })
    await prisma.invoice.update({ where: { id: invoice.id }, data: { status: "ISSUED" } })

    await expect(updateInvoiceEmitter(invoice.id, b.id)).rejects.toThrow(/verrouillée/i)
    expect(a.isDefault).toBe(true)
  })
})
