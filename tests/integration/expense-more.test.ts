import { describe, it, expect, vi } from "vitest"
import {
  getOrCreateDefaultExpenseCategories,
  createExpenseCategory,
  deleteExpenseCategory,
  createExpense,
  updateExpense,
  deleteExpense,
  convertExpenseToRecurring,
  createRecurringExpense,
  updateRecurringExpense,
  deleteRecurringExpense,
  toggleRecurringExpenseActive,
  generateExpenseFromRecurring,
  generatePendingRecurringExpenses,
} from "@/actions/expense"
import { prisma } from "@/lib/prisma"
import { setTestUser } from "./setup"
import { makeUser } from "./helpers/factories"

async function asNewUser() {
  const user = await makeUser()
  setTestUser(user.id)
  return user
}

const expenseInput = (over: Record<string, unknown> = {}) => ({
  label: "Abonnement fictif",
  amount: 12.5,
  date: new Date("2026-03-10T12:00:00Z"),
  scope: "PERSO" as const,
  ...over,
})

const recurringInput = (over: Record<string, unknown> = {}) => ({
  label: "Box internet",
  amount: 30,
  scope: "PRO" as const,
  frequency: "MONTHLY" as const,
  nextGenerationDate: new Date("2026-04-05T12:00:00Z"),
  ...over,
})

describe("catégories de dépenses", () => {
  it("provisionne le jeu par défaut une seule fois, trié, par utilisateur", async () => {
    const user = await asNewUser()
    const first = await getOrCreateDefaultExpenseCategories()
    expect(first).toHaveLength(9)
    expect(first.map((c) => c.name)).toEqual(expect.arrayContaining(["Informatique", "Loyer", "Autre"]))
    expect(await getOrCreateDefaultExpenseCategories()).toEqual(first)
    expect(await prisma.expenseCategory.count({ where: { userId: user.id } })).toBe(9)

    await asNewUser()
    const other = await getOrCreateDefaultExpenseCategories()
    expect(other.map((c) => c.id)).not.toContain(first[0].id)
    expect(await prisma.expenseCategory.count()).toBe(18)
  })

  it("un utilisateur qui a déjà une catégorie ne reçoit pas le jeu par défaut", async () => {
    await asNewUser()
    const cat = await createExpenseCategory("  Matériel ", "#123456")
    expect(cat).toMatchObject({ name: "Matériel", color: "#123456" })
    expect(await getOrCreateDefaultExpenseCategories()).toEqual([{ id: cat.id, name: "Matériel", color: "#123456" }])
  })

  it("supprimer une catégorie détache ses dépenses ; catégorie d'un autre compte intouchable", async () => {
    const owner = await asNewUser()
    const cat = await createExpenseCategory("Logiciels", "#000000")
    const exp = await createExpense(expenseInput({ categoryId: cat.id }))

    await asNewUser()
    await expect(deleteExpenseCategory(cat.id)).rejects.toThrow()
    expect(await prisma.expenseCategory.findUnique({ where: { id: cat.id } })).not.toBeNull()

    setTestUser(owner.id)
    await deleteExpenseCategory(cat.id)
    expect(await prisma.expenseCategory.findUnique({ where: { id: cat.id } })).toBeNull()
    expect((await prisma.expense.findUniqueOrThrow({ where: { id: exp.id } })).categoryId).toBeNull()
  })

  // Régression corrigée le 29/09/2026 (src/actions/expense.ts:83, et :105/:144/:190/:213/:247) — categoryId
  // n'est jamais contrôlé : une dépense (ponctuelle ou récurrente) peut être
  // classée dans la catégorie d'un AUTRE compte (nom/couleur d'autrui affichés).
  it("une dépense refuse la catégorie d'un autre compte", async () => {
    await asNewUser()
    const foreignCat = await createExpenseCategory("Privée", "#ff0000")
    await asNewUser()
    const exp = await createExpense(expenseInput({ categoryId: foreignCat.id })).catch(() => null)
    expect(exp?.categoryId ?? null).toBeNull()
  })
})

describe("dépenses ponctuelles", () => {
  it("updateExpense réécrit tous les champs (trim, vide → null) ; autre compte refusé", async () => {
    const owner = await asNewUser()
    const cat = await createExpenseCategory("Transport", "#111111")
    const exp = await createExpense(expenseInput({ merchant: " Enseigne ", notes: " note " }))
    expect(exp).toMatchObject({ merchant: "Enseigne", notes: "note", categoryId: null })

    await updateExpense(exp.id, expenseInput({
      label: "  Train ", merchant: "  ", amount: 42, date: new Date("2026-03-11T08:00:00Z"), scope: "PRO", categoryId: cat.id, notes: "",
    }))
    let saved = await prisma.expense.findUniqueOrThrow({ where: { id: exp.id } })
    expect(saved).toMatchObject({ label: "Train", merchant: null, amount: 42, scope: "PRO", categoryId: cat.id, notes: null })
    expect(saved.date.toISOString()).toBe("2026-03-11T08:00:00.000Z")

    await asNewUser()
    await expect(updateExpense(exp.id, expenseInput({ label: "pwn" }))).rejects.toThrow(/Dépense introuvable/)
    await expect(deleteExpense(exp.id)).rejects.toThrow()
    saved = await prisma.expense.findUniqueOrThrow({ where: { id: exp.id } })
    expect(saved).toMatchObject({ label: "Train", userId: owner.id })
  })

  it("convertExpenseToRecurring : crée le modèle (échéance suivante), relie la dépense, garde la devise", async () => {
    const user = await asNewUser()
    const exp = await createExpense(expenseInput())
    await prisma.expense.update({ where: { id: exp.id }, data: { currency: "USD" } })

    await convertExpenseToRecurring(exp.id, "QUARTERLY", expenseInput({ label: " Hébergement ", amount: 20, notes: " n ", merchant: " Hébergeur " }))

    const saved = await prisma.expense.findUniqueOrThrow({ where: { id: exp.id } })
    expect(saved).toMatchObject({ label: "Hébergement", amount: 20, merchant: "Hébergeur", notes: "n" })
    const rec = await prisma.recurringExpense.findUniqueOrThrow({ where: { id: saved.recurringExpenseId! } })
    expect(rec).toMatchObject({ userId: user.id, label: "Hébergement", amount: 20, currency: "USD", frequency: "QUARTERLY", notes: "n", isActive: true })
    expect(rec.nextGenerationDate.toISOString()).toBe("2026-06-10T12:00:00.000Z")
  })

  it("convertExpenseToRecurring refuse la dépense d'un autre compte sans rien créer", async () => {
    await asNewUser()
    const exp = await createExpense(expenseInput())
    await asNewUser()
    await expect(convertExpenseToRecurring(exp.id, "MONTHLY", expenseInput())).rejects.toThrow(/Dépense introuvable/)
    expect(await prisma.recurringExpense.count()).toBe(0)
    expect((await prisma.expense.findUniqueOrThrow({ where: { id: exp.id } })).recurringExpenseId).toBeNull()
  })
})

describe("dépenses récurrentes", () => {
  it("création (valeurs par défaut), mise à jour complète, suppression ; autre compte refusé", async () => {
    const owner = await asNewUser()
    const rec = await createRecurringExpense(recurringInput({ notes: "  " }))
    expect(rec).toMatchObject({ userId: owner.id, dateToConfirm: false, categoryId: null, notes: null, isActive: true })

    await updateRecurringExpense(rec.id, recurringInput({
      label: " Fibre ", amount: 35, scope: "PERSO", frequency: "YEARLY", nextGenerationDate: new Date("2026-12-01T12:00:00Z"), dateToConfirm: true, notes: " n ",
    }))
    const saved = await prisma.recurringExpense.findUniqueOrThrow({ where: { id: rec.id } })
    expect(saved).toMatchObject({ label: "Fibre", amount: 35, scope: "PERSO", frequency: "YEARLY", dateToConfirm: true, notes: "n" })

    await asNewUser()
    await expect(updateRecurringExpense(rec.id, recurringInput({ label: "pwn" }))).rejects.toThrow(/introuvable/)
    await expect(deleteRecurringExpense(rec.id)).rejects.toThrow()
    await expect(toggleRecurringExpenseActive(rec.id, false)).rejects.toThrow(/introuvable/)
    await expect(generateExpenseFromRecurring(rec.id)).rejects.toThrow(/introuvable/)
    expect(await prisma.recurringExpense.findUniqueOrThrow({ where: { id: rec.id } })).toMatchObject({ label: "Fibre", isActive: true })
    expect(await prisma.expense.count()).toBe(0)

    setTestUser(owner.id)
    await deleteRecurringExpense(rec.id)
    expect(await prisma.recurringExpense.count()).toBe(0)
  })

  it("réactivation : l'échéance saute les mois de pause au lieu de les rattraper", async () => {
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(new Date("2026-09-20T12:00:00Z"))
    try {
      await asNewUser()
      const rec = await createRecurringExpense(recurringInput({ nextGenerationDate: new Date("2026-05-05T12:00:00Z") }))
      await toggleRecurringExpenseActive(rec.id, false)
      expect((await prisma.recurringExpense.findUniqueOrThrow({ where: { id: rec.id } })).nextGenerationDate.toISOString())
        .toBe("2026-05-05T12:00:00.000Z") // la pause ne touche pas à l'échéance

      await toggleRecurringExpenseActive(rec.id, true)
      const saved = await prisma.recurringExpense.findUniqueOrThrow({ where: { id: rec.id } })
      expect(saved.isActive).toBe(true)
      expect(saved.nextGenerationDate.toISOString()).toBe("2026-10-05T12:00:00.000Z")
      expect((await generatePendingRecurringExpenses()).generated).toBe(0)

      // Fréquence sans cadence (CUSTOM) : pas de boucle infinie, date inchangée.
      const custom = await createRecurringExpense(recurringInput({ frequency: "CUSTOM", nextGenerationDate: new Date("2026-01-01T12:00:00Z"), dateToConfirm: true }))
      await toggleRecurringExpenseActive(custom.id, true)
      expect((await prisma.recurringExpense.findUniqueOrThrow({ where: { id: custom.id } })).nextGenerationDate.toISOString())
        .toBe("2026-01-01T12:00:00.000Z")
    } finally {
      vi.useRealTimers()
    }
  })

  it("génération : refusée tant que la date est à confirmer ; ignorée par le rattrapage automatique", async () => {
    await asNewUser()
    const rec = await createRecurringExpense(recurringInput({ nextGenerationDate: new Date("2025-01-01T12:00:00Z"), dateToConfirm: true }))
    await expect(generateExpenseFromRecurring(rec.id)).rejects.toThrow(/à confirmer/)
    expect((await generatePendingRecurringExpenses()).generated).toBe(0)
    expect(await prisma.expense.count()).toBe(0)
  })

  // Régression corrigée le 29/09/2026 (src/actions/expense.ts:354-378) — pour une fréquence sans cadence
  // (CUSTOM, acceptée par l'action) et une échéance passée, le rattrapage crée
  // UNE dépense puis sort (date inchangée) sans avancer le curseur : chaque
  // chargement de /depenses (qui appelle cette fonction au rendu) en recrée une.
  it("un modèle CUSTOM échu ne génère pas un doublon à chaque appel", async () => {
    await asNewUser()
    await createRecurringExpense(recurringInput({ frequency: "CUSTOM", nextGenerationDate: new Date("2026-01-01T12:00:00Z") }))
    await generatePendingRecurringExpenses()
    await generatePendingRecurringExpenses()
    expect(await prisma.expense.count()).toBeLessThanOrEqual(1)
  })
})
