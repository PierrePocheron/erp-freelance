"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"

export async function createQuickClient(
  userId: string,
  data: { name: string; company?: string; email?: string }
) {
  const client = await prisma.client.create({
    data: {
      userId,
      name: data.name,
      company: data.company || null,
      email: data.email || null,
      type: "PROSPECT",
      source: "OTHER",
      temperature: "COLD",
      priorityScore: 1,
    },
  })
  revalidatePath("/projets")
  revalidatePath("/crm")
  return client
}
