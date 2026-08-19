"use server"

import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

async function requireAuth(): Promise<string> {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Non authentifié")
  return session.user.id
}

function revalidate(platformId?: string) {
  revalidatePath("/investissements")
  if (platformId) revalidatePath(`/investissements/${platformId}`)
}

// ── Plateformes ───────────────────────────────────────────────────────────────

export type PlatformInput = {
  name: string
  type: string // preset (CROWDLENDING…) ou type personnalisé libre
  url?: string | null
  notes?: string | null
}

export async function createPlatform(input: PlatformInput): Promise<string> {
  const userId = await requireAuth()
  const name = input.name.trim()
  if (!name) throw new Error("Nom de plateforme requis")
  const p = await prisma.investmentPlatform.create({
    data: { userId, name, type: input.type.trim() || "AUTRE", url: input.url?.trim() || null, notes: input.notes?.trim() || null },
    select: { id: true },
  })
  revalidate()
  return p.id
}

export async function updatePlatform(id: string, input: PlatformInput): Promise<void> {
  const userId = await requireAuth()
  const name = input.name.trim()
  if (!name) throw new Error("Nom de plateforme requis")
  const { count } = await prisma.investmentPlatform.updateMany({
    where: { id, userId },
    data: { name, type: input.type.trim() || "AUTRE", url: input.url?.trim() || null, notes: input.notes?.trim() || null },
  })
  if (count === 0) throw new Error("Plateforme introuvable")
  revalidate(id)
}

export async function deletePlatform(id: string): Promise<void> {
  const userId = await requireAuth()
  // Les relevés sont supprimés en cascade (FK onDelete: Cascade).
  await prisma.investmentPlatform.deleteMany({ where: { id, userId } })
  revalidate()
}

// ── Relevés (InvestmentEntry) ─────────────────────────────────────────────────

export type EntryInput = {
  capital: number
  contribution?: number
  date?: string | null
  note?: string | null
}

/** Ajoute un relevé (quick-add). Scopé userId via la plateforme (anti-IDOR). */
export async function addEntry(platformId: string, input: EntryInput): Promise<void> {
  const userId = await requireAuth()
  const platform = await prisma.investmentPlatform.findFirst({ where: { id: platformId, userId }, select: { id: true } })
  if (!platform) throw new Error("Plateforme introuvable")

  const capital = Number(input.capital)
  if (!Number.isFinite(capital)) throw new Error("Capital invalide")
  const contribution = Number.isFinite(Number(input.contribution)) ? Number(input.contribution) : 0
  const date = input.date ? new Date(input.date) : new Date()
  if (Number.isNaN(date.getTime())) throw new Error("Date invalide")

  await prisma.investmentEntry.create({
    data: { platformId, capital, contribution, date, note: input.note?.trim() || null },
  })
  revalidate(platformId)
}

/**
 * Ajoute un DÉPÔT (ou retrait) d'argent — dissocié d'un relevé de capital : c'est
 * un flux de trésorerie à sa propre date, sans valorisation (capital null). Scopé
 * userId via la plateforme (anti-IDOR). Un retrait = montant négatif.
 */
export async function addDeposit(platformId: string, input: { amount: number; date?: string | null; note?: string | null }): Promise<void> {
  const userId = await requireAuth()
  const platform = await prisma.investmentPlatform.findFirst({ where: { id: platformId, userId }, select: { id: true } })
  if (!platform) throw new Error("Plateforme introuvable")

  const amount = Number(input.amount)
  if (!Number.isFinite(amount) || amount === 0) throw new Error("Montant invalide")
  const date = input.date ? new Date(input.date) : new Date()
  if (Number.isNaN(date.getTime())) throw new Error("Date invalide")

  await prisma.investmentEntry.create({
    data: { platformId, capital: null, contribution: amount, date, note: input.note?.trim() || null },
  })
  revalidate(platformId)
}

export async function updateEntry(id: string, input: EntryInput): Promise<void> {
  const userId = await requireAuth()
  const entry = await prisma.investmentEntry.findFirst({ where: { id, platform: { userId } }, select: { platformId: true } })
  if (!entry) throw new Error("Relevé introuvable")

  const capital = Number(input.capital)
  if (!Number.isFinite(capital)) throw new Error("Capital invalide")
  const contribution = Number.isFinite(Number(input.contribution)) ? Number(input.contribution) : 0
  const date = input.date ? new Date(input.date) : undefined
  if (date && Number.isNaN(date.getTime())) throw new Error("Date invalide")

  await prisma.investmentEntry.update({
    where: { id },
    data: { capital, contribution, ...(date ? { date } : {}), note: input.note?.trim() || null },
  })
  revalidate(entry.platformId)
}

export async function deleteEntry(id: string): Promise<void> {
  const userId = await requireAuth()
  const entry = await prisma.investmentEntry.findFirst({ where: { id, platform: { userId } }, select: { platformId: true } })
  if (!entry) throw new Error("Relevé introuvable")
  await prisma.investmentEntry.delete({ where: { id } })
  revalidate(entry.platformId)
}
