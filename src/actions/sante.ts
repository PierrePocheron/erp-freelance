"use server"

import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/require-auth"
import type {
  HealthEventType,
  PractitionerType,
  ReimbursementSource,
  ReimbursementStatus,
} from "@/generated/prisma/enums"


// ── Health Events (blessures/maladies) ────────────────────────────────────────

// Les ids de rattachement viennent de l'appelant : on refuse ceux d'un autre
// compte, sinon une consultation pouvait se greffer sur l'événement santé
// d'autrui (et un remboursement sur sa consultation).
async function ownedHealthEventId(userId: string, id: string | null | undefined) {
  if (!id) return null
  const found = await prisma.healthEvent.findFirst({ where: { id, userId }, select: { id: true } })
  if (!found) throw new Error("Événement santé introuvable")
  return found.id
}

async function ownedConsultationId(userId: string, id: string | null | undefined) {
  if (!id) return null
  const found = await prisma.healthConsultation.findFirst({ where: { id, userId }, select: { id: true } })
  if (!found) throw new Error("Consultation introuvable")
  return found.id
}

export async function createHealthEvent(data: {
  date: string
  type: HealthEventType
  title: string
  description?: string
  bodyPart?: string
}) {
  const userId = await requireAuth()
  await prisma.healthEvent.create({
    data: {
      userId,
      date: new Date(data.date),
      type: data.type,
      title: data.title.trim(),
      description: data.description?.trim() || null,
      bodyPart: data.bodyPart?.trim() || null,
    },
  })
  revalidatePath("/sante")
}

export async function updateHealthEvent(
  id: string,
  data: {
    date: string
    type: HealthEventType
    title: string
    description?: string
    bodyPart?: string
    resolvedAt?: string | null
  }
) {
  const userId = await requireAuth()
  await prisma.healthEvent.updateMany({
    where: { id, userId },
    data: {
      date: new Date(data.date),
      type: data.type,
      title: data.title.trim(),
      description: data.description?.trim() || null,
      bodyPart: data.bodyPart?.trim() || null,
      resolvedAt: data.resolvedAt ? new Date(data.resolvedAt) : null,
    },
  })
  revalidatePath("/sante")
}

export async function resolveHealthEvent(id: string, resolvedAt?: string) {
  const userId = await requireAuth()
  await prisma.healthEvent.updateMany({
    where: { id, userId },
    data: { resolvedAt: resolvedAt ? new Date(resolvedAt) : new Date() },
  })
  revalidatePath("/sante")
}

export async function deleteHealthEvent(id: string) {
  const userId = await requireAuth()
  await prisma.healthEvent.deleteMany({ where: { id, userId } })
  revalidatePath("/sante")
}

// ── Consultations ─────────────────────────────────────────────────────────────

export async function createConsultation(data: {
  date: string
  practitionerName: string
  practitionerType: PractitionerType
  title: string
  notes?: string
  cost?: number | null
  hasDocument?: boolean
  documentRef?: string
  healthEventId?: string | null
}) {
  const userId = await requireAuth()
  await prisma.healthConsultation.create({
    data: {
      userId,
      date: new Date(data.date),
      practitionerName: data.practitionerName.trim(),
      practitionerType: data.practitionerType,
      title: data.title.trim(),
      notes: data.notes?.trim() || null,
      cost: data.cost ?? null,
      hasDocument: data.hasDocument ?? false,
      documentRef: data.documentRef?.trim() || null,
      healthEventId: await ownedHealthEventId(userId, data.healthEventId),
    },
  })
  revalidatePath("/sante")
}

export async function updateConsultation(
  id: string,
  data: {
    date: string
    practitionerName: string
    practitionerType: PractitionerType
    title: string
    notes?: string
    cost?: number | null
    hasDocument?: boolean
    documentRef?: string
    healthEventId?: string | null
  }
) {
  const userId = await requireAuth()
  await prisma.healthConsultation.updateMany({
    where: { id, userId },
    data: {
      date: new Date(data.date),
      practitionerName: data.practitionerName.trim(),
      practitionerType: data.practitionerType,
      title: data.title.trim(),
      notes: data.notes?.trim() || null,
      cost: data.cost ?? null,
      hasDocument: data.hasDocument ?? false,
      documentRef: data.documentRef?.trim() || null,
      healthEventId: await ownedHealthEventId(userId, data.healthEventId),
    },
  })
  revalidatePath("/sante")
}

export async function deleteConsultation(id: string) {
  const userId = await requireAuth()
  await prisma.healthConsultation.deleteMany({ where: { id, userId } })
  revalidatePath("/sante")
}

// ── Remboursements ────────────────────────────────────────────────────────────

export async function createReimbursement(data: {
  amount: number
  source: ReimbursementSource
  status: ReimbursementStatus
  expectedDate?: string | null
  receivedAt?: string | null
  notes?: string
  consultationId?: string | null
}) {
  const userId = await requireAuth()
  await prisma.healthReimbursement.create({
    data: {
      userId,
      amount: data.amount,
      source: data.source,
      status: data.status,
      expectedDate: data.expectedDate ? new Date(data.expectedDate) : null,
      receivedAt: data.status === "RECEIVED" && data.receivedAt ? new Date(data.receivedAt) : null,
      notes: data.notes?.trim() || null,
      consultationId: await ownedConsultationId(userId, data.consultationId),
    },
  })
  revalidatePath("/sante")
  revalidatePath("/")
}

export async function updateReimbursement(
  id: string,
  data: {
    amount: number
    source: ReimbursementSource
    status: ReimbursementStatus
    expectedDate?: string | null
    receivedAt?: string | null
    notes?: string
    consultationId?: string | null
  }
) {
  const userId = await requireAuth()
  await prisma.healthReimbursement.updateMany({
    where: { id, userId },
    data: {
      amount: data.amount,
      source: data.source,
      status: data.status,
      expectedDate: data.expectedDate ? new Date(data.expectedDate) : null,
      receivedAt: data.status === "RECEIVED" && data.receivedAt ? new Date(data.receivedAt) : null,
      notes: data.notes?.trim() || null,
      consultationId: await ownedConsultationId(userId, data.consultationId),
    },
  })
  revalidatePath("/sante")
  revalidatePath("/")
}

/** Marque un remboursement en attente comme reçu (date du jour par défaut). */
export async function markReimbursementReceived(id: string, receivedAt?: string) {
  const userId = await requireAuth()
  await prisma.healthReimbursement.updateMany({
    where: { id, userId },
    data: {
      status: "RECEIVED",
      receivedAt: receivedAt ? new Date(receivedAt) : new Date(),
    },
  })
  revalidatePath("/sante")
  revalidatePath("/")
}

export async function deleteReimbursement(id: string) {
  const userId = await requireAuth()
  await prisma.healthReimbursement.deleteMany({ where: { id, userId } })
  revalidatePath("/sante")
  revalidatePath("/")
}
