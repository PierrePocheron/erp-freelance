import { describe, it, expect } from "vitest"
import { createInvoiceFromQuote, recordPayment } from "@/actions/facturation"
import { prisma } from "@/lib/prisma"
import { setTestUser } from "./setup"
import { makeUser, makeClient, makeQuote } from "./helpers/factories"

describe("facturation depuis un devis (acompte → solde)", () => {
  it("facture d'acompte : totalHT = % du devis, une seule ligne", async () => {
    const user = await makeUser()
    const client = await makeClient(user.id)
    const quote = await makeQuote(user.id, client.id, {
      depositPercent: 30,
      generalConditions: "CGV du devis",
      lines: [{ description: "Prestation", quantity: 1, unitPrice: 1000, taxRate: 20 }],
    })
    setTestUser(user.id)

    const deposit = await createInvoiceFromQuote(quote.id, "ignored", "DEPOSIT")
    const full = await prisma.invoice.findUnique({ where: { id: deposit.id }, include: { lines: true } })

    expect(full?.type).toBe("DEPOSIT")
    expect(full?.totalHT).toBe(300)
    expect(full?.lines).toHaveLength(1)
    expect(full?.generalConditions).toBe("CGV du devis") // conditions reprises du devis
  })

  it("facture de solde : déduit les acomptes réellement facturés", async () => {
    const user = await makeUser()
    const client = await makeClient(user.id)
    const quote = await makeQuote(user.id, client.id, {
      depositPercent: 30,
      lines: [{ description: "Prestation", quantity: 1, unitPrice: 1000, taxRate: 20 }],
    })
    setTestUser(user.id)

    await createInvoiceFromQuote(quote.id, "ignored", "DEPOSIT") // 300 facturé
    const final = await createInvoiceFromQuote(quote.id, "ignored", "FINAL")
    const full = await prisma.invoice.findUnique({ where: { id: final.id } })

    expect(full?.type).toBe("FINAL")
    expect(full?.totalHT).toBe(1000)
    expect(full?.depositDeducted).toBe(300) // acompte réel déduit
  })

  it("facture de solde sans acompte émis : retombe sur le % du devis", async () => {
    const user = await makeUser()
    const client = await makeClient(user.id)
    const quote = await makeQuote(user.id, client.id, {
      depositPercent: 25,
      lines: [{ description: "Prestation", quantity: 1, unitPrice: 2000, taxRate: 0 }],
    })
    setTestUser(user.id)

    const final = await createInvoiceFromQuote(quote.id, "ignored", "FINAL")
    const full = await prisma.invoice.findUnique({ where: { id: final.id } })
    expect(full?.depositDeducted).toBe(500) // 25% de 2000
  })

  it("un acompte annulé n'est pas déduit (fallback sur le %)", async () => {
    const user = await makeUser()
    const client = await makeClient(user.id)
    const quote = await makeQuote(user.id, client.id, {
      depositPercent: 30,
      lines: [{ description: "Prestation", quantity: 1, unitPrice: 1000, taxRate: 20 }],
    })
    setTestUser(user.id)

    const deposit = await createInvoiceFromQuote(quote.id, "ignored", "DEPOSIT")
    await prisma.invoice.update({ where: { id: deposit.id }, data: { status: "CANCELLED" } })

    const final = await createInvoiceFromQuote(quote.id, "ignored", "FINAL")
    const full = await prisma.invoice.findUnique({ where: { id: final.id } })
    // L'acompte annulé est ignoré → on retombe sur 30% de 1000.
    expect(full?.depositDeducted).toBe(300)
  })

  it("enregistre un paiement et solde la facture quand le net est couvert", async () => {
    const user = await makeUser()
    const client = await makeClient(user.id)
    const quote = await makeQuote(user.id, client.id, {
      depositPercent: 30,
      lines: [{ description: "Prestation", quantity: 1, unitPrice: 1000, taxRate: 0 }],
    })
    setTestUser(user.id)

    await createInvoiceFromQuote(quote.id, "ignored", "DEPOSIT")
    const final = await createInvoiceFromQuote(quote.id, "ignored", "FINAL") // net = 700

    await recordPayment(final.id, "ignored", { amount: 700, paidAt: "2026-06-01T00:00:00Z" })
    const after = await prisma.invoice.findUnique({ where: { id: final.id } })
    expect(after?.status).toBe("PAID")
    expect(after?.paidAt).not.toBeNull()
  })

  it("ne solde pas une facture partiellement payée", async () => {
    const user = await makeUser()
    const client = await makeClient(user.id)
    const quote = await makeQuote(user.id, client.id, {
      lines: [{ description: "Prestation", quantity: 1, unitPrice: 1000, taxRate: 0 }],
    })
    setTestUser(user.id)
    const final = await createInvoiceFromQuote(quote.id, "ignored", "FINAL") // net = 1000

    await recordPayment(final.id, "ignored", { amount: 400, paidAt: "2026-06-01T00:00:00Z" })
    const after = await prisma.invoice.findUnique({ where: { id: final.id } })
    expect(after?.status).not.toBe("PAID")
  })
})
