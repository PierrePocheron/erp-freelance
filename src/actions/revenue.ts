"use server"

import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/require-auth"
import { zonedDateKey } from "@/lib/dates"
import { assertOwnedRefs } from "@/lib/owned-refs"
import { revalidatePath } from "next/cache"

// ── Revenus ────────────────────────────────────────────────────────────────────

export async function createRevenue(data: {
  type: string
  label: string
  amount: number
  currency?: string
  status?: string
  receivedAt?: Date | null
  expectedAt?: Date | null
  paymentMethod?: string | null
  notes?: string | null
  period?: string | null
  recurringRevenueId?: string | null
  fiscalSourceId?: string | null
  companyId?: string | null
  clientId?: string | null
  projectId?: string | null
}): Promise<{ error?: string; id?: string }> {
  const userId = await requireAuth()

  if (!data.label.trim()) return { error: "Le libellé est requis" }
  if (!data.amount || data.amount <= 0) return { error: "Le montant doit être positif" }

  try {
    const revenue = await prisma.revenue.create({
      data: {
        userId,
        type:               data.type as never,
        label:              data.label.trim(),
        amount:             data.amount,
        currency:           data.currency ?? "EUR",
        status:             (data.status ?? "PENDING") as never,
        receivedAt:         data.receivedAt ?? null,
        expectedAt:         data.expectedAt ?? null,
        paymentMethod:      data.paymentMethod ?? null,
        notes:              data.notes ?? null,
        period:             data.period ?? null,
        recurringRevenueId: data.recurringRevenueId ?? null,
        fiscalSourceId:     data.fiscalSourceId ?? null,
        companyId:          data.companyId ?? null,
        clientId:           data.clientId ?? null,
        projectId:          data.projectId ?? null,
      },
    })
    revalidatePath("/revenus")
    return { id: revenue.id }
  } catch {
    return { error: "Erreur lors de la création" }
  }
}

export async function updateRevenue(
  id: string,
  data: {
    type?: string
    label?: string
    amount?: number
    status?: string
    receivedAt?: Date | null
    expectedAt?: Date | null
    paymentMethod?: string | null
    notes?: string | null
    period?: string | null
    fiscalSourceId?: string | null
    companyId?: string | null
    clientId?: string | null
    projectId?: string | null
  }
): Promise<{ error?: string }> {
  const userId = await requireAuth()

  const existing = await prisma.revenue.findFirst({ where: { id, userId } })
  if (!existing) return { error: "Revenu introuvable" }

  await prisma.revenue.update({
    where: { id },
    data: {
      ...(data.type !== undefined          ? { type: data.type as never }           : {}),
      ...(data.label !== undefined         ? { label: data.label.trim() }           : {}),
      ...(data.amount !== undefined        ? { amount: data.amount }                : {}),
      ...(data.status !== undefined        ? { status: data.status as never }       : {}),
      ...(data.receivedAt !== undefined    ? { receivedAt: data.receivedAt }        : {}),
      ...(data.expectedAt !== undefined    ? { expectedAt: data.expectedAt }        : {}),
      ...(data.paymentMethod !== undefined ? { paymentMethod: data.paymentMethod }  : {}),
      ...(data.notes !== undefined         ? { notes: data.notes }                  : {}),
      ...(data.period !== undefined          ? { period: data.period }                  : {}),
      ...(data.fiscalSourceId !== undefined ? { fiscalSourceId: data.fiscalSourceId } : {}),
      ...(data.companyId !== undefined      ? { companyId: data.companyId }            : {}),
      ...(data.clientId !== undefined      ? { clientId: data.clientId }            : {}),
      ...(data.projectId !== undefined     ? { projectId: data.projectId }          : {}),
    },
  })
  revalidatePath("/revenus")
  return {}
}

/**
 * Liste allégée des revenus en attente pour le quick-add mobile —
 * sélection minimale, 20 résultats max, les plus proches d'abord.
 */
export async function getPendingRevenuesQuick() {
  const userId = await requireAuth()

  return prisma.revenue.findMany({
    where: { userId, status: "PENDING" },
    orderBy: { expectedAt: "asc" },
    take: 20,
    select: { id: true, label: true, amount: true, expectedAt: true },
  })
}

/** Marque un revenu comme reçu avec la date + moyen de paiement. */
export async function markRevenueReceived(
  id: string,
  receivedAt: Date,
  paymentMethod: string
): Promise<{ error?: string }> {
  const userId = await requireAuth()

  const existing = await prisma.revenue.findFirst({ where: { id, userId } })
  if (!existing) return { error: "Revenu introuvable" }

  await prisma.revenue.update({
    where: { id },
    data: { status: "RECEIVED", receivedAt, paymentMethod },
  })
  revalidatePath("/revenus")
  return {}
}

/**
 * Repasse un revenu validé en attente (erreur de saisie) : status PENDING,
 * date de réception et moyen de paiement effacés. Inverse de markRevenueReceived.
 */
export async function markRevenuePending(id: string): Promise<{ error?: string }> {
  const userId = await requireAuth()

  const existing = await prisma.revenue.findFirst({ where: { id, userId } })
  if (!existing) return { error: "Revenu introuvable" }

  await prisma.revenue.update({
    where: { id },
    data: { status: "PENDING", receivedAt: null, paymentMethod: null },
  })
  revalidatePath("/revenus")
  return {}
}

export async function bulkMarkReceived(
  ids: string[],
  receivedAt: Date
): Promise<{ error?: string; count?: number }> {
  const userId = await requireAuth()

  if (!ids.length) return { count: 0 }

  const existing = await prisma.revenue.findMany({
    where: { id: { in: ids }, userId },
    select: { id: true },
  })

  const validIds = existing.map(r => r.id)
  if (!validIds.length) return { error: "Aucun revenu valide" }

  await prisma.revenue.updateMany({
    where: { id: { in: validIds }, userId },
    data: { status: "RECEIVED", receivedAt },
  })

  revalidatePath("/revenus")
  return { count: validIds.length }
}

export async function deleteRevenue(id: string): Promise<{ error?: string }> {
  const userId = await requireAuth()

  const existing = await prisma.revenue.findFirst({ where: { id, userId } })
  if (!existing) return { error: "Revenu introuvable" }

  await prisma.revenue.delete({ where: { id } })
  revalidatePath("/revenus")
  return {}
}

// ── Revenus récurrents ─────────────────────────────────────────────────────────

export async function createRecurringRevenue(data: {
  type: string
  label: string
  amount: number
  currency?: string
  dayOfMonth?: number
  paymentMethod?: string | null
  notes?: string | null
  companyId?: string | null
  clientId?: string | null
  projectId?: string | null
  fiscalSourceId?: string | null
}): Promise<{ error?: string; id?: string }> {
  const userId = await requireAuth()

  if (!data.label.trim()) return { error: "Le libellé est requis" }
  if (!data.amount || data.amount <= 0) return { error: "Le montant doit être positif" }
  const refsError = await recurringRefsError(userId, data)
  if (refsError) return { error: refsError }

  try {
    const rec = await prisma.recurringRevenue.create({
      data: {
        userId,
        type:          data.type as never,
        label:         data.label.trim(),
        amount:        data.amount,
        currency:      data.currency ?? "EUR",
        dayOfMonth:    data.dayOfMonth ?? 1,
        paymentMethod: data.paymentMethod ?? null,
        notes:         data.notes ?? null,
        companyId:     data.companyId ?? null,
        clientId:      data.clientId ?? null,
        projectId:     data.projectId ?? null,
        fiscalSourceId: data.fiscalSourceId ?? null,
      },
    })
    revalidatePath("/revenus")
    return { id: rec.id }
  } catch {
    return { error: "Erreur lors de la création" }
  }
}

export async function updateRecurringRevenue(
  id: string,
  data: {
    type?: string
    label?: string
    amount?: number
    dayOfMonth?: number
    paymentMethod?: string | null
    notes?: string | null
    isActive?: boolean
    companyId?: string | null
    clientId?: string | null
    projectId?: string | null
    fiscalSourceId?: string | null
  }
): Promise<{ error?: string }> {
  const userId = await requireAuth()

  const existing = await prisma.recurringRevenue.findFirst({ where: { id, userId } })
  if (!existing) return { error: "Modèle récurrent introuvable" }
  const refsError = await recurringRefsError(userId, data)
  if (refsError) return { error: refsError }

  await prisma.recurringRevenue.update({
    where: { id },
    data: {
      ...(data.type !== undefined          ? { type: data.type as never }            : {}),
      ...(data.label !== undefined         ? { label: data.label.trim() }            : {}),
      ...(data.amount !== undefined        ? { amount: data.amount }                 : {}),
      ...(data.dayOfMonth !== undefined    ? { dayOfMonth: data.dayOfMonth }         : {}),
      ...(data.paymentMethod !== undefined ? { paymentMethod: data.paymentMethod }   : {}),
      ...(data.notes !== undefined         ? { notes: data.notes }                   : {}),
      ...(data.isActive !== undefined      ? { isActive: data.isActive }             : {}),
      ...(data.companyId !== undefined     ? { companyId: data.companyId }           : {}),
      ...(data.clientId !== undefined      ? { clientId: data.clientId }             : {}),
      ...(data.projectId !== undefined     ? { projectId: data.projectId }           : {}),
      ...(data.fiscalSourceId !== undefined ? { fiscalSourceId: data.fiscalSourceId } : {}),
    },
  })
  // Source ajoutée après coup : les revenus déjà générés sans source la reçoivent aussi
  // (sinon les mois passés restaient à 0 € dans le récapitulatif fiscal).
  if (data.fiscalSourceId) {
    await prisma.revenue.updateMany({
      where: { userId, recurringRevenueId: id, fiscalSourceId: null },
      data: { fiscalSourceId: data.fiscalSourceId },
    })
  }
  revalidatePath("/revenus")
  return {}
}

// Anti-IDOR des références d'un modèle récurrent (société, contact, projet, source fiscale)
async function recurringRefsError(
  userId: string,
  data: { companyId?: string | null; clientId?: string | null; projectId?: string | null; fiscalSourceId?: string | null },
): Promise<string | null> {
  try {
    await assertOwnedRefs(userId, { companyId: data.companyId, clientId: data.clientId, projectId: data.projectId })
  } catch (e) {
    return e instanceof Error ? e.message : "Référence invalide"
  }
  if (data.fiscalSourceId && !(await prisma.fiscalSource.findFirst({ where: { id: data.fiscalSourceId, userId }, select: { id: true } }))) {
    return "Source fiscale introuvable"
  }
  return null
}

export async function deleteRecurringRevenue(id: string): Promise<{ error?: string }> {
  const userId = await requireAuth()

  const existing = await prisma.recurringRevenue.findFirst({ where: { id, userId } })
  if (!existing) return { error: "Modèle récurrent introuvable" }

  await prisma.recurringRevenue.delete({ where: { id } })
  revalidatePath("/revenus")
  return {}
}

/** Rattachements recopiés du modèle récurrent vers chaque revenu généré (#37). */
function inheritedFrom(rec: { fiscalSourceId: string | null; companyId: string | null; clientId: string | null; projectId: string | null }) {
  return { fiscalSourceId: rec.fiscalSourceId, companyId: rec.companyId, clientId: rec.clientId, projectId: rec.projectId }
}

/**
 * Génère l'entrée Revenue du mois pour un modèle récurrent.
 * Idempotent : si l'entrée pour la période existe déjà, retourne son id.
 */
export async function generateRevenueFromRecurring(
  recurringRevenueId: string,
  year: number,
  month: number
): Promise<{ error?: string; id?: string; alreadyExists?: boolean }> {
  const userId = await requireAuth()

  const rec = await prisma.recurringRevenue.findFirst({
    where: { id: recurringRevenueId, userId },
  })
  if (!rec) return { error: "Modèle récurrent introuvable" }

  const period = `${year}-${String(month).padStart(2, "0")}`

  // Idempotence : vérifie si une entrée existe déjà pour cette période
  const existing = await prisma.revenue.findFirst({
    where: { recurringRevenueId, period },
  })
  if (existing) return { id: existing.id, alreadyExists: true }

  const revenue = await prisma.revenue.create({
    data: {
      userId,
      type:              rec.type,
      label:             `${rec.label} — ${new Date(year, month - 1).toLocaleDateString("fr-FR", { timeZone: "Europe/Paris", month: "long", year: "numeric" })}`,
      amount:            rec.amount,
      currency:          rec.currency,
      status:            "PENDING",
      paymentMethod:     rec.paymentMethod,
      notes:             rec.notes,
      period,
      recurringRevenueId: rec.id,
      ...inheritedFrom(rec),
    },
  })

  revalidatePath("/revenus")
  return { id: revenue.id }
}

/**
 * Génère les entrées manquantes pour tous les récurrents actifs depuis leur
 * première occurrence jusqu'au mois courant.
 * Appelé manuellement depuis la page.
 */
export async function generatePendingRecurringRevenues(): Promise<{ generated: number }> {
  const userId = await requireAuth()

  const recs = await prisma.recurringRevenue.findMany({
    where: { userId, isActive: true },
    include: {
      revenues: {
        select: { period: true },
        orderBy: { period: "asc" },
      },
    },
  })

  const now = new Date()
  const currentPeriod = zonedDateKey(now).slice(0, 7) // mois de Paris (la prod est en UTC)
  let generated = 0

  for (const rec of recs) {
    const existingPeriods = new Set(rec.revenues.map(r => r.period).filter(Boolean))

    // Détermine le mois de départ : le mois de création du récurrent
    const startYear  = rec.createdAt.getFullYear()
    const startMonth = rec.createdAt.getMonth() + 1

    const cursor = new Date(startYear, startMonth - 1, 1)
    const limit  = new Date(now.getFullYear(), now.getMonth(), 1)

    while (cursor <= limit) {
      const period = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`
      if (period > currentPeriod) break

      if (!existingPeriods.has(period)) {
        await prisma.revenue.create({
          data: {
            userId,
            type:              rec.type,
            label:             `${rec.label} — ${cursor.toLocaleDateString("fr-FR", { timeZone: "Europe/Paris", month: "long", year: "numeric" })}`,
            amount:            rec.amount,
            currency:          rec.currency,
            status:            "PENDING",
            paymentMethod:     rec.paymentMethod,
            notes:             rec.notes,
            period,
            recurringRevenueId: rec.id,
            ...inheritedFrom(rec),
          },
        })
        generated++
      }

      cursor.setMonth(cursor.getMonth() + 1)
    }
  }

  if (generated > 0) revalidatePath("/revenus")
  return { generated }
}
