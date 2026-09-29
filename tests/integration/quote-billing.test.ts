import { describe, it, expect } from "vitest"
import { createInvoiceFromQuote, recordPayment, deletePayment } from "@/actions/facturation"
import { prisma } from "@/lib/prisma"
import { setTestUser } from "./setup"
import { makeUser, makeClient, makeQuote, makeInvoice } from "./helpers/factories"

describe("paiements", () => {
  it("supprimer le dernier paiement dé-solde la facture", async () => {
    const user = await makeUser()
    const client = await makeClient(user.id)
    const invoice = await makeInvoice(user.id, client.id, { status: "SENT", totalHT: 1000, depositDeducted: 0 })
    setTestUser(user.id)

    await recordPayment(invoice.id, "ignored", { amount: 1000, paidAt: "2026-06-01" })
    expect((await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } })).status).toBe("PAID")

    const payment = await prisma.payment.findFirstOrThrow({ where: { invoiceId: invoice.id } })
    await deletePayment(payment.id, invoice.id, "ignored")

    // Sans ça, la facture restait PAID sans aucun paiement : CA fantôme dans le
    // dashboard, les graphes mensuels, et ligne pré-cochée dans l'assiette URSSAF.
    const after = await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } })
    expect(after.status).not.toBe("PAID")
    expect(after.paidAt).toBeNull()
  })

  it("supprimer un paiement partiel laisse la facture non soldée sans la rouvrir à tort", async () => {
    const user = await makeUser()
    const client = await makeClient(user.id)
    const invoice = await makeInvoice(user.id, client.id, { status: "SENT", totalHT: 1000, depositDeducted: 0 })
    setTestUser(user.id)

    await recordPayment(invoice.id, "ignored", { amount: 400, paidAt: "2026-06-01" })
    await recordPayment(invoice.id, "ignored", { amount: 600, paidAt: "2026-06-02" })
    expect((await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } })).status).toBe("PAID")

    const first = await prisma.payment.findFirstOrThrow({ where: { invoiceId: invoice.id, amount: 400 } })
    await deletePayment(first.id, invoice.id, "ignored")

    const after = await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } })
    expect(after.status).toBe("SENT")
    expect(await prisma.payment.count({ where: { invoiceId: invoice.id } })).toBe(1)
  })
})

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

  // Régression : chaque ligne du devis recevait le montant TOTAL de l'acompte.
  it("acompte depuis un devis MULTI-LIGNES : une ligne unique au montant de l'acompte", async () => {
    const user = await makeUser()
    const client = await makeClient(user.id)
    const quote = await makeQuote(user.id, client.id, {
      depositPercent: 30,
      lines: [
        { description: "Conception", quantity: 1, unitPrice: 1000, taxRate: 0 },
        { description: "Développement", quantity: 1, unitPrice: 2000, taxRate: 0 },
        { description: "Recette", quantity: 1, unitPrice: 3000, taxRate: 0 },
      ],
    })
    setTestUser(user.id)

    const deposit = await createInvoiceFromQuote(quote.id, "ignored", "DEPOSIT")
    const full = await prisma.invoice.findUniqueOrThrow({ where: { id: deposit.id }, include: { lines: true } })

    expect(full.totalHT).toBe(1800)
    expect(full.lines).toHaveLength(1)
    expect(full.lines[0].total).toBe(1800)
    // La somme des lignes doit égaler le total : sinon le PDF affiche 3 × 1 800 €
    // sous un « TOTAL HT : 1 800 € », et toute retouche recalcule totalHT à 5 400.
    expect(full.lines.reduce((s, l) => s + l.total, 0)).toBe(full.totalHT)
    expect(full.lines[0].description).toContain("Acompte 30 %")
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

    await prisma.invoice.update({ where: { id: final.id }, data: { status: "ISSUED" } }) // paiement = facture émise
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

    await prisma.invoice.update({ where: { id: final.id }, data: { status: "ISSUED" } }) // paiement = facture émise
    await recordPayment(final.id, "ignored", { amount: 400, paidAt: "2026-06-01T00:00:00Z" })
    const after = await prisma.invoice.findUnique({ where: { id: final.id } })
    expect(after?.status).not.toBe("PAID")
  })
})
