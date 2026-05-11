"use server"

import { prisma } from "@/lib/prisma"

export async function ensureSelfClient(userId: string) {
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
      temperature: "HOT",
      priorityScore: 5,
    },
  })
}
