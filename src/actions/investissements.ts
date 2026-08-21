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

// Période "YYYY-MM" d'une date (heure locale) — clé des rappels de relevé mensuels.
function periodOf(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
}

// Libellé lisible d'une période "YYYY-MM" → « août 2026 ».
function monthLabel(period: string): string {
  const [y, m] = period.split("-").map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString("fr-FR", { month: "long", year: "numeric" })
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
  // Coche automatiquement la sous-tâche « Relevé — <plateforme> » du mois de ce relevé.
  await syncInvestmentReviewProgress(userId, platformId, date)
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

// ── Rappels de relevé mensuels ────────────────────────────────────────────────
// Calqué sur le rappel URSSAF (cf. ensureUrssafReminderTask) : une tâche parent
// datée par mois (→ projetée au calendrier) + une sous-tâche par plateforme,
// générées idempotemment au chargement de l'app. Les sous-tâches se cochent toutes
// seules à l'enregistrement du relevé, la parent se solde quand tout est fait.

/**
 * Crée, si besoin, la tâche de relevé du mois courant (idempotent). Ne fait rien si
 * le rappel est désactivé, si la tâche du mois existe déjà, ou s'il n'y a aucune
 * plateforme. Appelée à chaque chargement de l'app (cf. (app)/layout.tsx).
 */
export async function ensureInvestmentReviewTasks(userId: string, enabled: boolean, day: number): Promise<void> {
  if (!enabled) return
  const now = new Date()
  const period = periodOf(now)

  const existing = await prisma.task.findFirst({
    where: { userId, investmentPeriod: period, parentTaskId: null },
    select: { id: true },
  })
  if (existing) return

  const platforms = await prisma.investmentPlatform.findMany({
    where: { userId },
    orderBy: { sortOrder: "asc" },
    select: { id: true, name: true },
  })
  if (platforms.length === 0) return

  const dueDay = Math.min(Math.max(Math.trunc(day) || 1, 1), 28)
  const dueDate = new Date(now.getFullYear(), now.getMonth(), dueDay, 9, 0, 0)

  const parent = await prisma.task.create({
    data: {
      userId,
      title: `Relevés d'investissement — ${monthLabel(period)}`,
      description:
        "Rappel mensuel : relever le capital de chaque plateforme. Chaque sous-tâche se coche automatiquement quand tu enregistres le relevé de la plateforme dans le module Investissements.",
      dueDate,
      priority: "MEDIUM",
      isGroup: true,
      investmentPeriod: period,
    },
    select: { id: true },
  })

  await prisma.task.createMany({
    data: platforms.map((p, i) => ({
      userId,
      parentTaskId: parent.id,
      title: `Relevé — ${p.name}`,
      order: i,
      priority: "LOW" as const,
      investmentPeriod: period,
      investmentPlatformId: p.id,
    })),
  })
}

/**
 * Coche la sous-tâche « Relevé — <plateforme> » du mois du relevé, et solde la tâche
 * parent si toutes les plateformes du mois sont faites. Appelée après addEntry.
 * Silencieuse si aucune tâche ne correspond (rappel désactivé, mois sans tâche…).
 */
export async function syncInvestmentReviewProgress(userId: string, platformId: string, date: Date): Promise<void> {
  const period = periodOf(date)
  const subtask = await prisma.task.findFirst({
    where: { userId, investmentPeriod: period, investmentPlatformId: platformId, status: { not: "DONE" } },
    select: { id: true, parentTaskId: true },
  })
  if (!subtask) return

  await prisma.task.update({
    where: { id: subtask.id },
    data: { status: "DONE", completedAt: new Date() },
  })

  if (subtask.parentTaskId) {
    const remaining = await prisma.task.count({
      where: { parentTaskId: subtask.parentTaskId, status: { not: "DONE" } },
    })
    if (remaining === 0) {
      await prisma.task.update({
        where: { id: subtask.parentTaskId },
        data: { status: "DONE", completedAt: new Date() },
      })
    }
  }

  revalidatePath("/taches")
  revalidatePath("/calendrier")
}

/** Active/désactive le rappel mensuel de relevé (+ jour d'échéance). Génère la tâche du mois si on active. */
export async function setInvestmentReviewReminder(enabled: boolean, day: number): Promise<void> {
  const userId = await requireAuth()
  const dueDay = Math.min(Math.max(Math.trunc(day) || 1, 1), 28)
  await prisma.userProfile.upsert({
    where: { userId },
    create: { userId, investmentReviewReminder: enabled, investmentReviewDay: dueDay },
    update: { investmentReviewReminder: enabled, investmentReviewDay: dueDay },
  })
  if (enabled) await ensureInvestmentReviewTasks(userId, true, dueDay)
  revalidate()
  revalidatePath("/taches")
  revalidatePath("/calendrier")
}
