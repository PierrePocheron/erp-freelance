import { describe, it, expect } from "vitest"
import { ensureSelfClient } from "@/actions/user"
import { ensureUrssafReminderTask } from "@/actions/urssaf"
import { ensureInvestmentReviewTasks } from "@/actions/investissements"
import { generatePendingRecurringExpenses } from "@/actions/expense"
import { prisma } from "@/lib/prisma"
import { setTestUser } from "./setup"
import { makeUser } from "./helpers/factories"

// #32 : ces gardes tournent à chaque navigation (layout) ; Next préfetche, donc deux
// rendus se chevauchent. Avant : les deux lisaient « rien » et créaient deux fois.
async function user() {
  const u = await makeUser()
  setTestUser(u.id)
  return u
}

describe("gardes idempotentes sous appels concurrents (#32)", () => {
  it("un seul contact « Perso »", async () => {
    const u = await user()
    await Promise.all([ensureSelfClient(u.id), ensureSelfClient(u.id), ensureSelfClient(u.id)])
    expect(await prisma.client.count({ where: { userId: u.id, type: "SELF" } })).toBe(1)
  })

  it("un seul rappel URSSAF par période", async () => {
    const u = await user()
    await Promise.all([ensureUrssafReminderTask(u.id, "QUARTERLY"), ensureUrssafReminderTask(u.id, "QUARTERLY")])
    expect(await prisma.task.count({ where: { userId: u.id, urssafPeriod: { not: null } } })).toBe(1)
  })

  it("un seul parent de relevés d'investissement, une sous-tâche par plateforme", async () => {
    const u = await user()
    await prisma.investmentPlatform.createMany({ data: [{ userId: u.id, name: "A", type: "OTHER" }, { userId: u.id, name: "B", type: "OTHER" }] })
    await Promise.all([ensureInvestmentReviewTasks(u.id, true, 5), ensureInvestmentReviewTasks(u.id, true, 5)])
    expect(await prisma.task.count({ where: { userId: u.id, investmentPeriod: { not: null }, parentTaskId: null } })).toBe(1)
    expect(await prisma.task.count({ where: { userId: u.id, investmentPlatformId: { not: null } } })).toBe(2)
  })

  it("une échéance de dépense récurrente n'est générée qu'une fois (deux onglets)", async () => {
    const u = await user()
    const d = new Date(Date.now() - 40 * 86_400_000)
    await prisma.recurringExpense.create({ data: { userId: u.id, label: "Loyer", amount: 700, frequency: "MONTHLY", nextGenerationDate: d } })
    await Promise.all([generatePendingRecurringExpenses(), generatePendingRecurringExpenses()])
    const rows = await prisma.expense.findMany({ where: { userId: u.id }, select: { date: true } })
    expect(new Set(rows.map((r) => r.date.getTime())).size).toBe(rows.length)
  })
})
