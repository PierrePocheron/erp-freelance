"use server"

import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { revalidatePath } from "next/cache"

// ── Revenus ────────────────────────────────────────────────────────────────────

export async function getRevenues(params?: {
  year?: number
  month?: number
  type?: string
}) {
  const session = await auth()
  const userId = session!.user.id

  const where: Record<string, unknown> = { userId }

  if (params?.type) where.type = params.type

  if (params?.year !== undefined && params?.month !== undefined) {
    const m = String(params.month).padStart(2, "0")
    where.period = `${params.year}-${m}`
  } else if (params?.year !== undefined) {
    where.period = { startsWith: `${params.year}-` }
  }

  return prisma.revenue.findMany({
    where,
    orderBy: [{ period: "desc" }, { createdAt: "desc" }],
    include: { recurringRevenue: { select: { id: true, label: true } } },
  })
}

export async function createRevenue(data: {
  type: string
  label: string
  amount: number
  currency?: string
  status?: string
  receivedAt?: Date | null
  paymentMethod?: string | null
  notes?: string | null
  period?: string | null
  recurringRevenueId?: string | null
  companyId?: string | null
  clientId?: string | null
  projectId?: string | null
}): Promise<{ error?: string; id?: string }> {
  const session = await auth()
  const userId = session!.user.id

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
        paymentMethod:      data.paymentMethod ?? null,
        notes:              data.notes ?? null,
        period:             data.period ?? null,
        recurringRevenueId: data.recurringRevenueId ?? null,
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
    paymentMethod?: string | null
    notes?: string | null
    period?: string | null
    companyId?: string | null
    clientId?: string | null
    projectId?: string | null
  }
): Promise<{ error?: string }> {
  const session = await auth()
  const userId = session!.user.id

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
      ...(data.paymentMethod !== undefined ? { paymentMethod: data.paymentMethod }  : {}),
      ...(data.notes !== undefined         ? { notes: data.notes }                  : {}),
      ...(data.period !== undefined        ? { period: data.period }                : {}),
      ...(data.companyId !== undefined     ? { companyId: data.companyId }          : {}),
      ...(data.clientId !== undefined      ? { clientId: data.clientId }            : {}),
      ...(data.projectId !== undefined     ? { projectId: data.projectId }          : {}),
    },
  })
  revalidatePath("/revenus")
  return {}
}

/** Marque un revenu comme reçu avec la date + moyen de paiement. */
export async function markRevenueReceived(
  id: string,
  receivedAt: Date,
  paymentMethod: string
): Promise<{ error?: string }> {
  const session = await auth()
  const userId = session!.user.id

  const existing = await prisma.revenue.findFirst({ where: { id, userId } })
  if (!existing) return { error: "Revenu introuvable" }

  await prisma.revenue.update({
    where: { id },
    data: { status: "RECEIVED", receivedAt, paymentMethod },
  })
  revalidatePath("/revenus")
  return {}
}

export async function deleteRevenue(id: string): Promise<{ error?: string }> {
  const session = await auth()
  const userId = session!.user.id

  const existing = await prisma.revenue.findFirst({ where: { id, userId } })
  if (!existing) return { error: "Revenu introuvable" }

  await prisma.revenue.delete({ where: { id } })
  revalidatePath("/revenus")
  return {}
}

// ── Revenus récurrents ─────────────────────────────────────────────────────────

export async function getRecurringRevenues() {
  const session = await auth()
  const userId = session!.user.id

  return prisma.recurringRevenue.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { revenues: true } } },
  })
}

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
}): Promise<{ error?: string; id?: string }> {
  const session = await auth()
  const userId = session!.user.id

  if (!data.label.trim()) return { error: "Le libellé est requis" }
  if (!data.amount || data.amount <= 0) return { error: "Le montant doit être positif" }

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
  }
): Promise<{ error?: string }> {
  const session = await auth()
  const userId = session!.user.id

  const existing = await prisma.recurringRevenue.findFirst({ where: { id, userId } })
  if (!existing) return { error: "Modèle récurrent introuvable" }

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
    },
  })
  revalidatePath("/revenus")
  return {}
}

export async function deleteRecurringRevenue(id: string): Promise<{ error?: string }> {
  const session = await auth()
  const userId = session!.user.id

  const existing = await prisma.recurringRevenue.findFirst({ where: { id, userId } })
  if (!existing) return { error: "Modèle récurrent introuvable" }

  await prisma.recurringRevenue.delete({ where: { id } })
  revalidatePath("/revenus")
  return {}
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
  const session = await auth()
  const userId = session!.user.id

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
      label:             `${rec.label} — ${new Date(year, month - 1).toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}`,
      amount:            rec.amount,
      currency:          rec.currency,
      status:            "PENDING",
      paymentMethod:     rec.paymentMethod,
      notes:             rec.notes,
      period,
      recurringRevenueId: rec.id,
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
  const session = await auth()
  const userId = session!.user.id

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
  const currentPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
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
            label:             `${rec.label} — ${cursor.toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}`,
            amount:            rec.amount,
            currency:          rec.currency,
            status:            "PENDING",
            paymentMethod:     rec.paymentMethod,
            notes:             rec.notes,
            period,
            recurringRevenueId: rec.id,
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
