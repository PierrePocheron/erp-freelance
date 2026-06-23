"use server"

import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import type {
  HealthEventType,
  PractitionerType,
  ReimbursementSource,
  ReimbursementStatus,
} from "@/generated/prisma/enums"

async function requireAuth() {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Non authentifié")
  return session.user.id
}

// ── Health Events (blessures/maladies) ────────────────────────────────────────

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
      healthEventId: data.healthEventId || null,
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
      healthEventId: data.healthEventId || null,
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
      consultationId: data.consultationId || null,
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
      consultationId: data.consultationId || null,
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
