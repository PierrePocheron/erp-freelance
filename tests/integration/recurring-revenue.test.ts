import { describe, it, expect, vi, afterEach } from "vitest"
import { generatePendingRecurringRevenues } from "@/actions/revenue"
import { prisma } from "@/lib/prisma"
import { setTestUser } from "./setup"
import { makeUser } from "./helpers/factories"

// Rattrapage des revenus récurrents : il part du mois de CRÉATION du modèle et
// déduplique par période. Rien ne le couvrait, alors qu'un doublon fausse
// directement les KPI de /revenus.
// Horloge figée (même motif que numbering.test.ts) : ne jamais faker setTimeout,
// le driver pg en dépend.

afterEach(() => { vi.useRealTimers() })

function freeze(d: Date) {
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(d)
}

async function makeRecurring(userId: string, createdAt: Date, over: Record<string, unknown> = {}) {
  return prisma.recurringRevenue.create({
    data: { userId, type: "SALARY", label: "Salaire", amount: 1500, dayOfMonth: 5, createdAt, ...over },
  })
}

describe("revenus récurrents — rattrapage", () => {
  it("génère les mois manquants depuis la création, une seule fois par période", async () => {
    const user = await makeUser()
    setTestUser(user.id)
    const rec = await makeRecurring(user.id, new Date(2026, 3, 10)) // avril
    // Mai déjà saisi à la main : il ne doit pas être regénéré.
    await prisma.revenue.create({
      data: { userId: user.id, type: "SALARY", label: "Salaire — mai", amount: 1500,
              status: "RECEIVED", period: "2026-05", recurringRevenueId: rec.id },
    })

    freeze(new Date(2026, 6, 15)) // 15 juillet
    expect(await generatePendingRecurringRevenues()).toEqual({ generated: 3 }) // avril, juin, juillet

    const periods = (await prisma.revenue.findMany({
      where: { recurringRevenueId: rec.id }, orderBy: { period: "asc" }, select: { period: true, status: true, amount: true },
    }))
    expect(periods.map((r) => r.period)).toEqual(["2026-04", "2026-05", "2026-06", "2026-07"])
    expect(periods.filter((r) => r.period !== "2026-05").every((r) => r.status === "PENDING")).toBe(true)
    expect(periods.every((r) => r.amount === 1500)).toBe(true)

    // Second passage : idempotent.
    expect(await generatePendingRecurringRevenues()).toEqual({ generated: 0 })
    expect(await prisma.revenue.count({ where: { recurringRevenueId: rec.id } })).toBe(4)
  })

  it("ignore un modèle désactivé", async () => {
    const user = await makeUser()
    setTestUser(user.id)
    const rec = await makeRecurring(user.id, new Date(2026, 3, 10), { isActive: false })

    freeze(new Date(2026, 6, 15))
    expect(await generatePendingRecurringRevenues()).toEqual({ generated: 0 })
    expect(await prisma.revenue.count({ where: { recurringRevenueId: rec.id } })).toBe(0)
  })

  it("ne touche pas aux modèles d'un autre compte", async () => {
    const victim = await makeUser()
    const rec = await makeRecurring(victim.id, new Date(2026, 3, 10))

    const other = await makeUser()
    setTestUser(other.id)
    freeze(new Date(2026, 6, 15))

    expect(await generatePendingRecurringRevenues()).toEqual({ generated: 0 })
    expect(await prisma.revenue.count({ where: { recurringRevenueId: rec.id } })).toBe(0)
  })

  it("ne génère jamais au-delà du mois courant", async () => {
    const user = await makeUser()
    setTestUser(user.id)
    const rec = await makeRecurring(user.id, new Date(2026, 6, 1)) // créé en juillet

    freeze(new Date(2026, 6, 2)) // 2 juillet
    expect(await generatePendingRecurringRevenues()).toEqual({ generated: 1 })
    const rows = await prisma.revenue.findMany({ where: { recurringRevenueId: rec.id } })
    expect(rows.map((r) => r.period)).toEqual(["2026-07"])
  })
})
