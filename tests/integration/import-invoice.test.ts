import { describe, it, expect } from "vitest"
import { importHistoricalInvoice } from "@/actions/facturation"
import { prisma } from "@/lib/prisma"
import { setTestUser } from "./setup"
import { makeUser, makeClient } from "./helpers/factories"

describe("importHistoricalInvoice", () => {
  it("crée une facture PAID avec paiement associé", async () => {
    const user   = await makeUser()
    const client = await makeClient(user.id)
    setTestUser(user.id)

    const result = await importHistoricalInvoice("ignored", {
      clientId:    client.id,
      date:        "2025-03-15",
      description: "Création site e-commerce",
      amountHT:    3000,
      taxRate:     0,
      isPaid:      true,
      paidAt:      "2025-04-01",
      paidAmount:  3000,
    })

    expect(result.error).toBeUndefined()
    expect(result.id).toBeDefined()

    const inv = await prisma.invoice.findUnique({
      where: { id: result.id! },
      include: { lines: true, payments: true },
    })

    expect(inv?.status).toBe("PAID")
    expect(inv?.type).toBe("STANDALONE")
    expect(inv?.totalHT).toBe(3000)
    expect(inv?.clientId).toBe(client.id)
    expect(inv?.issuedAt?.toISOString()).toBe("2025-03-15T00:00:00.000Z")
    expect(inv?.paidAt?.toISOString()).toBe("2025-04-01T00:00:00.000Z")
    expect(inv?.lines).toHaveLength(1)
    expect(inv?.lines[0].description).toBe("Création site e-commerce")
    expect(inv?.lines[0].taxRate).toBe(0)

    // Un paiement est créé
    expect(inv?.payments).toHaveLength(1)
    expect(inv?.payments[0].amount).toBe(3000)
    expect(inv?.payments[0].paidAt?.toISOString()).toBe("2025-04-01T00:00:00.000Z")
  })

  it("crée une facture SENT (non réglée) sans paiement", async () => {
    const user   = await makeUser()
    const client = await makeClient(user.id)
    setTestUser(user.id)

    const result = await importHistoricalInvoice("ignored", {
      clientId:    client.id,
      date:        "2025-06-01",
      description: "Maintenance trimestrielle",
      amountHT:    600,
      taxRate:     20,
      isPaid:      false,
    })

    expect(result.error).toBeUndefined()

    const inv = await prisma.invoice.findUnique({
      where: { id: result.id! },
      include: { payments: true },
    })

    expect(inv?.status).toBe("SENT")
    expect(inv?.paidAt).toBeNull()
    expect(inv?.payments).toHaveLength(0)
  })

  it("utilise un numéro personnalisé si fourni", async () => {
    const user   = await makeUser()
    const client = await makeClient(user.id)
    setTestUser(user.id)

    const result = await importHistoricalInvoice("ignored", {
      clientId:     client.id,
      customNumber: "FAC-2024-042",
      date:         "2024-11-10",
      description:  "Refonte graphique",
      amountHT:     1200,
      taxRate:      20,
      isPaid:       true,
    })

    expect(result.error).toBeUndefined()
    const inv = await prisma.invoice.findUnique({ where: { id: result.id! } })
    expect(inv?.number).toBe("FAC-2024-042")
  })

  it("génère un numéro automatique si customNumber absent", async () => {
    const user   = await makeUser()
    const client = await makeClient(user.id)
    setTestUser(user.id)

    const result = await importHistoricalInvoice("ignored", {
      clientId:    client.id,
      date:        "2025-01-20",
      description: "Audit SEO",
      amountHT:    800,
      taxRate:     0,
      isPaid:      false,
    })

    const inv = await prisma.invoice.findUnique({ where: { id: result.id! } })
    expect(inv?.number).toBeTruthy()
    expect(inv?.number).not.toBe("")
  })

  it("utilise la date de la facture comme date de paiement si paidAt absent", async () => {
    const user   = await makeUser()
    const client = await makeClient(user.id)
    setTestUser(user.id)

    const result = await importHistoricalInvoice("ignored", {
      clientId:    client.id,
      date:        "2025-09-05",
      description: "Formation",
      amountHT:    500,
      taxRate:     0,
      isPaid:      true,
      // paidAt absent → fallback sur invoiceDate
    })

    const inv = await prisma.invoice.findUnique({ where: { id: result.id! } })
    expect(inv?.paidAt?.toISOString()).toBe("2025-09-05T00:00:00.000Z")
  })

  it("rejette un client manquant", async () => {
    const user = await makeUser()
    setTestUser(user.id)

    const result = await importHistoricalInvoice("ignored", {
      clientId:    "",
      date:        "2025-01-01",
      description: "Test",
      amountHT:    100,
      taxRate:     0,
      isPaid:      false,
    })

    expect(result.error).toBeDefined()
    expect(result.id).toBeUndefined()
  })

  it("rejette un libellé vide", async () => {
    const user   = await makeUser()
    const client = await makeClient(user.id)
    setTestUser(user.id)

    const result = await importHistoricalInvoice("ignored", {
      clientId:    client.id,
      date:        "2025-01-01",
      description: "   ",
      amountHT:    100,
      taxRate:     0,
      isPaid:      false,
    })

    expect(result.error).toMatch(/libellé/i)
  })

  it("rejette un montant invalide (≤ 0)", async () => {
    const user   = await makeUser()
    const client = await makeClient(user.id)
    setTestUser(user.id)

    const result = await importHistoricalInvoice("ignored", {
      clientId:    client.id,
      date:        "2025-01-01",
      description: "Mission X",
      amountHT:    0,
      taxRate:     0,
      isPaid:      false,
    })

    expect(result.error).toMatch(/montant/i)
  })

  it("crée le paiement avec le montant TTC calculé quand paidAmount absent", async () => {
    const user   = await makeUser()
    const client = await makeClient(user.id)
    setTestUser(user.id)

    const result = await importHistoricalInvoice("ignored", {
      clientId:    client.id,
      date:        "2025-07-01",
      description: "Intégration API",
      amountHT:    1000,
      taxRate:     20,
      isPaid:      true,
      // paidAmount absent → doit créer avec TTC = 1000 * 1.20 = 1200
    })

    const inv = await prisma.invoice.findUnique({
      where: { id: result.id! },
      include: { payments: true },
    })
    expect(inv?.payments[0].amount).toBeCloseTo(1200, 2)
  })
})
