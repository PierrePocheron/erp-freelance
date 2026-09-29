"use server"

import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/require-auth"


export async function ensureSelfClient(_userId: string) {
  const userId = await requireAuth()
  const existing = await prisma.client.findFirst({
    where: { userId, type: "SELF" },
  })
  if (existing) return existing

  // Deux rendus du layout en parallèle (préchargement Next) lisaient « rien » et créaient
  // deux contacts « Perso » (#32) : verrou transactionnel par utilisateur + relecture.
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`self-client:${userId}`}))`
    const again = await tx.client.findFirst({ where: { userId, type: "SELF" } })
    if (again) return again
    return tx.client.create({
      data: {
        userId,
        type: "SELF",
        name: "Perso",
        source: "OTHER",
        priorityScore: 5,
      },
    })
  })
}
