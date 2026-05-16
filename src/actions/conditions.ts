"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"

export async function createConditionsTemplate(
  userId: string,
  data: { name: string; content: string }
) {
  const isFirst = (await prisma.conditionsTemplate.count({ where: { userId } })) === 0
  await prisma.conditionsTemplate.create({
    data: { userId, name: data.name, content: data.content, isDefault: isFirst },
  })
  revalidatePath("/settings")
}

export async function updateConditionsTemplate(
  id: string,
  userId: string,
  data: { name: string; content: string }
) {
  await prisma.conditionsTemplate.updateMany({
    where: { id, userId },
    data: { name: data.name, content: data.content },
  })
  revalidatePath("/settings")
}

export async function deleteConditionsTemplate(id: string, userId: string) {
  await prisma.conditionsTemplate.deleteMany({ where: { id, userId } })
  revalidatePath("/settings")
}

export async function setDefaultConditionsTemplate(id: string, userId: string) {
  await prisma.$transaction([
    prisma.conditionsTemplate.updateMany({ where: { userId }, data: { isDefault: false } }),
    prisma.conditionsTemplate.updateMany({ where: { id, userId }, data: { isDefault: true } }),
  ])
  revalidatePath("/settings")
}
