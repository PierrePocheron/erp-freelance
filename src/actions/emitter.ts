"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { auth } from "@/lib/auth"

async function requireAuth(): Promise<string> {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Non autorisé")
  return session.user.id
}

export type EmitterData = {
  name: string
  companyName?: string | null
  legalForm?: string | null
  siret?: string | null
  vatNumber?: string | null
  address?: string | null
  postalCode?: string | null
  city?: string | null
  country?: string | null
  phone?: string | null
  email?: string | null
  website?: string | null
  bankName?: string | null
  iban?: string | null
  bic?: string | null
  defaultConditions?: string | null
  legalMentions?: string | null
  pdfAccentColor?: string | null
  logoUrl?: string | null
}

const TEXT_FIELDS = [
  "companyName", "legalForm", "siret", "vatNumber", "address", "postalCode",
  "city", "phone", "email", "website", "bankName", "iban", "bic", "defaultConditions",
  "legalMentions", "logoUrl",
] as const

// Normalise un EmitterData en payload Prisma (trim, vide → null).
function toPayload(data: EmitterData): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const k of TEXT_FIELDS) {
    if (k in data) out[k] = (data[k] ?? "")?.toString().trim() || null
  }
  if ("country" in data) out.country = data.country?.trim() || "France"
  if ("pdfAccentColor" in data) out.pdfAccentColor = data.pdfAccentColor?.trim() || "#6366f1"
  return out
}

export async function listEmitters(_userId?: string) {
  const userId = await requireAuth()
  return prisma.emitterProfile.findMany({
    where: { userId },
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
  })
}

export async function getDefaultEmitterId(userId: string): Promise<string | null> {
  const def = await prisma.emitterProfile.findFirst({
    where: { userId, isDefault: true },
    select: { id: true },
  })
  if (def) return def.id
  // Pas de profil par défaut explicite : retomber sur le premier disponible.
  const any = await prisma.emitterProfile.findFirst({ where: { userId }, select: { id: true } })
  return any?.id ?? null
}

export async function createEmitter(data: EmitterData) {
  const userId = await requireAuth()
  const name = data.name?.trim()
  if (!name) throw new Error("Le nom du profil émetteur est requis")

  // Premier profil → forcément par défaut.
  const count = await prisma.emitterProfile.count({ where: { userId } })
  const isDefault = count === 0

  const created = await prisma.emitterProfile.create({
    data: { userId, name, isDefault, ...toPayload(data) } as never,
  })
  revalidatePath("/settings")
  return created
}

export async function updateEmitter(emitterId: string, data: EmitterData) {
  const userId = await requireAuth()
  const existing = await prisma.emitterProfile.findFirst({ where: { id: emitterId, userId }, select: { id: true } })
  if (!existing) throw new Error("Profil émetteur introuvable")

  const clean: Record<string, unknown> = { ...toPayload(data) }
  if (data.name?.trim()) clean.name = data.name.trim()

  await prisma.emitterProfile.update({ where: { id: emitterId, userId }, data: clean as never })
  revalidatePath("/settings")
}

export async function setDefaultEmitter(emitterId: string) {
  const userId = await requireAuth()
  const target = await prisma.emitterProfile.findFirst({ where: { id: emitterId, userId }, select: { id: true } })
  if (!target) throw new Error("Profil émetteur introuvable")

  await prisma.$transaction([
    prisma.emitterProfile.updateMany({ where: { userId, isDefault: true }, data: { isDefault: false } }),
    prisma.emitterProfile.update({ where: { id: emitterId, userId }, data: { isDefault: true } }),
  ])
  revalidatePath("/settings")
}

export async function deleteEmitter(emitterId: string) {
  const userId = await requireAuth()
  const target = await prisma.emitterProfile.findFirst({
    where: { id: emitterId, userId },
    select: { id: true, isDefault: true },
  })
  if (!target) throw new Error("Profil émetteur introuvable")

  // Les devis/factures se détachent (emitterProfileId → null via FK SET NULL).
  await prisma.emitterProfile.delete({ where: { id: emitterId, userId } })

  // Si on a supprimé le profil par défaut, en promouvoir un autre s'il en reste.
  if (target.isDefault) {
    const next = await prisma.emitterProfile.findFirst({ where: { userId }, orderBy: { createdAt: "asc" }, select: { id: true } })
    if (next) await prisma.emitterProfile.update({ where: { id: next.id }, data: { isDefault: true } })
  }
  revalidatePath("/settings")
}
