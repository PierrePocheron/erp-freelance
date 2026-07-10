"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { auth } from "@/lib/auth"
import { advanceByFrequency } from "@/lib/dates"

async function requireAuth(): Promise<string> {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Non autorisé")
  return session.user.id
}

// Garde-fou anti-boucle infinie — cf. src/lib/dates.ts (une fréquence inconnue
// ne fait pas avancer la date).
const MAX_GENERATION_ITERATIONS = 1000

const DEFAULT_EXPENSE_CATEGORIES = [
  { name: "Informatique", color: "#6366f1" },
  { name: "Internet",     color: "#3b82f6" },
  { name: "Téléphone",    color: "#0ea5e9" },
  { name: "Sport",        color: "#10b981" },
  { name: "Loyer",        color: "#ef4444" },
  { name: "Abonnements",  color: "#f59e0b" },
  { name: "Transport",    color: "#f97316" },
  { name: "Assurance",    color: "#8b5cf6" },
  { name: "Autre",        color: "#64748b" },
]

/** Provisionne un set de catégories de base au premier usage — évite de partir d'une liste vide. */
export async function getOrCreateDefaultExpenseCategories(): Promise<{ id: string; name: string; color: string }[]> {
  const userId = await requireAuth()
  const existing = await prisma.expenseCategory.findMany({
    where: { userId },
    orderBy: { name: "asc" },
    select: { id: true, name: true, color: true },
  })
  if (existing.length > 0) return existing

  await prisma.expenseCategory.createMany({
    data: DEFAULT_EXPENSE_CATEGORIES.map(c => ({ userId, name: c.name, color: c.color })),
    skipDuplicates: true,
  })
  return prisma.expenseCategory.findMany({
    where: { userId },
    orderBy: { name: "asc" },
    select: { id: true, name: true, color: true },
  })
}

export async function createExpenseCategory(name: string, color: string) {
  const userId = await requireAuth()
  const category = await prisma.expenseCategory.create({
    data: { userId, name: name.trim(), color },
  })
  revalidatePath("/depenses")
  return category
}

export async function deleteExpenseCategory(categoryId: string) {
  const userId = await requireAuth()
  await prisma.expenseCategory.delete({ where: { id: categoryId, userId } })
  revalidatePath("/depenses")
}

// ─── Dépenses ponctuelles ───────────────────────────────────────────────────

export type ExpenseInput = {
  label: string
  amount: number
  date: Date
  scope: "PRO" | "PERSO"
  categoryId?: string | null
  notes?: string | null
}

export async function createExpense(data: ExpenseInput) {
  const userId = await requireAuth()
  const expense = await prisma.expense.create({
    data: {
      userId,
      label: data.label.trim(),
      amount: data.amount,
      date: data.date,
      scope: data.scope,
      categoryId: data.categoryId ?? null,
      notes: data.notes?.trim() || null,
    },
  })
  revalidatePath("/depenses")
  revalidatePath("/calendrier")
  return expense
}

export async function updateExpense(expenseId: string, data: ExpenseInput) {
  const userId = await requireAuth()
  const existing = await prisma.expense.findFirst({ where: { id: expenseId, userId }, select: { id: true } })
  if (!existing) throw new Error("Dépense introuvable")

  await prisma.expense.update({
    where: { id: expenseId },
    data: {
      label: data.label.trim(),
      amount: data.amount,
      date: data.date,
      scope: data.scope,
      categoryId: data.categoryId ?? null,
      notes: data.notes?.trim() || null,
    },
  })
  revalidatePath("/depenses")
  revalidatePath("/calendrier")
}

export async function deleteExpense(expenseId: string) {
  const userId = await requireAuth()
  await prisma.expense.delete({ where: { id: expenseId, userId } })
  revalidatePath("/depenses")
  revalidatePath("/calendrier")
}

// ─── Dépenses récurrentes ───────────────────────────────────────────────────

export type RecurringExpenseInput = {
  label: string
  amount: number
  scope: "PRO" | "PERSO"
  frequency: "WEEKLY" | "MONTHLY" | "QUARTERLY" | "YEARLY" | "CUSTOM"
  nextGenerationDate: Date
  dateToConfirm?: boolean
  categoryId?: string | null
  notes?: string | null
}

export async function createRecurringExpense(data: RecurringExpenseInput) {
  const userId = await requireAuth()
  const recurring = await prisma.recurringExpense.create({
    data: {
      userId,
      label: data.label.trim(),
      amount: data.amount,
      scope: data.scope,
      frequency: data.frequency,
      nextGenerationDate: data.nextGenerationDate,
      dateToConfirm: data.dateToConfirm ?? false,
      categoryId: data.categoryId ?? null,
      notes: data.notes?.trim() || null,
    },
  })
  revalidatePath("/depenses/recurrentes")
  revalidatePath("/calendrier")
  return recurring
}

export async function updateRecurringExpense(recurringExpenseId: string, data: RecurringExpenseInput) {
  const userId = await requireAuth()
  const existing = await prisma.recurringExpense.findFirst({ where: { id: recurringExpenseId, userId }, select: { id: true } })
  if (!existing) throw new Error("Dépense récurrente introuvable")

  await prisma.recurringExpense.update({
    where: { id: recurringExpenseId },
    data: {
      label: data.label.trim(),
      amount: data.amount,
      scope: data.scope,
      frequency: data.frequency,
      nextGenerationDate: data.nextGenerationDate,
      dateToConfirm: data.dateToConfirm ?? false,
      categoryId: data.categoryId ?? null,
      notes: data.notes?.trim() || null,
    },
  })
  revalidatePath("/depenses/recurrentes")
  revalidatePath("/calendrier")
}

export async function deleteRecurringExpense(recurringExpenseId: string) {
  const userId = await requireAuth()
  await prisma.recurringExpense.delete({ where: { id: recurringExpenseId, userId } })
  revalidatePath("/depenses/recurrentes")
  revalidatePath("/calendrier")
}

/**
 * Convertit une dépense récurrente en dépense ponctuelle : supprime le modèle
 * récurrent et crée une Expense unique à la place (atomique). Utilisé quand on
 * passe la fréquence à « Ponctuelle » dans le dialog d'édition.
 */
export async function convertRecurringToExpense(recurringExpenseId: string, data: ExpenseInput) {
  const userId = await requireAuth()
  const existing = await prisma.recurringExpense.findFirst({ where: { id: recurringExpenseId, userId }, select: { id: true } })
  if (!existing) throw new Error("Dépense récurrente introuvable")

  const expense = await prisma.$transaction(async (tx) => {
    await tx.recurringExpense.delete({ where: { id: recurringExpenseId } })
    return tx.expense.create({
      data: {
        userId,
        label: data.label.trim(),
        amount: data.amount,
        date: data.date,
        scope: data.scope,
        categoryId: data.categoryId ?? null,
        notes: data.notes?.trim() || null,
      },
    })
  })
  revalidatePath("/depenses")
  revalidatePath("/calendrier")
  return expense
}

export async function toggleRecurringExpenseActive(recurringExpenseId: string, isActive: boolean) {
  const userId = await requireAuth()
  const existing = await prisma.recurringExpense.findFirst({ where: { id: recurringExpenseId, userId }, select: { id: true } })
  if (!existing) throw new Error("Dépense récurrente introuvable")

  await prisma.recurringExpense.update({ where: { id: recurringExpenseId }, data: { isActive } })
  revalidatePath("/depenses/recurrentes")
  revalidatePath("/calendrier")
}

/**
 * Génère l'entrée Expense courante d'un modèle récurrent, puis avance son
 * curseur `nextGenerationDate` selon sa fréquence. Mirroir de
 * generateInvoiceFromRecurring (src/actions/facturation.ts).
 */
export async function generateExpenseFromRecurring(recurringExpenseId: string): Promise<{ id: string }> {
  const userId = await requireAuth()
  const recurring = await prisma.recurringExpense.findFirst({ where: { id: recurringExpenseId, userId } })
  if (!recurring) throw new Error("Dépense récurrente introuvable")
  if (recurring.dateToConfirm) throw new Error("Date de prélèvement à confirmer avant de générer")

  const expense = await prisma.expense.create({
    data: {
      userId,
      categoryId: recurring.categoryId,
      scope: recurring.scope,
      label: recurring.label,
      amount: recurring.amount,
      currency: recurring.currency,
      date: recurring.nextGenerationDate,
      notes: recurring.notes,
      recurringExpenseId: recurring.id,
    },
  })

  const next = advanceByFrequency(recurring.nextGenerationDate, recurring.frequency)
  await prisma.recurringExpense.update({ where: { id: recurringExpenseId }, data: { nextGenerationDate: next } })

  revalidatePath("/depenses")
  revalidatePath("/depenses/recurrentes")
  revalidatePath("/calendrier")
  return { id: expense.id }
}

/**
 * Génère toutes les dépenses en retard pour les modèles récurrents actifs
 * (nextGenerationDate <= aujourd'hui), en avançant le curseur à chaque
 * génération jusqu'à rattraper la date courante. Déclenchement manuel
 * uniquement (pas de cron) — même choix que generatePendingRecurringRevenues.
 */
export async function generatePendingRecurringExpenses(): Promise<{ generated: number }> {
  const userId = await requireAuth()
  const recs = await prisma.recurringExpense.findMany({ where: { userId, isActive: true, dateToConfirm: false } })

  const now = new Date()
  let generated = 0

  for (const rec of recs) {
    let cursor = rec.nextGenerationDate
    let iterations = 0

    while (cursor.getTime() <= now.getTime()) {
      await prisma.expense.create({
        data: {
          userId,
          categoryId: rec.categoryId,
          scope: rec.scope,
          label: rec.label,
          amount: rec.amount,
          currency: rec.currency,
          date: cursor,
          notes: rec.notes,
          recurringExpenseId: rec.id,
        },
      })
      generated++

      const next = advanceByFrequency(cursor, rec.frequency)
      if (next.getTime() === cursor.getTime()) break // fréquence inconnue → pas de progression possible
      cursor = next
      if (++iterations > MAX_GENERATION_ITERATIONS) break
    }

    if (cursor.getTime() !== rec.nextGenerationDate.getTime()) {
      await prisma.recurringExpense.update({ where: { id: rec.id }, data: { nextGenerationDate: cursor } })
    }
  }

  if (generated > 0) {
    revalidatePath("/depenses")
    revalidatePath("/depenses/recurrentes")
    revalidatePath("/calendrier")
  }
  return { generated }
}
