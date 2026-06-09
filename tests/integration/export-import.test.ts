import { describe, it, expect } from "vitest"
import { exportAllData } from "@/actions/export"
import { importData } from "@/actions/import-data"
import { prisma } from "@/lib/prisma"
import { setTestUser } from "./setup"
import { makeUser, makeClient, makeProject, makeQuote, makeInvoice } from "./helpers/factories"

describe("export → import (aller-retour)", () => {
  it("restaure fidèlement les données de facturation après une purge", async () => {
    const userId = "roundtrip-user"
    await makeUser(userId)
    const client = await makeClient(userId, { name: "Client Export" })
    await prisma.product.create({
      data: { userId, name: "Forfait", unitPrice: 500, unit: "FLAT", billingType: "ONE_SHOT" },
    })
    const project = await makeProject(userId, client.id, "Refonte")
    const quote = await makeQuote(userId, client.id, {
      projectId: project.id,
      depositPercent: 30,
      lines: [
        { description: "Conception", quantity: 1, unitPrice: 1000, taxRate: 20 },
        { description: "Intégration", quantity: 2, unitPrice: 500, taxRate: 20 },
      ],
    })
    const invoice = await makeInvoice(userId, client.id, {
      quoteId: quote.id,
      type: "FINAL",
      totalHT: 2000,
      depositDeducted: 600,
      lines: [{ description: "Solde", quantity: 1, unitPrice: 2000, taxRate: 20 }],
    })
    await prisma.payment.create({
      data: { invoiceId: invoice.id, amount: 1400, paidAt: new Date("2026-06-01T00:00:00Z") },
    })

    setTestUser(userId)
    const json = await exportAllData()
    const payload = JSON.parse(json)
    expect(payload.data.clients).toHaveLength(1)
    expect(payload.data.quoteLines).toHaveLength(2)

    // Purge complète puis recréation de l'utilisateur (id identique) → base vide.
    await prisma.user.delete({ where: { id: userId } })
    await makeUser(userId)

    setTestUser(userId)
    const result = await importData(json)
    expect(result.success).toBe(true)

    // Les entités sont restaurées avec leurs identifiants et montants d'origine.
    expect(await prisma.client.count({ where: { userId } })).toBe(1)
    expect(await prisma.product.count({ where: { userId } })).toBe(1)
    expect(await prisma.project.count({ where: { userId } })).toBe(1)

    const restoredQuote = await prisma.quote.findUnique({ where: { id: quote.id }, include: { lines: true } })
    expect(restoredQuote?.totalHT).toBe(2000)
    expect(restoredQuote?.depositPercent).toBe(30)
    expect(restoredQuote?.lines).toHaveLength(2)

    const restoredInvoice = await prisma.invoice.findUnique({
      where: { id: invoice.id },
      include: { lines: true, payments: true },
    })
    expect(restoredInvoice?.totalHT).toBe(2000)
    expect(restoredInvoice?.depositDeducted).toBe(600)
    expect(restoredInvoice?.lines).toHaveLength(1)
    expect(restoredInvoice?.payments).toHaveLength(1)
    expect(restoredInvoice?.payments[0].amount).toBe(1400)
  })

  it("rejette un fichier au format inconnu", async () => {
    await makeUser("fmt-user")
    setTestUser("fmt-user")
    const bad = await importData(JSON.stringify({ foo: "bar" }))
    expect(bad.success).toBe(false)
    expect(bad.error).toMatch(/format invalide/i)
  })
})
