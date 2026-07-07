"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { auth } from "@/lib/auth"

async function requireAuth(): Promise<string> {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Non autorisé")
  return session.user.id
}

export async function startTimer(taskId: string, _userId: string, projectId: string) {
  const userId = await requireAuth()
  // Arrêter tout chrono en cours pour cet utilisateur
  const running = await prisma.timeEntry.findFirst({
    where: { userId, endedAt: null },
  })
  if (running) {
    const duration = Math.floor((Date.now() - running.startedAt.getTime()) / 1000)
    await prisma.timeEntry.update({
      where: { id: running.id },
      data: { endedAt: new Date(), duration },
    })
  }

  const entry = await prisma.timeEntry.create({
    data: { taskId, userId, startedAt: new Date() },
  })

  revalidatePath(`/projets/${projectId}/dev`)
  return entry
}

export async function stopTimer(entryId: string, _userId: string, projectId: string | null) {
  const userId = await requireAuth()
  const entry = await prisma.timeEntry.findFirst({
    where: { id: entryId, userId },
  })
  if (!entry) return

  const duration = Math.floor((Date.now() - entry.startedAt.getTime()) / 1000)
  await prisma.timeEntry.update({
    where: { id: entryId },
    data: { endedAt: new Date(), duration },
  })

  if (projectId) revalidatePath(`/projets/${projectId}/dev`)
  revalidatePath("/taches")
}

export async function deleteTimeEntry(entryId: string, _userId: string, projectId: string) {
  const userId = await requireAuth()
  await prisma.timeEntry.delete({ where: { id: entryId, userId } })
  revalidatePath(`/projets/${projectId}/dev`)
}

/** Saisie manuelle d'une session déjà passée (pas de chrono en direct). */
export async function createManualTimeEntry(
  taskId: string,
  projectId: string,
  startedAt: Date,
  endedAt: Date,
  note?: string | null
): Promise<{ error?: string }> {
  const userId = await requireAuth()
  if (endedAt <= startedAt) return { error: "L'heure de fin doit être après l'heure de début" }

  const task = await prisma.task.findFirst({
    where: { id: taskId, OR: [{ userId }, { project: { userId } }] },
    select: { id: true },
  })
  if (!task) return { error: "Tâche introuvable" }

  const duration = Math.round((endedAt.getTime() - startedAt.getTime()) / 1000)
  await prisma.timeEntry.create({
    data: { taskId, userId, startedAt, endedAt, duration, note: note?.trim() || null },
  })

  revalidatePath(`/projets/${projectId}/temps`)
  revalidatePath(`/projets/${projectId}/dev`)
  return {}
}

export async function getRunningTimer(_userId: string) {
  const userId = await requireAuth()
  return prisma.timeEntry.findFirst({
    where: { userId, endedAt: null },
    include: { task: { select: { id: true, title: true, projectId: true } } },
  })
}
