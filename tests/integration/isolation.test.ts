import { describe, it, expect } from "vitest"
import {
  issueInvoice,
  cancelInvoice,
  deleteInvoice,
  addInvoiceLine,
  updateInvoiceConditions,
  createInvoice,
  createQuoteWithLines,
} from "@/actions/facturation"
import { prisma } from "@/lib/prisma"
import { setTestUser } from "./setup"
import { makeUser, makeClient, makeInvoice, makeProject } from "./helpers/factories"

// Cloisonnement multi-tenant : toutes les actions scoppent par userId (findFirst
// { id, userId }). Un utilisateur ne doit jamais agir sur la facture d'un autre.

describe("cloisonnement multi-tenant", () => {
  it("un utilisateur ne peut pas émettre/annuler la facture d'un autre", async () => {
    const owner = await makeUser()
    const ownerClient = await makeClient(owner.id)
    const invoice = await makeInvoice(owner.id, ownerClient.id, { status: "ISSUED" })

    const intruder = await makeUser()
    setTestUser(intruder.id)

    await expect(issueInvoice(invoice.id, "ignored")).rejects.toThrow(/introuvable/i)
    await expect(cancelInvoice(invoice.id, "ignored")).rejects.toThrow(/introuvable/i)
    await expect(
      addInvoiceLine(invoice.id, "ignored", { description: "x", quantity: 1, unitPrice: 1 })
    ).rejects.toThrow(/introuvable|verrouillée/i)
  })

  it("la suppression par un intrus n'affecte pas la facture de l'owner", async () => {
    const owner = await makeUser()
    const ownerClient = await makeClient(owner.id)
    const invoice = await makeInvoice(owner.id, ownerClient.id, { status: "DRAFT" })

    const intruder = await makeUser()
    setTestUser(intruder.id)

    // deleteInvoice scoppe par userId → la ligne de l'owner reste intacte.
    await expect(deleteInvoice(invoice.id, "ignored")).rejects.toThrow()
    const still = await prisma.invoice.findUnique({ where: { id: invoice.id } })
    expect(still).not.toBeNull()
  })

  it("l'owner garde la main sur sa propre facture", async () => {
    const owner = await makeUser()
    const ownerClient = await makeClient(owner.id)
    const invoice = await makeInvoice(owner.id, ownerClient.id, { status: "DRAFT" })
    setTestUser(owner.id)

    await expect(updateInvoiceConditions(invoice.id, "ignored", "CGV")).resolves.not.toThrow()
    const after = await prisma.invoice.findUnique({ where: { id: invoice.id } })
    expect(after?.generalConditions).toBe("CGV")
  })

  it("on ne peut pas créer un document sur le contact d'un autre utilisateur", async () => {
    const victim = await makeUser()
    const victimClient = await makeClient(victim.id, { name: "Client Privé" })
    const victimProject = await makeProject(victim.id, victimClient.id, "Projet privé")

    const intruder = await makeUser()
    setTestUser(intruder.id)
    const ownClient = await makeClient(intruder.id, { name: "Mon client" })

    // Le document appartiendrait à l'intrus, mais afficherait — page ET PDF — la
    // fiche complète du contact de la victime.
    await expect(createInvoice("ignored", { clientId: victimClient.id })).rejects.toThrow(/introuvable/i)
    await expect(
      createQuoteWithLines("ignored", {
        clientId: victimClient.id,
        lines: [{ description: "X", quantity: 1, unitPrice: 10, taxRate: 0 }],
      }),
    ).rejects.toThrow(/introuvable/i)
    // Même refus pour un projet d'un autre compte rattaché à son propre contact.
    await expect(
      createInvoice("ignored", { clientId: ownClient.id, projectId: victimProject.id }),
    ).rejects.toThrow(/introuvable/i)

    expect(await prisma.invoice.count({ where: { clientId: victimClient.id } })).toBe(0)
    expect(await prisma.quote.count({ where: { clientId: victimClient.id } })).toBe(0)
    expect(await prisma.invoice.count({ where: { projectId: victimProject.id } })).toBe(0)
  })
})
