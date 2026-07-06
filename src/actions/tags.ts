"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { auth } from "@/lib/auth"

async function requireAuth(): Promise<string> {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Non autorisé")
  return session.user.id
}

const DEFAULT_TAGS = [
  { name: "Urgent",           color: "#ef4444" },
  { name: "Client important", color: "#f97316" },
  { name: "R&D / Perso",      color: "#8b5cf6" },
  { name: "Famille",          color: "#ec4899" },
  { name: "En pause",         color: "#64748b" },
]

/** Provisionne un set de tags de base au premier usage — évite de partir d'une liste vide. */
export async function getOrCreateDefaultTags(): Promise<{ id: string; name: string; color: string }[]> {
  const userId = await requireAuth()
  const existing = await prisma.tag.findMany({
    where: { userId },
    orderBy: { name: "asc" },
    select: { id: true, name: true, color: true },
  })
  if (existing.length > 0) return existing

  await prisma.tag.createMany({
    data: DEFAULT_TAGS.map(t => ({ userId, name: t.name, color: t.color })),
    skipDuplicates: true,
  })
  return prisma.tag.findMany({
    where: { userId },
    orderBy: { name: "asc" },
    select: { id: true, name: true, color: true },
  })
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
