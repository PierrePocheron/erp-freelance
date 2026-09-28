"use server"

import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/require-auth"
import { revalidatePath } from "next/cache"


export async function markNotificationRead(notificationId: string) {
  const userId = await requireAuth()
  await prisma.notification.updateMany({
    where: { id: notificationId, userId },
    data: { isRead: true },
  })
  revalidatePath("/")
}

export async function markAllNotificationsRead() {
  const userId = await requireAuth()
  await prisma.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true },
  })
  revalidatePath("/")
}
