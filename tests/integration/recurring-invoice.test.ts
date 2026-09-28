import { describe, it, expect } from "vitest"
import {
  createRecurringInvoice,
  setRecurringInvoiceLines,
  generateInvoiceFromRecurring,
} from "@/actions/facturation"
import { prisma } from "@/lib/prisma"
import { setTestUser } from "./setup"
import { makeUser, makeClient } from "./helpers/factories"

// Tout ce chemin passe par du SQL BRUT sur `RecurringInvoiceLine` et par des
// casts `as never` sur `recurringInvoice` : le typage TypeScript n'y voit rien.
// Un renommage de colonne ne casserait aucune compilation — juste une facture à
// 0 € en silence. (C'est cette table qui manquait en production jusqu'au 23/09.)

describe("factures récurrentes", () => {
  it("génère une facture dont le total vient des lignes du modèle, puis avance l'échéance", async () => {
    const user = await makeUser()
    const client = await makeClient(user.id)
    setTestUser(user.id)

    const rec = await createRecurringInvoice("ignored", {
      clientId: client.id, name: "Maintenance", frequency: "MONTHLY", nextGenerationDate: "2026-07-01",
    })
    await setRecurringInvoiceLines(rec.id, "ignored", [
      { description: "Maintenance", quantity: 1, unitPrice: 200, taxRate: 0 },
      { description: "Support", quantity: 2, unitPrice: 50, taxRate: 0 },
    ])

    const generated = await generateInvoiceFromRecurring(rec.id, "ignored")
    const invoice = await prisma.invoice.findUniqueOrThrow({
      where: { id: generated.id }, include: { lines: true },
    })

    expect(invoice.type).toBe("RECURRING")
    expect(invoice.status).toBe("DRAFT")
    expect(invoice.totalHT).toBe(300)
    expect(invoice.lines).toHaveLength(2)
    expect(invoice.depositDeducted).toBe(0)

    const [row] = await prisma.$queryRawUnsafe<{ nextGenerationDate: Date; totalHT: number }[]>(
      'SELECT "nextGenerationDate", "totalHT" FROM "RecurringInvoice" WHERE id = $1', rec.id,
    )
    expect([row.nextGenerationDate.getMonth(), row.nextGenerationDate.getDate()]).toEqual([7, 1]) // 1er août
    expect(Number(row.totalHT)).toBe(300)
  })

  it("remplace les lignes sans en laisser d'orphelines", async () => {
    const user = await makeUser()
    const client = await makeClient(user.id)
    setTestUser(user.id)
    const rec = await createRecurringInvoice("ignored", {
      clientId: client.id, name: "Hébergement", frequency: "YEARLY", nextGenerationDate: "2026-09-01",
    })

    await setRecurringInvoiceLines(rec.id, "ignored", [
      { description: "A", quantity: 1, unitPrice: 100, taxRate: 0 },
      { description: "B", quantity: 1, unitPrice: 100, taxRate: 0 },
    ])
    await setRecurringInvoiceLines(rec.id, "ignored", [
      { description: "C", quantity: 3, unitPrice: 30, taxRate: 0 },
    ])

    const lines = await prisma.$queryRawUnsafe<{ description: string; total: number }[]>(
      'SELECT description, total FROM "RecurringInvoiceLine" WHERE "recurringInvoiceId" = $1', rec.id,
    )
    expect(lines).toHaveLength(1)
    expect(lines[0].description).toBe("C")
    expect(Number(lines[0].total)).toBe(90)
  })

  it("refuse le modèle récurrent d'un autre compte (anti-IDOR)", async () => {
    const victim = await makeUser()
    const victimClient = await makeClient(victim.id)
    setTestUser(victim.id)
    const rec = await createRecurringInvoice("ignored", {
      clientId: victimClient.id, name: "Privé", frequency: "MONTHLY", nextGenerationDate: "2026-07-01",
    })
    await setRecurringInvoiceLines(rec.id, "ignored", [{ description: "A", quantity: 1, unitPrice: 100, taxRate: 0 }])

    const intruder = await makeUser()
    setTestUser(intruder.id)

    await expect(generateInvoiceFromRecurring(rec.id, "ignored")).rejects.toThrow(/introuvable/i)
    await expect(
      setRecurringInvoiceLines(rec.id, "ignored", [{ description: "pwned", quantity: 1, unitPrice: 1, taxRate: 0 }]),
    ).rejects.toThrow()

    const lines = await prisma.$queryRawUnsafe<{ description: string }[]>(
      'SELECT description FROM "RecurringInvoiceLine" WHERE "recurringInvoiceId" = $1', rec.id,
    )
    expect(lines.map((l) => l.description)).toEqual(["A"])
    expect(await prisma.invoice.count({ where: { userId: intruder.id } })).toBe(0)
  })
})
