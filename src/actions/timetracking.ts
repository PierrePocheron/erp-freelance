"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"

export async function startTimer(taskId: string, userId: string, projectId: string) {
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

export async function stopTimer(entryId: string, userId: string, projectId: string) {
  const entry = await prisma.timeEntry.findFirst({
    where: { id: entryId, userId },
  })
  if (!entry) return

  const duration = Math.floor((Date.now() - entry.startedAt.getTime()) / 1000)
  await prisma.timeEntry.update({
    where: { id: entryId },
    data: { endedAt: new Date(), duration },
  })

  revalidatePath(`/projets/${projectId}/dev`)
}

export async function deleteTimeEntry(entryId: string, userId: string, projectId: string) {
  await prisma.timeEntry.delete({ where: { id: entryId, userId } })
  revalidatePath(`/projets/${projectId}/dev`)
}

export async function getRunningTimer(userId: string) {
  return prisma.timeEntry.findFirst({
    where: { userId, endedAt: null },
    include: { task: { select: { id: true, title: true, projectId: true } } },
  })
}
