"use server"

import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { revalidatePath } from "next/cache"
import {
  getGoogleAccessToken,
  hasCalendarScope,
  fetchGoogleEvents,
  pushGoogleEvent,
  deleteGoogleEvent,
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

// ─── Push ERP → Google (événements manuels uniquement) ─────────────────────────
// Modèle asymétrique décidé : les CalendarEvent MANUAL sont bidirectionnels
// (last-write-wins + suppression des deux côtés). Les tâches/jalons/factures/
// renouvellements restent des projections (miroir unidirectionnel — phases B/C).
// Tout est best-effort : un échec Google ne doit jamais casser l'action ERP.

/**
 * Pousse un événement manuel vers Google (création ou mise à jour) et mémorise
 * googleEventId + googleSyncedAt. Silencieux si pas de scope/token (best-effort).
 */
async function syncManualEventToGoogle(userId: string, eventId: string): Promise<void> {
  try {
    const accessToken = await getGoogleAccessToken(userId)
    if (!accessToken) return

    const rows = await prisma.$queryRaw<{
      title: string
      description: string | null
      startDate: Date
      endDate: Date | null
      allDay: boolean
      googleEventId: string | null
    }[]>`
      SELECT title, description, "startDate", "endDate", "allDay", "googleEventId"
      FROM "CalendarEvent"
      WHERE id = ${eventId} AND "userId" = ${userId} AND "sourceType" = 'MANUAL'
      LIMIT 1
    `
    const ev = rows[0]
    if (!ev) return

    const end = ev.endDate ?? new Date(new Date(ev.startDate).getTime() + 30 * 60_000)

    const { id: googleEventId, updated } = await pushGoogleEvent(
      accessToken,
      {
        summary: ev.title,
        description: ev.description ?? undefined,
        start: ev.startDate,
        end,
        allDay: ev.allDay,
      },
      ev.googleEventId,
    )

    const syncedAt = updated ? new Date(updated) : new Date()
    await prisma.$executeRaw`
      UPDATE "CalendarEvent"
      SET "googleEventId" = ${googleEventId}, "googleSyncedAt" = ${syncedAt}
      WHERE id = ${eventId} AND "userId" = ${userId}
    `
  } catch {
    // best-effort : on n'interrompt jamais l'action ERP
  }
}

/**
 * Supprime côté Google l'événement associé. Silencieux si pas de scope/token.
 */
async function removeManualEventFromGoogle(userId: string, googleEventId: string): Promise<void> {
  try {
    const accessToken = await getGoogleAccessToken(userId)
    if (!accessToken) return
    await deleteGoogleEvent(accessToken, googleEventId)
  } catch {
    // best-effort
  }
}

// ─── Dispatcher contextuel ────────────────────────────────────────────────────
// Le bouton "+" du calendrier crée la VRAIE entité métier selon le contexte
// (rattachement) et la nature choisie, plutôt qu'un simple CalendarEvent cosmétique.

export type CalNature =
  | "event"        // événement perso  → CalendarEvent MANUAL
  | "task"         // tâche            → Task (dueDate = date)
  | "interaction"  // interaction      → Interaction (client uniquement)
  | "reminder"     // rappel           → Reminder (client uniquement)
  | "milestone"    // jalon            → Milestone (projet uniquement)
  | "note"         // note rapide      → JournalEntry + CalendarEvent daté (projet)

export type CalItemInput = {
  nature: CalNature
  title: string
  description?: string | null
  startDate: Date
  endDate?: Date | null
  allDay?: boolean
  categoryId?: string | null
  clientId?: string | null
  projectId?: string | null
  channel?: string | null   // interaction : EMAIL/CALL/MEETING/...
  priority?: string | null  // task : LOW/MEDIUM/HIGH/URGENT
}

/** Vérifie que le client appartient à l'utilisateur. */
async function assertClientOwnership(userId: string, clientId: string) {
  const c = await prisma.client.findFirst({ where: { id: clientId, userId }, select: { id: true } })
  if (!c) throw new Error("Client introuvable")
}

/** Vérifie que le projet appartient à l'utilisateur. */
async function assertProjectOwnership(userId: string, projectId: string) {
  const p = await prisma.project.findFirst({ where: { id: projectId, userId }, select: { id: true } })
  if (!p) throw new Error("Projet introuvable")
}

/** Insère un CalendarEvent MANUAL (SQL brut : champs categoryId/projectId/clientId/sourceId hors client généré). */
async function insertManualEvent(userId: string, data: {
  title: string
  description: string | null
  startDate: Date
  endDate: Date | null
  allDay: boolean
  categoryId: string | null
  projectId: string | null
  clientId: string | null
  sourceId?: string | null
}) {
  const id  = crypto.randomUUID()
  const now = new Date()
  await prisma.$executeRaw`
    INSERT INTO "CalendarEvent"
      (id, "userId", title, description, "startDate", "endDate", "allDay",
       "sourceType", "sourceId", "categoryId", "projectId", "clientId", "createdAt", "updatedAt")
    VALUES (
      ${id}, ${userId}, ${data.title}, ${data.description},
      ${data.startDate}, ${data.endDate}, ${data.allDay},
      'MANUAL', ${data.sourceId ?? null}, ${data.categoryId}, ${data.projectId}, ${data.clientId}, ${now}, ${now}
    )
  `
  return id
}

/**
 * Crée l'entité adaptée au contexte. Renvoie { error } si validation échoue.
 */
export async function createCalendarItem(input: CalItemInput): Promise<{ error?: string }> {
  const session = await auth()
  const userId  = session!.user.id

  const title = input.title.trim()
  if (!title) return { error: "Le titre est requis" }

  const description = input.description?.trim() || null
  const clientId    = input.clientId ?? null
  const projectId   = input.projectId ?? null
  const categoryId  = input.categoryId ?? null
  const allDay      = input.allDay ?? false
  const endDate     = input.endDate ?? null

  try {
    switch (input.nature) {
      case "task": {
        if (projectId) await assertProjectOwnership(userId, projectId)
        if (clientId)  await assertClientOwnership(userId, clientId)
        await prisma.task.create({
          data: {
            userId,
            projectId: projectId ?? null,
            clientId:  clientId ?? null,
            title,
            description,
            dueDate: input.startDate,
            priority: (input.priority ?? "LOW") as never,
          },
        })
        revalidatePath("/taches")
        if (projectId) revalidatePath(`/projets/${projectId}`)
        if (clientId)  revalidatePath(`/client/${clientId}`)
        break
      }

      case "milestone": {
        if (!projectId) return { error: "Un jalon doit être rattaché à un projet" }
        await assertProjectOwnership(userId, projectId)
        await prisma.milestone.create({
          data: { projectId, name: title, date: input.startDate },
        })
        revalidatePath(`/projets/${projectId}`)
        break
      }

      case "interaction": {
        if (!clientId) return { error: "Une interaction doit être rattachée à un client" }
        await assertClientOwnership(userId, clientId)
        await prisma.interaction.create({
          data: {
            clientId,
            date: input.startDate,
            channel: (input.channel ?? "OTHER") as never,
            summary: title,
            response: description,
          },
        })
        revalidatePath(`/client/${clientId}`)
        break
      }

      case "reminder": {
        if (!clientId) return { error: "Un rappel doit être rattaché à un client" }
        await assertClientOwnership(userId, clientId)
        await prisma.reminder.create({
          data: {
            clientId,
            dueDate: input.startDate,
            note: description ? `${title} — ${description}` : title,
          },
        })
        revalidatePath(`/client/${clientId}`)
        break
      }

      case "note": {
        if (!projectId) return { error: "Une note doit être rattachée à un projet" }
        await assertProjectOwnership(userId, projectId)
        // 1) entrée canonique dans le journal du projet
        const entry = await prisma.journalEntry.create({
          data: { projectId, content: description ? `${title}\n${description}` : title },
        })
        // 2) événement daté lié, visible dans l'agenda (sourceId → journal entry)
        const noteEventId = await insertManualEvent(userId, {
          title, description, startDate: input.startDate, endDate, allDay,
          categoryId, projectId, clientId: null, sourceId: entry.id,
        })
        await syncManualEventToGoogle(userId, noteEventId)
        revalidatePath(`/projets/${projectId}`)
        break
      }

      case "event":
      default: {
        if (projectId) await assertProjectOwnership(userId, projectId)
        if (clientId)  await assertClientOwnership(userId, clientId)
        const eventId = await insertManualEvent(userId, {
          title, description, startDate: input.startDate, endDate, allDay,
          categoryId, projectId, clientId,
        })
        await syncManualEventToGoogle(userId, eventId)
        break
      }
    }

    revalidatePath("/calendrier")
    return {}
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur inconnue"
    return { error: message }
  }
}

// ─── Move / update / delete contextuels ───────────────────────────────────────
// Type d'entité tel que projeté côté calendrier.
export type CalItemType =
  | "task" | "milestone" | "reminder" | "interaction" | "manual"

/**
 * Reprogramme une entité par drag-drop. Invoice / Renewal ne sont pas déplaçables
 * (dates contractuelles) → non gérés ici.
 */
export async function moveCalendarItem(
  type: CalItemType,
  id: string,
  newStart: Date,
  newEnd: Date | null,
  allDay: boolean,
): Promise<{ error?: string }> {
  const session = await auth()
  const userId  = session!.user.id

  try {
    switch (type) {
      case "task": {
        const t = await prisma.task.findFirst({
          where: { id, OR: [{ userId }, { project: { userId } }, { client: { userId } }] },
          select: { id: true, projectId: true, clientId: true },
        })
        if (!t) return { error: "Tâche introuvable" }
        await prisma.task.update({ where: { id }, data: { dueDate: newStart } })
        revalidatePath("/taches")
        if (t.projectId) revalidatePath(`/projets/${t.projectId}`)
        if (t.clientId)  revalidatePath(`/client/${t.clientId}`)
        break
      }
      case "milestone": {
        const m = await prisma.milestone.findFirst({
          where: { id, project: { userId } },
          select: { id: true, projectId: true },
        })
        if (!m) return { error: "Jalon introuvable" }
        await prisma.milestone.update({ where: { id }, data: { date: newStart } })
        revalidatePath(`/projets/${m.projectId}`)
        break
      }
      case "reminder": {
        const r = await prisma.reminder.findFirst({
          where: { id, client: { userId } },
          select: { id: true, clientId: true },
        })
        if (!r) return { error: "Rappel introuvable" }
        await prisma.reminder.update({ where: { id }, data: { dueDate: newStart } })
        revalidatePath(`/client/${r.clientId}`)
        break
      }
      case "interaction": {
        const i = await prisma.interaction.findFirst({
          where: { id, client: { userId } },
          select: { id: true, clientId: true },
        })
        if (!i) return { error: "Interaction introuvable" }
        await prisma.interaction.update({ where: { id }, data: { date: newStart } })
        revalidatePath(`/client/${i.clientId}`)
        break
      }
      case "manual": {
        await prisma.$executeRaw`
          UPDATE "CalendarEvent"
          SET "startDate" = ${newStart}, "endDate" = ${newEnd}, "allDay" = ${allDay}, "updatedAt" = NOW()
          WHERE id = ${id} AND "userId" = ${userId}
        `
        await syncManualEventToGoogle(userId, id)
        break
      }
    }
    revalidatePath("/calendrier")
    return {}
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur inconnue"
    return { error: message }
  }
}

/**
 * Met à jour titre / date / description d'une entité depuis la modale détail.
 */
export async function updateCalendarItem(
  type: CalItemType,
  id: string,
  data: {
    title?: string
    description?: string | null
    startDate?: Date
    endDate?: Date | null
    allDay?: boolean
    categoryId?: string | null
    projectId?: string | null
    clientId?: string | null
    channel?: string | null
    priority?: string | null
  },
): Promise<{ error?: string }> {
  const session = await auth()
  const userId  = session!.user.id

  try {
    switch (type) {
      case "task": {
        const t = await prisma.task.findFirst({
          where: { id, OR: [{ userId }, { project: { userId } }, { client: { userId } }] },
          select: { id: true, projectId: true, clientId: true },
        })
        if (!t) return { error: "Tâche introuvable" }
        await prisma.task.update({
          where: { id },
          data: {
            ...(data.title !== undefined ? { title: data.title } : {}),
            ...(data.description !== undefined ? { description: data.description } : {}),
            ...(data.startDate !== undefined ? { dueDate: data.startDate } : {}),
            ...(data.priority ? { priority: data.priority as never } : {}),
          },
        })
        revalidatePath("/taches")
        if (t.projectId) revalidatePath(`/projets/${t.projectId}`)
        if (t.clientId)  revalidatePath(`/client/${t.clientId}`)
        break
      }
      case "milestone": {
        const m = await prisma.milestone.findFirst({
          where: { id, project: { userId } }, select: { id: true, projectId: true },
        })
        if (!m) return { error: "Jalon introuvable" }
        await prisma.milestone.update({
          where: { id },
          data: {
            ...(data.title !== undefined ? { name: data.title } : {}),
            ...(data.startDate !== undefined ? { date: data.startDate } : {}),
          },
        })
        revalidatePath(`/projets/${m.projectId}`)
        break
      }
      case "reminder": {
        const r = await prisma.reminder.findFirst({
          where: { id, client: { userId } }, select: { id: true, clientId: true },
        })
        if (!r) return { error: "Rappel introuvable" }
        await prisma.reminder.update({
          where: { id },
          data: {
            ...(data.title !== undefined ? { note: data.title } : {}),
            ...(data.startDate !== undefined ? { dueDate: data.startDate } : {}),
          },
        })
        revalidatePath(`/client/${r.clientId}`)
        break
      }
      case "interaction": {
        const i = await prisma.interaction.findFirst({
          where: { id, client: { userId } }, select: { id: true, clientId: true },
        })
        if (!i) return { error: "Interaction introuvable" }
        await prisma.interaction.update({
          where: { id },
          data: {
            ...(data.title !== undefined ? { summary: data.title } : {}),
            ...(data.description !== undefined ? { response: data.description } : {}),
            ...(data.startDate !== undefined ? { date: data.startDate } : {}),
            ...(data.channel ? { channel: data.channel as never } : {}),
          },
        })
        revalidatePath(`/client/${i.clientId}`)
        break
      }
      case "manual": {
        await updateCalendarEvent(id, {
          ...(data.title !== undefined ? { title: data.title } : {}),
          ...(data.description !== undefined ? { description: data.description } : {}),
          ...(data.startDate !== undefined ? { startDate: data.startDate } : {}),
          ...(data.endDate !== undefined ? { endDate: data.endDate } : {}),
          ...(data.allDay !== undefined ? { allDay: data.allDay } : {}),
          ...(data.categoryId !== undefined ? { categoryId: data.categoryId } : {}),
          ...(data.projectId !== undefined ? { projectId: data.projectId } : {}),
          ...(data.clientId !== undefined ? { clientId: data.clientId } : {}),
        })
        await syncManualEventToGoogle(userId, id)
        break
      }
    }
    revalidatePath("/calendrier")
    return {}
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur inconnue"
    return { error: message }
  }
}

/**
 * Supprime une entité depuis la modale détail.
 */
export async function deleteCalendarItem(type: CalItemType, id: string): Promise<{ error?: string }> {
  const session = await auth()
  const userId  = session!.user.id

  try {
    switch (type) {
      case "task": {
        const t = await prisma.task.findFirst({
          where: { id, OR: [{ userId }, { project: { userId } }, { client: { userId } }] },
          select: { id: true, projectId: true, clientId: true },
        })
        if (!t) return { error: "Tâche introuvable" }
        await prisma.task.delete({ where: { id } })
        revalidatePath("/taches")
        if (t.projectId) revalidatePath(`/projets/${t.projectId}`)
        if (t.clientId)  revalidatePath(`/client/${t.clientId}`)
        break
      }
      case "milestone": {
        const m = await prisma.milestone.findFirst({ where: { id, project: { userId } }, select: { projectId: true } })
        if (!m) return { error: "Jalon introuvable" }
        await prisma.milestone.delete({ where: { id } })
        revalidatePath(`/projets/${m.projectId}`)
        break
      }
      case "reminder": {
        const r = await prisma.reminder.findFirst({ where: { id, client: { userId } }, select: { clientId: true } })
        if (!r) return { error: "Rappel introuvable" }
        await prisma.reminder.delete({ where: { id } })
        revalidatePath(`/client/${r.clientId}`)
        break
      }
      case "interaction": {
        const i = await prisma.interaction.findFirst({ where: { id, client: { userId } }, select: { clientId: true } })
        if (!i) return { error: "Interaction introuvable" }
        await prisma.interaction.delete({ where: { id } })
        revalidatePath(`/client/${i.clientId}`)
        break
      }
      case "manual": {
        // Récupère l'id Google avant suppression pour répercuter côté agenda.
        const rows = await prisma.$queryRaw<{ googleEventId: string | null }[]>`
          SELECT "googleEventId" FROM "CalendarEvent"
          WHERE id = ${id} AND "userId" = ${userId} LIMIT 1
        `
        await prisma.$executeRaw`
          DELETE FROM "CalendarEvent" WHERE id = ${id} AND "userId" = ${userId}
        `
        const gid = rows[0]?.googleEventId
        if (gid) await removeManualEventFromGoogle(userId, gid)
        break
      }
    }
    revalidatePath("/calendrier")
    return {}
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur inconnue"
    return { error: message }
  }
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

    // Événements MANUAL déjà poussés vers Google (pour dédoublonnage + arbitrage).
    const pushed = await prisma.$queryRaw<{ id: string; googleEventId: string; googleSyncedAt: Date | null }[]>`
      SELECT id, "googleEventId", "googleSyncedAt"
      FROM "CalendarEvent"
      WHERE "userId" = ${userId} AND "sourceType" = 'MANUAL' AND "googleEventId" IS NOT NULL
    `
    const pushedByGoogleId = Object.fromEntries(
      pushed.map(e => [e.googleEventId, e])
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

      // Cas d'un événement que NOUS avons poussé : ne pas créer de doublon GOOGLE.
      // Arbitrage "dernière modif gagne" : on ne rapatrie la version Google que si
      // elle est plus récente que notre dernière synchro (modifié hors ERP).
      const mine = pushedByGoogleId[gEvent.id]
      if (mine) {
        const gUpdated = gEvent.updated ? new Date(gEvent.updated).getTime() : 0
        const lastSync = mine.googleSyncedAt ? new Date(mine.googleSyncedAt).getTime() : 0
        if (gUpdated > lastSync) {
          await prisma.$executeRaw`
            UPDATE "CalendarEvent"
            SET title = ${gEvent.summary}, description = ${description},
                "startDate" = ${startDate}, "endDate" = ${endDate},
                "allDay" = ${allDay}, "googleSyncedAt" = ${gEvent.updated ? new Date(gEvent.updated) : new Date()},
                "updatedAt" = NOW()
            WHERE id = ${mine.id}
          `
          synced++
        }
        continue
      }

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
