"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { auth } from "@/lib/auth"

async function requireAuth(): Promise<string> {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Non autorisé")
  return session.user.id
}

export async function createTag(_userId: string, name: string, color: string) {
  const userId = await requireAuth()
  const tag = await prisma.tag.create({
    data: { userId, name: name.trim(), color },
  })
  return tag
}

export async function setProjectTags(projectId: string, tagIds: string[]) {
  const userId = await requireAuth()
  const proj = await prisma.project.findFirst({ where: { id: projectId, userId }, select: { id: true } })
  if (!proj) throw new Error("Projet introuvable")
  await prisma.project.update({
    where: { id: projectId },
    data: { tags: { set: tagIds.map((id) => ({ id })) } },
  })
  revalidatePath(`/projets/${projectId}`)
  revalidatePath("/projets")
}

export async function deleteTag(tagId: string, _userId: string) {
  const userId = await requireAuth()
  await prisma.tag.delete({ where: { id: tagId, userId } })
  revalidatePath("/projets")
}
