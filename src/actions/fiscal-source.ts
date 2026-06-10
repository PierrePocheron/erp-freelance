"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { auth } from "@/lib/auth"
import type { FiscalBucket } from "@/generated/prisma/enums"

async function requireAuth(): Promise<string> {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Non autorisé")
  return session.user.id
}

// ── CRUD FiscalSource ──────────────────────────────────────────────────────────

export async function listFiscalSources() {
  const userId = await requireAuth()
  return prisma.fiscalSource.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
    include: {
      emitterProfiles: { select: { id: true, name: true, companyName: true } },
      _count: { select: { revenues: true } },
    },
  })
}

export async function createFiscalSource(data: {
  name: string
  bucket: string
  color?: string
  notes?: string
}) {
  const userId = await requireAuth()
  const name = data.name.trim()
  if (!name) throw new Error("Le nom de la source est requis")

  const source = await prisma.fiscalSource.create({
    data: {
      userId,
      name,
      bucket: data.bucket as FiscalBucket,
      color:  data.color?.trim() || "#6366f1",
      notes:  data.notes?.trim() || null,
    },
  })
  revalidatePath("/settings")
  revalidatePath("/revenus")
  return source
}

export async function updateFiscalSource(
  id: string,
  data: {
    name?: string
    bucket?: string
    color?: string
    notes?: string | null
    isActive?: boolean
  }
) {
  const userId = await requireAuth()
  const existing = await prisma.fiscalSource.findFirst({ where: { id, userId } })
  if (!existing) throw new Error("Source fiscale introuvable")

  await prisma.fiscalSource.update({
    where: { id },
    data: {
      ...(data.name    !== undefined ? { name:     data.name.trim() }                : {}),
      ...(data.bucket  !== undefined ? { bucket:   data.bucket as FiscalBucket }     : {}),
      ...(data.color   !== undefined ? { color:    data.color?.trim() || "#6366f1" } : {}),
      ...(data.notes   !== undefined ? { notes:    data.notes?.trim() || null }      : {}),
      ...(data.isActive !== undefined ? { isActive: data.isActive }                  : {}),
    },
  })
  revalidatePath("/settings")
  revalidatePath("/revenus")
}

export async function deleteFiscalSource(id: string) {
  const userId = await requireAuth()
  const existing = await prisma.fiscalSource.findFirst({ where: { id, userId } })
  if (!existing) throw new Error("Source fiscale introuvable")

  // Les revenues se détachent (fiscalSourceId → null via FK SET NULL)
  // Les emitterProfiles se détachent aussi
  await prisma.fiscalSource.delete({ where: { id } })
  revalidatePath("/settings")
  revalidatePath("/revenus")
}

// Lie un EmitterProfile à une FiscalSource (ex : Pedro Dev AE ↔ source AE_URSSAF)
export async function linkEmitterToFiscalSource(
  emitterProfileId: string,
  fiscalSourceId: string | null
) {
  const userId = await requireAuth()
  const emitter = await prisma.emitterProfile.findFirst({ where: { id: emitterProfileId, userId } })
  if (!emitter) throw new Error("Profil émetteur introuvable")

  if (fiscalSourceId) {
    const source = await prisma.fiscalSource.findFirst({ where: { id: fiscalSourceId, userId } })
    if (!source) throw new Error("Source fiscale introuvable")
  }

  await prisma.emitterProfile.update({
    where: { id: emitterProfileId },
    data:  { fiscalSourceId },
  })
  revalidatePath("/settings")
}
