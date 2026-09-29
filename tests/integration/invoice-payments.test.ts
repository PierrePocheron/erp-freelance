import { describe, it, expect } from "vitest"
import { markInvoicePaid, recordPayment, updateInvoiceStatus } from "@/actions/facturation"
import { prisma } from "@/lib/prisma"
import { zonedDateKey } from "@/lib/dates"
import { setTestUser } from "./setup"
import { makeUser, makeClient, makeQuote, makeInvoice } from "./helpers/factories"

async function owner() {
  const user = await makeUser()
  const client = await makeClient(user.id)
  setTestUser(user.id)
  return { user, client }
}

describe("marquer une facture payée (#20)", () => {
  it("enregistre un paiement du reste dû à la date donnée", async () => {
    const { user, client } = await owner()
    const i = await makeInvoice(user.id, client.id, { status: "ISSUED", totalHT: 1000, depositDeducted: 200 })
    await recordPayment(i.id, "ignored", { amount: 300, paidAt: "2026-06-01" })

    await markInvoicePaid(i.id, "ignored", "2026-06-28")

    const saved = await prisma.invoice.findUniqueOrThrow({ where: { id: i.id }, include: { payments: true } })
    expect(saved.status).toBe("PAID")
    expect(saved.payments.map((p) => p.amount).sort((a, b) => a - b)).toEqual([300, 500])
    // Date d'encaissement réelle (elle fixe la période URSSAF), pas celle du clic
    expect(zonedDateKey(saved.paidAt!)).toBe("2026-06-28")
  })

  it("updateInvoiceStatus(PAID) passe par le même chemin (tableau de bord, graphe)", async () => {
    const { user, client } = await owner()
    const i = await makeInvoice(user.id, client.id, { status: "SENT", totalHT: 400 })
    await updateInvoiceStatus(i.id, "ignored", "PAID")
    const saved = await prisma.invoice.findUniqueOrThrow({ where: { id: i.id }, include: { payments: true } })
    expect(saved.status).toBe("PAID")
    expect(saved.payments).toHaveLength(1)
    expect(saved.payments[0].amount).toBe(400)
  })

  it("refuse un brouillon et une facture annulée", async () => {
    const { user, client } = await owner()
    const draft = await makeInvoice(user.id, client.id, { status: "DRAFT", totalHT: 100 })
    const cancelled = await makeInvoice(user.id, client.id, { status: "CANCELLED", totalHT: 100 })
    await expect(markInvoicePaid(draft.id, "ignored")).rejects.toThrow()
    await expect(recordPayment(cancelled.id, "ignored", { amount: 100, paidAt: "2026-06-01" })).rejects.toThrow()
    expect(await prisma.payment.count()).toBe(0)
  })

  it("n'agit pas sur la facture d'un autre compte", async () => {
    const victim = await makeUser()
    const vClient = await makeClient(victim.id)
    const theirs = await makeInvoice(victim.id, vClient.id, { status: "SENT", totalHT: 100 })
    await owner()
    await expect(markInvoicePaid(theirs.id, "ignored")).rejects.toThrow()
    expect((await prisma.invoice.findUniqueOrThrow({ where: { id: theirs.id } })).status).toBe("SENT")
  })
})

describe("acompte encaissé → devis « acompte reçu »", () => {
  it("solder la facture d'acompte fait passer le devis de WAITING_DEPOSIT à DEPOSIT_RECEIVED", async () => {
    const { user, client } = await owner()
    const q = await makeQuote(user.id, client.id, { depositPercent: 30, lines: [{ description: "Site", quantity: 1, unitPrice: 1000 }] })
    await prisma.quote.update({ where: { id: q.id }, data: { status: "WAITING_DEPOSIT" } })
    const dep = await makeInvoice(user.id, client.id, { type: "DEPOSIT", status: "ISSUED", totalHT: 300, quoteId: q.id })

    await recordPayment(dep.id, "ignored", { amount: 100, paidAt: "2026-06-01" })
    expect((await prisma.quote.findUniqueOrThrow({ where: { id: q.id } })).status).toBe("WAITING_DEPOSIT")

    await recordPayment(dep.id, "ignored", { amount: 200, paidAt: "2026-06-03" })
    expect((await prisma.quote.findUniqueOrThrow({ where: { id: q.id } })).status).toBe("DEPOSIT_RECEIVED")
  })
})
