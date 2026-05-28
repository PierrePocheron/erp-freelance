"use server"

import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { revalidatePath } from "next/cache"
import {
  getGoogleAccessToken,
  hasCalendarScope,
  fetchGoogleEvents,
  type SyncResult,
} from "@/lib/google-calendar"

// ─── Types locaux (jusqu'à ce que npx prisma generate soit relancé) ─────────

export type CalendarCategory = {
  id: string
  userId: string
  name: string
  color: string
  isDefault: boolean
  createdAt: Date
}

// Accès Prisma en attendant la régénération du client
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any

// ─── Catégories par défaut ───────────────────────────────────────────────────

const DEFAULT_CATEGORIES = [
  { name: "Tâches",          color: "#6366f1", isDefault: true }, // indigo
  { name: "Facturation",     color: "#10b981", isDefault: true }, // emerald
  { name: "Jalons",          color: "#f59e0b", isDefault: true }, // amber
  { name: "Renouvellements", color: "#f97316", isDefault: true }, // orange
  { name: "Manuelle",        color: "#8b5cf6", isDefault: true }, // violet
] as const

/**
 * Récupère les catégories de l'utilisateur.
 * Si aucune n'existe, crée les catégories par défaut automatiquement.
 */
export async function getOrCreateDefaultCategories(): Promise<CalendarCategory[]> {
  const session = await auth()
  const userId = session!.user.id

  const existing: CalendarCategory[] = await db.calendarCategory.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
  })

  if (existing.length > 0) return existing

  // Création automatique des catégories par défaut
  await db.calendarCategory.createMany({
    data: DEFAULT_CATEGORIES.map((c) => ({
      id: crypto.randomUUID(),
      userId,
      name: c.name,
      color: c.color,
      isDefault: c.isDefault,
    })),
    skipDuplicates: true,
  })

  return db.calendarCategory.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
  })
}

/**
 * Crée une catégorie personnalisée.
 */
export async function createCalendarCategory(data: {
  name: string
  color: string
}): Promise<{ error?: string; category?: CalendarCategory }> {
  const session = await auth()
  const userId = session!.user.id

  if (!data.name.trim()) return { error: "Le nom est requis" }

  try {
    const category: CalendarCategory = await db.calendarCategory.create({
      data: {
        id: crypto.randomUUID(),
        userId,
        name: data.name.trim(),
        color: data.color,
        isDefault: false,
      },
    })
    revalidatePath("/calendrier")
    return { category }
  } catch {
    return { error: "Ce nom de catégorie existe déjà" }
  }
}

/**
 * Supprime une catégorie (seulement si elle n'est pas par défaut).
 */
export async function deleteCalendarCategory(categoryId: string): Promise<void> {
  const session = await auth()
  const userId = session!.user.id

  await db.calendarCategory.delete({
    where: { id: categoryId, userId, isDefault: false },
  })
  revalidatePath("/calendrier")
}

// ─── Événements calendrier ───────────────────────────────────────────────────

export type CalendarEventFull = {
  id: string
  userId: string
  title: string
  description: string | null
  startDate: Date
  endDate: Date | null
  allDay: boolean
  sourceType: string
  sourceId: string | null
  categoryId: string | null
  createdAt: Date
  updatedAt: Date
  category: CalendarCategory | null
}

export async function getCalendarEvents(params?: {
  from?: Date
  to?: Date
}): Promise<CalendarEventFull[]> {
  const session = await auth()
  const userId = session!.user.id

  const where: Record<string, unknown> = { userId }
  if (params?.from || params?.to) {
    where.startDate = {
      ...(params.from ? { gte: params.from } : {}),
      ...(params.to ? { lte: params.to } : {}),
    }
  }

  return db.calendarEvent.findMany({
    where,
    include: { category: true },
    orderBy: { startDate: "asc" },
  })
}

export async function createCalendarEvent(data: {
  title: string
  description?: string
  startDate: Date
  endDate?: Date
  allDay?: boolean
  categoryId?: string
}): Promise<{ error?: string; event?: CalendarEventFull }> {
  const session = await auth()
  const userId = session!.user.id

  if (!data.title.trim()) return { error: "Le titre est requis" }

  const event: CalendarEventFull = await db.calendarEvent.create({
    data: {
      userId,
      title: data.title.trim(),
      description: data.description ?? null,
      startDate: data.startDate,
      endDate: data.endDate ?? null,
      allDay: data.allDay ?? false,
      sourceType: "MANUAL",
      categoryId: data.categoryId ?? null,
    },
    include: { category: true },
  })

  revalidatePath("/calendrier")
  return { event }
}

export async function updateCalendarEvent(
  eventId: string,
  data: {
    title?: string
    description?: string | null
    startDate?: Date
    endDate?: Date | null
    allDay?: boolean
    categoryId?: string | null
  }
): Promise<void> {
  const session = await auth()
  const userId = session!.user.id

  await db.calendarEvent.update({
    where: { id: eventId, userId },
    data: {
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.description !== undefined ? { description: data.description } : {}),
      ...(data.startDate !== undefined ? { startDate: data.startDate } : {}),
      ...(data.endDate !== undefined ? { endDate: data.endDate } : {}),
      ...(data.allDay !== undefined ? { allDay: data.allDay } : {}),
      ...(data.categoryId !== undefined ? { categoryId: data.categoryId } : {}),
    },
  })

  revalidatePath("/calendrier")
}

export async function deleteCalendarEvent(eventId: string): Promise<void> {
  const session = await auth()
  const userId = session!.user.id

  await db.calendarEvent.delete({
    where: { id: eventId, userId },
  })

  revalidatePath("/calendrier")
}

// ─── Sync Google Calendar ────────────────────────────────────────────────────

/**
 * Synchronise les événements Google Calendar sur les 3 prochains mois.
 * Lit uniquement le calendrier principal (lecture seule pour l'instant).
 */
export async function syncGoogleEvents(): Promise<SyncResult> {
  const session = await auth()
  const userId = session!.user.id

  // Vérifie si le scope calendar est accordé
  const hasScope = await hasCalendarScope(userId)
  if (!hasScope) {
    return { synced: 0, needsPermission: true }
  }

  // Récupère un token valide (refresh auto si nécessaire)
  const accessToken = await getGoogleAccessToken(userId)
  if (!accessToken) {
    return { synced: 0, needsPermission: true }
  }

  try {
    const from = new Date()
    from.setMonth(from.getMonth() - 1)
    const to = new Date()
    to.setMonth(to.getMonth() + 3)

    const googleEvents = await fetchGoogleEvents(accessToken, from, to)

    // Récupère les IDs Google déjà stockés pour la période
    const existingGoogleEvents = await db.calendarEvent.findMany({
      where: { userId, sourceType: "GOOGLE", startDate: { gte: from, lte: to } },
      select: { id: true, sourceId: true },
    }) as { id: string; sourceId: string | null }[]

    const existingBySourceId = Object.fromEntries(
      existingGoogleEvents
        .filter(e => e.sourceId)
        .map(e => [e.sourceId!, e.id])
    )

    let synced = 0
    for (const gEvent of googleEvents) {
      if (!gEvent.summary || gEvent.status === "cancelled") continue

      const startStr = gEvent.start.dateTime ?? gEvent.start.date
      const endStr   = gEvent.end.dateTime ?? gEvent.end.date
      if (!startStr) continue

      const startDate = new Date(startStr)
      const endDate   = endStr ? new Date(endStr) : null
      const allDay    = !gEvent.start.dateTime

      const existingId = existingBySourceId[gEvent.id]

      if (existingId) {
        // Update
        await db.calendarEvent.update({
          where: { id: existingId },
          data: {
            title: gEvent.summary,
            description: gEvent.description ?? null,
            startDate,
            endDate,
            allDay,
          },
        })
      } else {
        // Create
        await db.calendarEvent.create({
          data: {
            userId,
            title: gEvent.summary,
            description: gEvent.description ?? null,
            startDate,
            endDate,
            allDay,
            sourceType: "GOOGLE",
            sourceId: gEvent.id,
          },
        })
      }

      synced++
    }

    revalidatePath("/calendrier")
    return { synced }

  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur inconnue"
    return { synced: 0, error: message }
  }
}
