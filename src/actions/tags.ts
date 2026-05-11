"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"

export async function createTag(userId: string, name: string, color: string) {
  const tag = await prisma.tag.create({
    data: { userId, name: name.trim(), color },
  })
  return tag
}

export async function setProjectTags(projectId: string, tagIds: string[]) {
  await prisma.project.update({
    where: { id: projectId },
    data: { tags: { set: tagIds.map((id) => ({ id })) } },
  })
  revalidatePath(`/projets/${projectId}`)
  revalidatePath("/projets")
}

export async function deleteTag(tagId: string, userId: string) {
  await prisma.tag.delete({ where: { id: tagId, userId } })
  revalidatePath("/projets")
}
