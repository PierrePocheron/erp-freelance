"use server"

import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import type { JobApplicationStatus, JobEventType } from "@/generated/prisma/enums"

async function requireAuth() {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Non authentifié")
  return session.user.id
}

// Statuts considérés comme « clos » (sortis du pipeline actif).
const CLOSED_STATUSES: JobApplicationStatus[] = ["ACCEPTED", "REJECTED", "WITHDRAWN", "GHOSTED"]

type ApplicationInput = {
  companyName: string
  companyId?: string | null
  position: string
  location?: string
  workMode?: string
  status?: JobApplicationStatus
  source?: string
  url?: string
  salaryMin?: number | null
  salaryMax?: number | null
  salaryNote?: string
  notes?: string
  contactId?: string | null
  appliedAt?: string | null
  nextActionAt?: string | null
  nextActionLabel?: string
}

function buildData(data: ApplicationInput) {
  const status = data.status ?? "WISHLIST"
  return {
    companyName: data.companyName.trim(),
    companyId: data.companyId || null,
    position: data.position.trim(),
    location: data.location?.trim() || null,
    workMode: data.workMode?.trim() || null,
    status,
    source: data.source?.trim() || null,
    url: data.url?.trim() || null,
    salaryMin: data.salaryMin ?? null,
    salaryMax: data.salaryMax ?? null,
    salaryNote: data.salaryNote?.trim() || null,
    notes: data.notes?.trim() || null,
    contactId: data.contactId || null,
    appliedAt: data.appliedAt ? new Date(data.appliedAt) : null,
    nextActionAt: data.nextActionAt ? new Date(data.nextActionAt) : null,
    nextActionLabel: data.nextActionLabel?.trim() || null,
    closedAt: CLOSED_STATUSES.includes(status) ? new Date() : null,
  }
}

// ── Candidatures ──────────────────────────────────────────────────────────────

export async function createJobApplication(data: ApplicationInput) {
  const userId = await requireAuth()
  if (!data.companyName.trim()) throw new Error("Le nom de la société est requis")
  if (!data.position.trim()) throw new Error("Le poste est requis")
  const app = await prisma.jobApplication.create({
    data: { userId, ...buildData(data) },
  })
  revalidatePath("/entretiens")
  revalidatePath("/")
  revalidatePath("/calendrier")
  return app
}

export async function updateJobApplication(id: string, data: ApplicationInput) {
  const userId = await requireAuth()
  // Préserve closedAt si le statut clos n'a pas changé
  const existing = await prisma.jobApplication.findFirst({
    where: { id, userId },
    select: { status: true, closedAt: true },
  })
  const built = buildData(data)
  // Si déjà clos et reste clos, on garde la date de clôture initiale
  if (existing && CLOSED_STATUSES.includes(existing.status) && CLOSED_STATUSES.includes(built.status) && existing.closedAt) {
    built.closedAt = existing.closedAt
  }
  await prisma.jobApplication.updateMany({ where: { id, userId }, data: built })
  revalidatePath("/entretiens")
  revalidatePath("/")
  revalidatePath("/calendrier")
}

/** Change uniquement le statut (drag-drop / menu rapide). */
export async function updateApplicationStatus(id: string, status: JobApplicationStatus) {
  const userId = await requireAuth()
  const existing = await prisma.jobApplication.findFirst({
    where: { id, userId },
    select: { closedAt: true },
  })
  await prisma.jobApplication.updateMany({
    where: { id, userId },
    data: {
      status,
      closedAt: CLOSED_STATUSES.includes(status) ? (existing?.closedAt ?? new Date()) : null,
    },
  })
  revalidatePath("/entretiens")
  revalidatePath("/")
}

export async function deleteJobApplication(id: string) {
  const userId = await requireAuth()
  await prisma.jobApplication.deleteMany({ where: { id, userId } })
  revalidatePath("/entretiens")
  revalidatePath("/")
  revalidatePath("/calendrier")
}

// ── Événements (points de contact) ────────────────────────────────────────────

export async function addApplicationEvent(
  applicationId: string,
  data: { date: string; type: JobEventType; title: string; notes?: string }
) {
  const userId = await requireAuth()
  const app = await prisma.jobApplication.findFirst({
    where: { id: applicationId, userId },
    select: { id: true },
  })
  if (!app) throw new Error("Non autorisé")
  await prisma.jobApplicationEvent.create({
    data: {
      userId,
      applicationId,
      date: new Date(data.date),
      type: data.type,
      title: data.title.trim(),
      notes: data.notes?.trim() || null,
    },
  })
  revalidatePath("/entretiens")
  revalidatePath("/calendrier")
}

export async function deleteApplicationEvent(id: string) {
  const userId = await requireAuth()
  await prisma.jobApplicationEvent.deleteMany({ where: { id, userId } })
  revalidatePath("/entretiens")
  revalidatePath("/calendrier")
}
