"use server"

import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import type { JobApplicationStatus, JobEventType } from "@/generated/prisma/enums"
import { CLOSED_STATUSES } from "@/components/modules/entretien/status-config"

async function requireAuth() {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Non authentifié")
  return session.user.id
}

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
  competencyDossierValidated?: boolean
  competencyDossierUrl?: string
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
    competencyDossierValidated: data.competencyDossierValidated ?? false,
    competencyDossierUrl: data.competencyDossierUrl?.trim() || null,
    closedAt: CLOSED_STATUSES.includes(status) ? new Date() : null,
  }
}

// ── Candidatures ──────────────────────────────────────────────────────────────

type InitialEventInput = {
  type: JobEventType
  date?: string | null
  title: string
  notes?: string | null
}

export async function createJobApplication(data: ApplicationInput & { initialEvent?: InitialEventInput | null }) {
  const userId = await requireAuth()
  if (!data.companyName.trim()) throw new Error("Le nom de la société est requis")
  if (!data.position.trim()) throw new Error("Le poste est requis")
  const app = await prisma.jobApplication.create({
    data: { userId, ...buildData(data) },
  })
  if (data.initialEvent?.title?.trim()) {
    await prisma.jobApplicationEvent.create({
      data: {
        userId,
        applicationId: app.id,
        type: data.initialEvent.type,
        date: data.initialEvent.date ? new Date(data.initialEvent.date) : new Date(),
        title: data.initialEvent.title.trim(),
        notes: data.initialEvent.notes?.trim() || null,
      },
    })
  }
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
  revalidatePath(`/entretiens/${id}`)
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
  revalidatePath(`/entretiens/${id}`)
  revalidatePath("/")
}

export async function deleteJobApplication(id: string) {
  const userId = await requireAuth()
  await prisma.jobApplication.deleteMany({ where: { id, userId } })
  revalidatePath("/entretiens")
  revalidatePath("/")
  revalidatePath("/calendrier")
}

export async function updateApplicationNotes(id: string, notes: string) {
  const userId = await requireAuth()
  await prisma.jobApplication.updateMany({
    where: { id, userId },
    data: { notes: notes.trim() || null },
  })
  revalidatePath("/entretiens")
  revalidatePath(`/entretiens/${id}`)
}

export async function toggleApplicationPriority(id: string) {
  const userId = await requireAuth()
  const app = await prisma.jobApplication.findFirst({
    where: { id, userId },
    select: { priority: true },
  })
  if (!app) throw new Error("Non autorisé")
  await prisma.jobApplication.updateMany({
    where: { id, userId },
    data: { priority: app.priority > 0 ? 0 : 1 },
  })
  revalidatePath("/entretiens")
  revalidatePath(`/entretiens/${id}`)
  revalidatePath("/")
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
  revalidatePath(`/entretiens/${applicationId}`)
  revalidatePath("/calendrier")
}

export async function deleteApplicationEvent(id: string) {
  const userId = await requireAuth()
  const ev = await prisma.jobApplicationEvent.findFirst({
    where: { id, userId },
    select: { applicationId: true },
  })
  await prisma.jobApplicationEvent.deleteMany({ where: { id, userId } })
  revalidatePath("/entretiens")
  if (ev) revalidatePath(`/entretiens/${ev.applicationId}`)
  revalidatePath("/calendrier")
}

export async function cancelApplicationEvent(id: string) {
  const userId = await requireAuth()
  const ev = await prisma.jobApplicationEvent.findFirst({
    where: { id, userId },
    select: { applicationId: true },
  })
  if (!ev) throw new Error("Non autorisé")
  await prisma.jobApplicationEvent.update({
    where: { id },
    data: { cancelledAt: new Date() },
  })
  revalidatePath("/entretiens")
  revalidatePath(`/entretiens/${ev.applicationId}`)
  revalidatePath("/calendrier")
}

export async function uncancelApplicationEvent(id: string) {
  const userId = await requireAuth()
  const ev = await prisma.jobApplicationEvent.findFirst({
    where: { id, userId },
    select: { applicationId: true },
  })
  if (!ev) throw new Error("Non autorisé")
  await prisma.jobApplicationEvent.update({
    where: { id },
    data: { cancelledAt: null },
  })
  revalidatePath("/entretiens")
  revalidatePath(`/entretiens/${ev.applicationId}`)
  revalidatePath("/calendrier")
}

export async function setEventOutcome(id: string, outcome: string) {
  const userId = await requireAuth()
  const ev = await prisma.jobApplicationEvent.findFirst({
    where: { id, userId },
    select: { applicationId: true },
  })
  if (!ev) throw new Error("Non autorisé")
  await prisma.jobApplicationEvent.update({
    where: { id },
    data: { outcome: outcome.trim() || null, cancelledAt: null },
  })
  revalidatePath("/entretiens")
  revalidatePath(`/entretiens/${ev.applicationId}`)
  revalidatePath("/calendrier")
}

export async function updateApplicationEvent(
  id: string,
  data: { date?: string; type?: JobEventType; title?: string; notes?: string | null }
) {
  const userId = await requireAuth()
  const ev = await prisma.jobApplicationEvent.findFirst({
    where: { id, userId },
    select: { applicationId: true },
  })
  if (!ev) throw new Error("Non autorisé")
  await prisma.jobApplicationEvent.update({
    where: { id },
    data: {
      ...(data.date !== undefined ? { date: new Date(data.date) } : {}),
      ...(data.type !== undefined ? { type: data.type } : {}),
      ...(data.title !== undefined ? { title: data.title?.trim() || "" } : {}),
      ...(data.notes !== undefined ? { notes: data.notes?.trim() || null } : {}),
    },
  })
  revalidatePath("/entretiens")
  revalidatePath(`/entretiens/${ev.applicationId}`)
}

// ── FAQ / réponses-types de préparation d'entretien ─────────────────────────────

export async function getInterviewAnswers() {
  const userId = await requireAuth()
  return prisma.interviewAnswer.findMany({
    where: { userId },
    orderBy: [{ pinned: "desc" }, { sortOrder: "asc" }, { updatedAt: "desc" }],
  })
}

type InterviewAnswerInput = { question: string; answer: string; category?: string | null }

export async function createInterviewAnswer(data: InterviewAnswerInput) {
  const userId = await requireAuth()
  const question = data.question.trim()
  const answer = data.answer.trim()
  if (!question) throw new Error("La question est requise")
  if (!answer) throw new Error("La réponse est requise")
  await prisma.interviewAnswer.create({
    data: { userId, question, answer, category: data.category?.trim() || null },
  })
  revalidatePath("/entretiens/faq")
}

export async function updateInterviewAnswer(id: string, data: InterviewAnswerInput) {
  const userId = await requireAuth()
  const updated = await prisma.interviewAnswer.updateMany({
    where: { id, userId },
    data: {
      question: data.question.trim(),
      answer: data.answer.trim(),
      category: data.category?.trim() || null,
    },
  })
  if (updated.count === 0) throw new Error("Non autorisé")
  revalidatePath("/entretiens/faq")
}

export async function deleteInterviewAnswer(id: string) {
  const userId = await requireAuth()
  await prisma.interviewAnswer.deleteMany({ where: { id, userId } })
  revalidatePath("/entretiens/faq")
}

/** Épingle / désépingle une réponse (remontée en tête de liste). Scoped userId. */
export async function toggleInterviewAnswerPinned(id: string) {
  const userId = await requireAuth()
  const item = await prisma.interviewAnswer.findFirst({ where: { id, userId }, select: { pinned: true } })
  if (!item) throw new Error("Non autorisé")
  await prisma.interviewAnswer.updateMany({ where: { id, userId }, data: { pinned: !item.pinned } })
  revalidatePath("/entretiens/faq")
}
