"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { auth } from "@/lib/auth"

async function requireAuth(): Promise<string> {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Non autorisé")
  return session.user.id
}

export async function createConditionsTemplate(
  _userId: string,
  data: { name: string; content: string }
) {
  const userId = await requireAuth()
  const isFirst = (await prisma.conditionsTemplate.count({ where: { userId } })) === 0
  await prisma.conditionsTemplate.create({
    data: { userId, name: data.name, content: data.content, isDefault: isFirst },
  })
  revalidatePath("/settings")
}

export async function updateConditionsTemplate(
  id: string,
  _userId: string,
  data: { name: string; content: string }
) {
  const userId = await requireAuth()
  await prisma.conditionsTemplate.updateMany({
    where: { id, userId },
    data: { name: data.name, content: data.content },
  })
  revalidatePath("/settings")
}

export async function deleteConditionsTemplate(id: string, _userId: string) {
  const userId = await requireAuth()
  await prisma.conditionsTemplate.deleteMany({ where: { id, userId } })
  revalidatePath("/settings")
}

export async function setDefaultConditionsTemplate(id: string, _userId: string) {
  const userId = await requireAuth()
  await prisma.$transaction([
    prisma.conditionsTemplate.updateMany({ where: { userId }, data: { isDefault: false } }),
    prisma.conditionsTemplate.updateMany({ where: { id, userId }, data: { isDefault: true } }),
  ])
  revalidatePath("/settings")
}
