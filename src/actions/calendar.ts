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

// ─── Types ────────────────────────────────────────────────────────────────────
// Types locaux jusqu'à ce que `npx prisma generate` soit relancé (Node 20+)

export type CalendarCategory = {
  id: string
  userId: string
  name: string
  color: string
  isDefault: boolean
  createdAt: Date
}

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
  projectId: string | null
  clientId: string | null
  createdAt: Date
  updatedAt: Date
  category: CalendarCategory | null
}

// ─── Catégories par défaut ────────────────────────────────────────────────────

const DEFAULT_CATEGORIES = [
  { name: "Tâches",          color: "#6366f1", isDefault: true },
  { name: "Facturation",     color: "#10b981", isDefault: true },
  { name: "Jalons",          color: "#f59e0b", isDefault: true },
  { name: "Renouvellements", color: "#f97316", isDefault: true },
  { name: "Manuelle",        color: "#8b5cf6", isDefault: true },
] as const

/**
 * Récupère les catégories de l'utilisateur.
 * Si aucune n'existe, crée les 5 catégories par défaut automatiquement.
 *
 * Note : utilise $queryRaw / $executeRaw car le model CalendarCategory
 * n'est pas encore dans le client généré (besoin de `npx prisma generate`).
 */
export async function getOrCreateDefaultCategories(): Promise<CalendarCategory[]> {
  const session = await auth()
  const userId = session!.user.id

  const existing = await prisma.$queryRaw<CalendarCategory[]>`
    SELECT id, "userId", name, color, "isDefault", "createdAt"
    FROM "CalendarCategory"
    WHERE "userId" = ${userId}
    ORDER BY "createdAt" ASC
  `

  if (existing.length > 0) return existing

  // Création automatique des catégories par défaut
  for (const cat of DEFAULT_CATEGORIES) {
    const id = crypto.randomUUID()
    await prisma.$executeRaw`
      INSERT INTO "CalendarCategory" (id, "userId", name, color, "isDefault", "createdAt")
      VALUES (${id}, ${userId}, ${cat.name}, ${cat.color}, ${cat.isDefault}, NOW())
      ON CONFLICT ("userId", name) DO NOTHING
    `
  }

  return prisma.$queryRaw<CalendarCategory[]>`
    SELECT id, "userId", name, color, "isDefault", "createdAt"
    FROM "CalendarCategory"
    WHERE "userId" = ${userId}
    ORDER BY "createdAt" ASC
  `
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
    const id = crypto.randomUUID()
    await prisma.$executeRaw`
      INSERT INTO "CalendarCategory" (id, "userId", name, color, "isDefault", "createdAt")
      VALUES (${id}, ${userId}, ${data.name.trim()}, ${data.color}, false, NOW())
    `
    const [category] = await prisma.$queryRaw<CalendarCategory[]>`
      SELECT id, "userId", name, color, "isDefault", "createdAt"
      FROM "CalendarCategory"
      WHERE id = ${id}
    `
    revalidatePath("/calendrier")
    return { category }
  } catch {
    return { error: "Ce nom de catégorie existe déjà" }
  }
}

/**
 * Supprime une catégorie personnalisée (pas les catégories par défaut).
 */
export async function deleteCalendarCategory(categoryId: string): Promise<void> {
  const session = await auth()
  const userId = session!.user.id

  await prisma.$executeRaw`
    DELETE FROM "CalendarCategory"
    WHERE id = ${categoryId} AND "userId" = ${userId} AND "isDefault" = false
  `
  revalidatePath("/calendrier")
}

// ─── Événements calendrier ────────────────────────────────────────────────────
// Note : calendarEvent existe dans l'ancien client MAIS categoryId et la
// relation category sont nouveaux → on utilise du SQL brut pour ces champs.

/**
 * Récupère les événements avec leur catégorie sur une période.
 */
export async function getCalendarEvents(params?: {
  from?: Date
  to?: Date
}): Promise<CalendarEventFull[]> {
  const session = await auth()
  const userId = session!.user.id

  const from = params?.from ?? new Date(0)
  const to   = params?.to   ?? new Date("2099-12-31")

  return prisma.$queryRaw<CalendarEventFull[]>`
    SELECT
      e.id, e."userId", e.title, e.description,
      e."startDate", e."endDate", e."allDay",
      e."sourceType", e."sourceId", e."categoryId",
      e."createdAt", e."updatedAt",
      CASE WHEN c.id IS NOT NULL THEN
        jsonb_build_object(
          'id', c.id, 'userId', c."userId",
          'name', c.name, 'color', c.color,
          'isDefault', c."isDefault", 'createdAt', c."createdAt"
        )
      ELSE NULL END AS category
    FROM "CalendarEvent" e
    LEFT JOIN "CalendarCategory" c ON c.id = e."categoryId"
    WHERE e."userId" = ${userId}
      AND e."startDate" >= ${from}
      AND e."startDate" <= ${to}
    ORDER BY e."startDate" ASC
  `
}

/**
 * Crée un événement manuel.
 */
export async function createCalendarEvent(data: {
  title: string
  description?: string
  startDate: Date
  endDate?: Date
  allDay?: boolean
  categoryId?: string
  projectId?: string
  clientId?: string
}): Promise<{ error?: string; event?: CalendarEventFull }> {
  const session = await auth()
  const userId = session!.user.id

  if (!data.title.trim()) return { error: "Le titre est requis" }

  const id          = crypto.randomUUID()
  const now         = new Date()
  const categoryId  = data.categoryId ?? null
  const endDate     = data.endDate    ?? null
  const allDay      = data.allDay     ?? false
  const description = data.description ?? null
  const projectId   = data.projectId  ?? null
  const clientId    = data.clientId   ?? null

  await prisma.$executeRaw`
    INSERT INTO "CalendarEvent"
      (id, "userId", title, description, "startDate", "endDate", "allDay",
       "sourceType", "categoryId", "projectId", "clientId", "createdAt", "updatedAt")
    VALUES (
      ${id}, ${userId}, ${data.title.trim()}, ${description},
      ${data.startDate}, ${endDate}, ${allDay},
      'MANUAL', ${categoryId}, ${projectId}, ${clientId}, ${now}, ${now}
    )
  `

  const [event] = await prisma.$queryRaw<CalendarEventFull[]>`
    SELECT
      e.id, e."userId", e.title, e.description,
      e."startDate", e."endDate", e."allDay",
      e."sourceType", e."sourceId", e."categoryId",
      e."projectId", e."clientId",
      e."createdAt", e."updatedAt",
      CASE WHEN c.id IS NOT NULL THEN
        jsonb_build_object(
          'id', c.id, 'userId', c."userId",
          'name', c.name, 'color', c.color,
          'isDefault', c."isDefault", 'createdAt', c."createdAt"
        )
      ELSE NULL END AS category
    FROM "CalendarEvent" e
    LEFT JOIN "CalendarCategory" c ON c.id = e."categoryId"
    WHERE e.id = ${id}
  `

  revalidatePath("/calendrier")
  return { event }
}

/**
 * Met à jour un événement.
 */
export async function updateCalendarEvent(
  eventId: string,
  data: {
    title?: string
    description?: string | null
    startDate?: Date
    endDate?: Date | null
    allDay?: boolean
    categoryId?: string | null
    projectId?: string | null
    clientId?: string | null
  }
): Promise<void> {
  const session = await auth()
  const userId = session!.user.id

  // Chaque champ modifié → UPDATE individuel (tagged templates non dynamiques)
  if (data.title !== undefined) {
    await prisma.$executeRaw`
      UPDATE "CalendarEvent" SET title = ${data.title}, "updatedAt" = NOW()
      WHERE id = ${eventId} AND "userId" = ${userId}
    `
  }
  if (data.description !== undefined) {
    await prisma.$executeRaw`
      UPDATE "CalendarEvent" SET description = ${data.description}, "updatedAt" = NOW()
      WHERE id = ${eventId} AND "userId" = ${userId}
    `
  }
  if (data.startDate !== undefined) {
    await prisma.$executeRaw`
      UPDATE "CalendarEvent" SET "startDate" = ${data.startDate}, "updatedAt" = NOW()
      WHERE id = ${eventId} AND "userId" = ${userId}
    `
  }
  if (data.endDate !== undefined) {
    await prisma.$executeRaw`
      UPDATE "CalendarEvent" SET "endDate" = ${data.endDate}, "updatedAt" = NOW()
      WHERE id = ${eventId} AND "userId" = ${userId}
    `
  }
  if (data.allDay !== undefined) {
    await prisma.$executeRaw`
      UPDATE "CalendarEvent" SET "allDay" = ${data.allDay}, "updatedAt" = NOW()
      WHERE id = ${eventId} AND "userId" = ${userId}
    `
  }
  if (data.categoryId !== undefined) {
    await prisma.$executeRaw`
      UPDATE "CalendarEvent" SET "categoryId" = ${data.categoryId}, "updatedAt" = NOW()
      WHERE id = ${eventId} AND "userId" = ${userId}
    `
  }
  if (data.projectId !== undefined) {
    await prisma.$executeRaw`
      UPDATE "CalendarEvent" SET "projectId" = ${data.projectId}, "updatedAt" = NOW()
      WHERE id = ${eventId} AND "userId" = ${userId}
    `
  }
  if (data.clientId !== undefined) {
    await prisma.$executeRaw`
      UPDATE "CalendarEvent" SET "clientId" = ${data.clientId}, "updatedAt" = NOW()
      WHERE id = ${eventId} AND "userId" = ${userId}
    `
  }

  revalidatePath("/calendrier")
}

/**
 * Supprime un événement.
 */
export async function deleteCalendarEvent(eventId: string): Promise<void> {
  const session = await auth()
  const userId = session!.user.id

  await prisma.$executeRaw`
    DELETE FROM "CalendarEvent"
    WHERE id = ${eventId} AND "userId" = ${userId}
  `

  revalidatePath("/calendrier")
}

// ─── Sync Google Calendar ─────────────────────────────────────────────────────

/**
 * Synchronise les événements Google Calendar (lecture seule, calendrier principal).
 */
export async function syncGoogleEvents(): Promise<SyncResult> {
  const session = await auth()
  const userId = session!.user.id

  const hasScope = await hasCalendarScope(userId)
  if (!hasScope) return { synced: 0, needsPermission: true }

  const accessToken = await getGoogleAccessToken(userId)
  if (!accessToken) return { synced: 0, needsPermission: true }

  try {
    const from = new Date()
    from.setMonth(from.getMonth() - 1)
    const to = new Date()
    to.setMonth(to.getMonth() + 3)

    const googleEvents = await fetchGoogleEvents(accessToken, from, to)

    // Récupère les sourceId Google déjà stockés
    const existing = await prisma.$queryRaw<{ id: string; sourceId: string }[]>`
      SELECT id, "sourceId"
      FROM "CalendarEvent"
      WHERE "userId" = ${userId} AND "sourceType" = 'GOOGLE'
        AND "startDate" >= ${from} AND "startDate" <= ${to}
    `
    const existingBySourceId = Object.fromEntries(
      existing.filter(e => e.sourceId).map(e => [e.sourceId, e.id])
    )

    let synced = 0
    for (const gEvent of googleEvents) {
      if (!gEvent.summary || gEvent.status === "cancelled") continue

      const startStr = gEvent.start.dateTime ?? gEvent.start.date
      const endStr   = gEvent.end.dateTime ?? gEvent.end.date
      if (!startStr) continue

      const startDate   = new Date(startStr)
      const endDate     = endStr ? new Date(endStr) : null
      const allDay      = !gEvent.start.dateTime
      const description = gEvent.description ?? null
      const existingId  = existingBySourceId[gEvent.id]

      if (existingId) {
        await prisma.$executeRaw`
          UPDATE "CalendarEvent"
          SET title = ${gEvent.summary}, description = ${description},
              "startDate" = ${startDate}, "endDate" = ${endDate},
              "allDay" = ${allDay}, "updatedAt" = NOW()
          WHERE id = ${existingId}
        `
      } else {
        const id  = crypto.randomUUID()
        const now = new Date()
        await prisma.$executeRaw`
          INSERT INTO "CalendarEvent"
            (id, "userId", title, description, "startDate", "endDate", "allDay",
             "sourceType", "sourceId", "createdAt", "updatedAt")
          VALUES (
            ${id}, ${userId}, ${gEvent.summary}, ${description},
            ${startDate}, ${endDate}, ${allDay},
            'GOOGLE', ${gEvent.id}, ${now}, ${now}
          )
        `
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
