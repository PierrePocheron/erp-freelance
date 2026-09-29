import { describe, it, expect } from "vitest"
import { createRecurringRevenue, updateRecurringRevenue, generateRevenueFromRecurring, generatePendingRecurringRevenues } from "@/actions/revenue"
import { prisma } from "@/lib/prisma"
import { setTestUser } from "./setup"
import { makeUser, makeClient } from "./helpers/factories"

async function source(userId: string, name = "AE") {
  return prisma.fiscalSource.create({ data: { userId, name, bucket: "AE_URSSAF", color: "#000" } })
}

describe("revenus récurrents : source fiscale (#37)", () => {
  it("le modèle porte sa source fiscale et chaque revenu généré en hérite (avec contact)", async () => {
    const user = await makeUser()
    setTestUser(user.id)
    const src = await source(user.id)
    const client = await makeClient(user.id)
    const res = await createRecurringRevenue({ type: "OTHER", label: "Mission", amount: 800, fiscalSourceId: src.id, clientId: client.id })
    expect(res.error).toBeUndefined()

    await generateRevenueFromRecurring(res.id!, 2026, 3)
    await generatePendingRecurringRevenues()

    const revenues = await prisma.revenue.findMany({ where: { recurringRevenueId: res.id } })
    expect(revenues.length).toBeGreaterThan(0)
    expect(revenues.every((r) => r.fiscalSourceId === src.id && r.clientId === client.id)).toBe(true)
  })

  it("refuse la source fiscale ou le contact d'un autre compte", async () => {
    const victim = await makeUser()
    const foreignSrc = await source(victim.id, "Autre")
    const foreignClient = await makeClient(victim.id)
    const user = await makeUser()
    setTestUser(user.id)

    expect((await createRecurringRevenue({ type: "OTHER", label: "X", amount: 10, fiscalSourceId: foreignSrc.id })).error).toMatch(/introuvable/)
    expect((await createRecurringRevenue({ type: "OTHER", label: "X", amount: 10, clientId: foreignClient.id })).error).toMatch(/introuvable/)

    const ok = await createRecurringRevenue({ type: "OTHER", label: "X", amount: 10 })
    expect((await updateRecurringRevenue(ok.id!, { fiscalSourceId: foreignSrc.id })).error).toMatch(/introuvable/)
    expect((await prisma.recurringRevenue.findUniqueOrThrow({ where: { id: ok.id } })).fiscalSourceId).toBeNull()
  })
})

describe("source ajoutée après coup", () => {
  it("les revenus déjà générés sans source la reçoivent", async () => {
    const user = await makeUser()
    setTestUser(user.id)
    const src = await source(user.id)
    const res = await createRecurringRevenue({ type: "OTHER", label: "Loyer perçu", amount: 500 })
    await generateRevenueFromRecurring(res.id!, 2026, 2)
    await updateRecurringRevenue(res.id!, { fiscalSourceId: src.id })
    const r = await prisma.revenue.findFirstOrThrow({ where: { recurringRevenueId: res.id } })
    expect(r.fiscalSourceId).toBe(src.id)
  })
})
