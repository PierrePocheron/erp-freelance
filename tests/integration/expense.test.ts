import { describe, it, expect } from "vitest"
import {
  createExpense,
  deleteExpense,
  createRecurringExpense,
  generateExpenseFromRecurring,
  generatePendingRecurringExpenses,
  toggleRecurringExpenseActive,
} from "@/actions/expense"
import { prisma } from "@/lib/prisma"
import { setTestUser } from "./setup"
import { makeUser } from "./helpers/factories"

// ── createExpense ────────────────────────────────────────────────────────────

describe("createExpense", () => {
  it("crée une dépense avec les champs requis", async () => {
    const user = await makeUser()
    setTestUser(user.id)

    const expense = await createExpense({
      label: "Courses",
      amount: 42.5,
      date: new Date("2026-06-10T00:00:00Z"),
      scope: "PERSO",
    })

    expect(expense.id).toBeDefined()
    const row = await prisma.expense.findUnique({ where: { id: expense.id } })
    expect(row?.userId).toBe(user.id)
    expect(row?.label).toBe("Courses")
    expect(row?.amount).toBe(42.5)
    expect(row?.scope).toBe("PERSO")
    expect(row?.currency).toBe("EUR")
  })

  it("isole les dépenses par utilisateur (multi-tenant)", async () => {
    const u1 = await makeUser()
    const u2 = await makeUser()

    setTestUser(u1.id)
    await createExpense({ label: "Dép u1", amount: 10, date: new Date(), scope: "PERSO" })

    setTestUser(u2.id)
    const rowsU2 = await prisma.expense.findMany({ where: { userId: u2.id } })
    expect(rowsU2).toHaveLength(0)
  })
})

// ── deleteExpense ────────────────────────────────────────────────────────────

describe("deleteExpense", () => {
  it("supprime la dépense de l'utilisateur courant", async () => {
    const user = await makeUser()
    setTestUser(user.id)

    const expense = await createExpense({ label: "À supprimer", amount: 20, date: new Date(), scope: "PERSO" })
    await deleteExpense(expense.id)

    const row = await prisma.expense.findUnique({ where: { id: expense.id } })
    expect(row).toBeNull()
  })
})

// ── Dépenses récurrentes — génération ────────────────────────────────────────

describe("dépenses récurrentes — génération", () => {
  it("generateExpenseFromRecurring crée une dépense et avance le curseur", async () => {
    const user = await makeUser()
    setTestUser(user.id)

    const rec = await createRecurringExpense({
      label: "Internet",
      amount: 35,
      scope: "PERSO",
      frequency: "MONTHLY",
      nextGenerationDate: new Date("2026-01-05T00:00:00Z"),
    })

    const gen = await generateExpenseFromRecurring(rec.id)
    expect(gen.id).toBeDefined()

    const expense = await prisma.expense.findUnique({ where: { id: gen.id } })
    expect(expense?.amount).toBe(35)
    expect(expense?.date.toISOString()).toBe("2026-01-05T00:00:00.000Z")
    expect(expense?.recurringExpenseId).toBe(rec.id)

    const updated = await prisma.recurringExpense.findUnique({ where: { id: rec.id } })
    expect(updated?.nextGenerationDate.toISOString()).toBe("2026-02-05T00:00:00.000Z")
  })

  it("generatePendingRecurringExpenses rattrape le retard puis ne génère plus rien au second appel", async () => {
    const user = await makeUser()
    setTestUser(user.id)

    // Curseur volontairement loin dans le passé pour forcer un rattrapage multi-mois
    const rec = await createRecurringExpense({
      label: "Assurance",
      amount: 15,
      scope: "PRO",
      frequency: "MONTHLY",
      nextGenerationDate: new Date("2025-01-01T00:00:00Z"),
    })

    const first = await generatePendingRecurringExpenses()
    expect(first.generated).toBeGreaterThan(1)

    const countAfterFirst = await prisma.expense.count({ where: { recurringExpenseId: rec.id } })
    expect(countAfterFirst).toBe(first.generated)

    // Deuxième appel immédiat : le curseur est déjà rattrapé, rien à générer
    const second = await generatePendingRecurringExpenses()
    expect(second.generated).toBe(0)

    const countAfterSecond = await prisma.expense.count({ where: { recurringExpenseId: rec.id } })
    expect(countAfterSecond).toBe(countAfterFirst)
  })

  it("toggleRecurringExpenseActive(false) exclut le modèle de la génération en attente", async () => {
    const user = await makeUser()
    setTestUser(user.id)

    const rec = await createRecurringExpense({
      label: "Salle de sport",
      amount: 30,
      scope: "PERSO",
      frequency: "MONTHLY",
      nextGenerationDate: new Date("2025-06-01T00:00:00Z"),
    })

    await toggleRecurringExpenseActive(rec.id, false)
    const result = await generatePendingRecurringExpenses()
    expect(result.generated).toBe(0)

    const count = await prisma.expense.count({ where: { recurringExpenseId: rec.id } })
    expect(count).toBe(0)
  })

  it("isole les modèles récurrents par utilisateur (multi-tenant)", async () => {
    const owner = await makeUser()
    const intruder = await makeUser()

    setTestUser(owner.id)
    const rec = await createRecurringExpense({
      label: "Owner rec", amount: 50, scope: "PERSO", frequency: "MONTHLY", nextGenerationDate: new Date(),
    })

    setTestUser(intruder.id)
    await expect(generateExpenseFromRecurring(rec.id)).rejects.toThrow()
  })
})
