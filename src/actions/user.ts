"use server"

import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/require-auth"


export async function ensureSelfClient(_userId: string) {
  const userId = await requireAuth()
  const existing = await prisma.client.findFirst({
    where: { userId, type: "SELF" },
  })
  if (existing) return existing

  return prisma.client.create({
    data: {
      userId,
      type: "SELF",
      name: "Perso",
      source: "OTHER",
      priorityScore: 5,
    },
  })
}
