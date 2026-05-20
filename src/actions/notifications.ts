"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { auth } from "@/lib/auth"

async function requireAuth(): Promise<string> {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Non autorisé")
  return session.user.id
}

export async function markNotificationRead(notificationId: string, _userId: string) {
  const userId = await requireAuth()
  await prisma.notification.updateMany({
    where: { id: notificationId, userId },
    data: { isRead: true },
  })
  revalidatePath("/")
}

export async function markAllNotificationsRead(_userId: string) {
  const userId = await requireAuth()
  await prisma.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true },
  })
  revalidatePath("/")
}
