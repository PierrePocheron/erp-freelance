import { describe, it, expect } from "vitest"
import {
  createRevenue,
  markRevenueReceived,
  bulkMarkReceived,
  deleteRevenue,
  createRecurringRevenue,
  generateRevenueFromRecurring,
} from "@/actions/revenue"
import { prisma } from "@/lib/prisma"
import { setTestUser } from "./setup"
import { makeUser } from "./helpers/factories"

// ── createRevenue ──────────────────────────────────────────────────────────────

describe("createRevenue", () => {
  it("crée un revenu PENDING avec les champs requis", async () => {
    const user = await makeUser()
    setTestUser(user.id)

    const result = await createRevenue({
      type: "FREELANCE",
      label: "Prestation site vitrine",
      amount: 1500,
      period: "2026-06",
    })

    expect(result.error).toBeUndefined()
    expect(result.id).toBeDefined()

    const rev = await prisma.revenue.findUnique({ where: { id: result.id! } })
    expect(rev?.userId).toBe(user.id)
    expect(rev?.label).toBe("Prestation site vitrine")
    expect(rev?.amount).toBe(1500)
    expect(rev?.status).toBe("PENDING")
    expect(rev?.currency).toBe("EUR")
    expect(rev?.period).toBe("2026-06")
  })

  it("refuse un libellé vide", async () => {
    const user = await makeUser()
    setTestUser(user.id)

    const result = await createRevenue({ type: "FREELANCE", label: "  ", amount: 500 })
    expect(result.error).toMatch(/libellé/i)
    expect(result.id).toBeUndefined()
  })

  it("refuse un montant nul ou négatif", async () => {
    const user = await makeUser()
    setTestUser(user.id)

    const r1 = await createRevenue({ type: "FREELANCE", label: "Test", amount: 0 })
    expect(r1.error).toMatch(/montant/i)

    const r2 = await createRevenue({ type: "FREELANCE", label: "Test", amount: -100 })
    expect(r2.error).toMatch(/montant/i)
  })

  it("crée un revenu RECEIVED avec date de réception", async () => {
    const user = await makeUser()
    setTestUser(user.id)

    const receivedAt = new Date("2026-05-15T00:00:00Z")
    const result = await createRevenue({
      type: "FREELANCE",
      label: "Mission terminée",
      amount: 2000,
      status: "RECEIVED",
      receivedAt,
      paymentMethod: "VIREMENT",
    })

    expect(result.error).toBeUndefined()
    const rev = await prisma.revenue.findUnique({ where: { id: result.id! } })
    expect(rev?.status).toBe("RECEIVED")
    expect(rev?.receivedAt?.toISOString()).toBe("2026-05-15T00:00:00.000Z")
    expect(rev?.paymentMethod).toBe("VIREMENT")
  })

  it("isole les revenus par utilisateur (multi-tenant)", async () => {
    const u1 = await makeUser()
    const u2 = await makeUser()

    setTestUser(u1.id)
    await createRevenue({ type: "FREELANCE", label: "Rev u1", amount: 100 })

    setTestUser(u2.id)
    const revsU2 = await prisma.revenue.findMany({ where: { userId: u2.id } })
    expect(revsU2).toHaveLength(0)
  })
})

// ── markRevenueReceived ────────────────────────────────────────────────────────

describe("markRevenueReceived", () => {
  it("passe un revenu en RECEIVED avec date et moyen de paiement", async () => {
    const user = await makeUser()
    setTestUser(user.id)

    const { id } = await createRevenue({ type: "FREELANCE", label: "À recevoir", amount: 800 })

    const receivedAt = new Date("2026-06-01T00:00:00Z")
    const result = await markRevenueReceived(id!, receivedAt, "CHEQUE")

    expect(result.error).toBeUndefined()
    const rev = await prisma.revenue.findUnique({ where: { id: id! } })
    expect(rev?.status).toBe("RECEIVED")
    expect(rev?.paymentMethod).toBe("CHEQUE")
    expect(rev?.receivedAt?.toISOString()).toBe("2026-06-01T00:00:00.000Z")
  })

  it("renvoie une erreur si le revenu n'appartient pas à l'utilisateur", async () => {
    const owner = await makeUser()
    const intruder = await makeUser()

    setTestUser(owner.id)
    const { id } = await createRevenue({ type: "FREELANCE", label: "Pas à toi", amount: 300 })

    setTestUser(intruder.id)
    const result = await markRevenueReceived(id!, new Date(), "VIREMENT")
    expect(result.error).toBeDefined()
  })
})

// ── bulkMarkReceived ───────────────────────────────────────────────────────────

describe("bulkMarkReceived", () => {
  it("marque plusieurs revenus en RECEIVED en une seule opération", async () => {
    const user = await makeUser()
    setTestUser(user.id)

    const r1 = await createRevenue({ type: "FREELANCE", label: "Rev A", amount: 100 })
    const r2 = await createRevenue({ type: "FREELANCE", label: "Rev B", amount: 200 })
    const r3 = await createRevenue({ type: "FREELANCE", label: "Rev C", amount: 300 })

    const receivedAt = new Date("2026-06-10T00:00:00Z")
    const result = await bulkMarkReceived([r1.id!, r2.id!], receivedAt)

    expect(result.error).toBeUndefined()
    expect(result.count).toBe(2)

    const rows = await prisma.revenue.findMany({ where: { userId: user.id } })
    const received = rows.filter(r => r.status === "RECEIVED")
    const pending  = rows.filter(r => r.status === "PENDING")
    expect(received).toHaveLength(2)
    expect(pending).toHaveLength(1)
    expect(pending[0].id).toBe(r3.id)
  })

  it("renvoie count=0 pour une liste vide", async () => {
    const user = await makeUser()
    setTestUser(user.id)
    const result = await bulkMarkReceived([], new Date())
    expect(result.count).toBe(0)
  })

  it("ignore les IDs d'un autre utilisateur (sécurité multi-tenant)", async () => {
    const owner = await makeUser()
    const intruder = await makeUser()

    setTestUser(owner.id)
    const { id } = await createRevenue({ type: "FREELANCE", label: "Owner rev", amount: 500 })

    setTestUser(intruder.id)
    const result = await bulkMarkReceived([id!], new Date())
    expect(result.error).toBeDefined()

    // Le revenu de l'owner reste PENDING
    const rev = await prisma.revenue.findUnique({ where: { id: id! } })
    expect(rev?.status).toBe("PENDING")
  })
})

// ── deleteRevenue ──────────────────────────────────────────────────────────────

describe("deleteRevenue", () => {
  it("supprime le revenu de l'utilisateur courant", async () => {
    const user = await makeUser()
    setTestUser(user.id)

    const { id } = await createRevenue({ type: "FREELANCE", label: "À supprimer", amount: 100 })
    const result = await deleteRevenue(id!)

    expect(result.error).toBeUndefined()
    const rev = await prisma.revenue.findUnique({ where: { id: id! } })
    expect(rev).toBeNull()
  })

  it("renvoie une erreur si le revenu n'existe pas ou appartient à un autre", async () => {
    const owner    = await makeUser()
    const intruder = await makeUser()

    setTestUser(owner.id)
    const { id } = await createRevenue({ type: "FREELANCE", label: "Protégé", amount: 200 })

    setTestUser(intruder.id)
    const result = await deleteRevenue(id!)
    expect(result.error).toBeDefined()

    // Toujours présent en base
    const rev = await prisma.revenue.findUnique({ where: { id: id! } })
    expect(rev).not.toBeNull()
  })
})

// ── createRecurringRevenue + generateRevenueFromRecurring ──────────────────────

describe("revenus récurrents", () => {
  it("crée un modèle récurrent et génère l'entrée pour un mois donné", async () => {
    const user = await makeUser()
    setTestUser(user.id)

    const rec = await createRecurringRevenue({
      type: "OTHER",
      label: "Maintenance mensuelle",
      amount: 250,
    })
    expect(rec.error).toBeUndefined()
    expect(rec.id).toBeDefined()

    const gen = await generateRevenueFromRecurring(rec.id!, 2026, 6)
    expect(gen.error).toBeUndefined()
    expect(gen.alreadyExists).toBeFalsy()
    expect(gen.id).toBeDefined()

    const rev = await prisma.revenue.findUnique({ where: { id: gen.id! } })
    expect(rev?.amount).toBe(250)
    expect(rev?.period).toBe("2026-06")
    expect(rev?.status).toBe("PENDING")
    expect(rev?.recurringRevenueId).toBe(rec.id)
  })

  it("generateRevenueFromRecurring est idempotent (pas de doublon)", async () => {
    const user = await makeUser()
    setTestUser(user.id)

    const rec = await createRecurringRevenue({ type: "OTHER", label: "SaaS", amount: 99 })

    await generateRevenueFromRecurring(rec.id!, 2026, 5)
    const second = await generateRevenueFromRecurring(rec.id!, 2026, 5)

    expect(second.alreadyExists).toBe(true)
    expect(second.id).toBeDefined()

    const count = await prisma.revenue.count({ where: { recurringRevenueId: rec.id, period: "2026-05" } })
    expect(count).toBe(1)
  })

  it("refuse un libellé vide ou un montant ≤ 0", async () => {
    const user = await makeUser()
    setTestUser(user.id)

    const r1 = await createRecurringRevenue({ type: "OTHER", label: "", amount: 100 })
    expect(r1.error).toMatch(/libellé/i)

    const r2 = await createRecurringRevenue({ type: "OTHER", label: "Ok", amount: -50 })
    expect(r2.error).toMatch(/montant/i)
  })
})
