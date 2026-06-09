import { describe, it, expect } from "vitest"
import { createInvoiceFromRenewal } from "@/actions/facturation"
import { prisma } from "@/lib/prisma"
import { setTestUser } from "./setup"
import { makeUser, makeClient, makeRenewalChain, makeConditionsTemplate } from "./helpers/factories"

describe("facturation d'un renouvellement", () => {
  it("crée une facture RECURRING en brouillon avec la clause adaptée et avance l'échéance", async () => {
    const user = await makeUser()
    const client = await makeClient(user.id)
    await makeConditionsTemplate(user.id, {
      name: "Reconduction hébergement",
      content: "Tacite reconduction annuelle.",
    })
    const { renewal } = await makeRenewalChain(user.id, client.id, {
      type: "HOSTING",
      name: "Hébergement annuel",
      amount: 120,
      periodMonths: 12,
      expiresAt: new Date("2026-07-01T00:00:00Z"),
    })
    setTestUser(user.id)

    const created = await createInvoiceFromRenewal(renewal.id, "ignored")
    const inv = await prisma.invoice.findUnique({ where: { id: created.id }, include: { lines: true } })

    expect(inv?.type).toBe("RECURRING")
    expect(inv?.status).toBe("DRAFT")
    expect(inv?.totalHT).toBe(120)
    expect(inv?.lines).toHaveLength(1)
    expect(inv?.lines[0].description).toBe("Hébergement annuel (12 mois)")
    expect(inv?.generalConditions).toBe("Tacite reconduction annuelle.")

    // L'échéance du renouvellement avance de 12 mois et les rappels sont réarmés.
    const after = await prisma.renewal.findUnique({ where: { id: renewal.id } })
    expect(after?.expiresAt.toISOString()).toBe("2027-07-01T00:00:00.000Z")
    expect(after?.reminderSent30).toBe(false)
    expect(after?.reminderSent7).toBe(false)
  })

  it("refuse de facturer un renouvellement sans montant", async () => {
    const user = await makeUser()
    const client = await makeClient(user.id)
    const { renewal } = await makeRenewalChain(user.id, client.id, { amount: null })
    setTestUser(user.id)

    await expect(createInvoiceFromRenewal(renewal.id, "ignored")).rejects.toThrow(/montant/i)
  })

  it("retombe sur la condition par défaut quand aucun libellé ne correspond", async () => {
    const user = await makeUser()
    const client = await makeClient(user.id)
    await makeConditionsTemplate(user.id, {
      name: "Mentions génériques",
      content: "Conditions par défaut.",
      isDefault: true,
    })
    const { renewal } = await makeRenewalChain(user.id, client.id, {
      type: "DOMAIN",
      name: "nom-de-domaine.fr",
      amount: 15,
      periodMonths: 12,
    })
    setTestUser(user.id)

    const created = await createInvoiceFromRenewal(renewal.id, "ignored")
    const inv = await prisma.invoice.findUnique({ where: { id: created.id } })
    expect(inv?.generalConditions).toBe("Conditions par défaut.")
  })
})
