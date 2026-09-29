"use server"

import { parseGoogleDate } from "@/lib/dates"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/require-auth"
import { assertOwnedRefs } from "@/lib/owned-refs"
import { auth } from "@/lib/auth"
import { revalidatePath } from "next/cache"
import {
  getGoogleAccessToken,
  hasCalendarScope,
  fetchGoogleEvents,
  pushGoogleEvent,
  deleteGoogleEvent,
  getErpCalendarId,
  checkGoogleCalendarStatus,
  GOOGLE_FETCH_CAP,
  type SyncResult,
  type GoogleConnectionStatus,
  type GoogleCalendarEvent,
} from "@/lib/google-calendar"

// ─── Types ────────────────────────────────────────────────────────────────────
// Formes renvoyées au client (le calendrier est entièrement sur le client Prisma typé, #25 :
// l'ancien SQL brut était le seul endroit où renommer une colonne passait le typage).

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

const CATEGORY_SELECT = { id: true, userId: true, name: true, color: true, isDefault: true, createdAt: true } as const
const EVENT_SELECT = {
  id: true, userId: true, title: true, description: true,
  startDate: true, endDate: true, allDay: true,
  sourceType: true, sourceId: true, categoryId: true, projectId: true, clientId: true,
  createdAt: true, updatedAt: true,
  category: { select: CATEGORY_SELECT },
} as const

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
 */
export async function getOrCreateDefaultCategories(): Promise<CalendarCategory[]> {
  const userId = await requireAuth()

  const existing = await prisma.calendarCategory.findMany({
    where: { userId }, orderBy: { createdAt: "asc" }, select: CATEGORY_SELECT,
  })
  if (existing.length > 0) return existing

  // Une à une (horodatages distincts → ordre stable), sans erreur si un rendu parallèle
  // les a déjà créées (@@unique([userId, name])).
  for (const cat of DEFAULT_CATEGORIES) {
    await prisma.calendarCategory.createMany({ data: [{ userId, ...cat }], skipDuplicates: true })
  }
  return prisma.calendarCategory.findMany({ where: { userId }, orderBy: { createdAt: "asc" }, select: CATEGORY_SELECT })
}

/**
 * Crée une catégorie personnalisée.
 */
export async function createCalendarCategory(data: {
  name: string
  color: string
}): Promise<{ error?: string; category?: CalendarCategory }> {
  const userId = await requireAuth()

  if (!data.name.trim()) return { error: "Le nom est requis" }

  try {
    const category = await prisma.calendarCategory.create({
      data: { userId, name: data.name.trim(), color: data.color, isDefault: false },
      select: CATEGORY_SELECT,
    })
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
  const userId = await requireAuth()

  await prisma.calendarCategory.deleteMany({ where: { id: categoryId, userId, isDefault: false } })
  revalidatePath("/calendrier")
}

// ─── Événements calendrier ────────────────────────────────────────────────────

/**
 * Récupère les événements avec leur catégorie sur une période.
 */
export async function getCalendarEvents(params?: {
  from?: Date
  to?: Date
}): Promise<CalendarEventFull[]> {
  const userId = await requireAuth()

  const from = params?.from ?? new Date(0)
  const to   = params?.to   ?? new Date("2099-12-31")

  return prisma.calendarEvent.findMany({
    where: { userId, startDate: { gte: from, lte: to } },
    orderBy: { startDate: "asc" },
    select: EVENT_SELECT,
  })
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
  const userId = await requireAuth()

  if (!data.title.trim()) return { error: "Le titre est requis" }
  // Anti-IDOR : /calendrier joint projet/contact/catégorie sans filtrer par utilisateur
  try {
    await assertOwnedRefs(userId, { projectId: data.projectId, clientId: data.clientId, calendarCategoryId: data.categoryId })
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Référence invalide" }
  }

  const created = await prisma.calendarEvent.create({
    data: {
      userId,
      title: data.title.trim(),
      description: data.description ?? null,
      startDate: data.startDate,
      endDate: data.endDate ?? null,
      allDay: data.allDay ?? false,
      sourceType: "MANUAL",
      categoryId: data.categoryId ?? null,
      projectId: data.projectId ?? null,
      clientId: data.clientId ?? null,
    },
    select: EVENT_SELECT,
  })
  const event: CalendarEventFull = created
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
  const userId = await requireAuth()
  await assertOwnedRefs(userId, { projectId: data.projectId, clientId: data.clientId, calendarCategoryId: data.categoryId })

  // Un seul UPDATE scopé au propriétaire (anti-IDOR) : Prisma ignore les champs
  // `undefined` (donc seuls les champs fournis sont écrits) et gère `updatedAt`
  // automatiquement (@updatedAt).
  await prisma.calendarEvent.updateMany({
    where: { id: eventId, userId },
    data: {
      title: data.title,
      description: data.description,
      startDate: data.startDate,
      endDate: data.endDate,
      allDay: data.allDay,
      categoryId: data.categoryId,
      projectId: data.projectId,
      clientId: data.clientId,
    },
  })

  revalidatePath("/calendrier")
}

/**
 * Supprime un événement.
 */
export async function deleteCalendarEvent(eventId: string): Promise<void> {
  const userId = await requireAuth()

  await prisma.calendarEvent.deleteMany({ where: { id: eventId, userId } })

  revalidatePath("/calendrier")
}

/**
 * Marque un événement comme annulé (avec raison optionnelle en note libre).
 */
export async function cancelCalendarEvent(eventId: string, reason?: string): Promise<void> {
  const userId = await requireAuth()

  const { count } = await prisma.calendarEvent.updateMany({
    where: { id: eventId, userId },
    data: { cancelledAt: new Date(), outcome: reason?.trim() || null },
  })
  if (count === 0) throw new Error("Non autorisé")
  revalidatePath("/calendrier")
}

/**
 * Annule l'annulation d'un événement.
 */
export async function uncancelCalendarEvent(eventId: string): Promise<void> {
  const userId = await requireAuth()

  const { count } = await prisma.calendarEvent.updateMany({
    where: { id: eventId, userId },
    data: { cancelledAt: null },
  })
  if (count === 0) throw new Error("Non autorisé")
  revalidatePath("/calendrier")
}

/**
 * Enregistre un compte-rendu post-événement (lève une éventuelle annulation).
 */
export async function setCalendarEventOutcome(eventId: string, outcome: string): Promise<void> {
  const userId = await requireAuth()

  const { count } = await prisma.calendarEvent.updateMany({
    where: { id: eventId, userId },
    data: { outcome: outcome.trim() || null, cancelledAt: null },
  })
  if (count === 0) throw new Error("Non autorisé")
  revalidatePath("/calendrier")
}

// ─── Push ERP → Google (événements manuels uniquement) ─────────────────────────
// Modèle asymétrique décidé : les CalendarEvent MANUAL sont bidirectionnels
// (last-write-wins + suppression des deux côtés). Les tâches/jalons/factures/
// renouvellements restent des projections (miroir unidirectionnel — phases B/C).
// Tout est best-effort : un échec Google ne doit jamais casser l'action ERP.

/**
 * Pousse un CalendarEvent vers Google (best-effort, silencieux si pas de scope/token).
 * - sourceType MANUAL : créé/mis à jour dans l'agenda dédié "ERP Freelance"
 *   (mémorise googleEventId + googleSyncedAt).
 * - sourceType GOOGLE : mis à jour dans l'agenda d'origine (primaire) via sourceId,
 *   pour que les modifs faites dans l'ERP soient répercutées et non réécrites au
 *   prochain import.
 */
/** Pousse un événement vers Google. Best-effort : n'interrompt jamais l'action ERP, mais
 *  renvoie false en cas d'échec pour que la synchro ne le compte pas comme réussi. */
async function pushEventToGoogle(userId: string, eventId: string): Promise<boolean> {
  try {
    const accessToken = await getGoogleAccessToken(userId)
    if (!accessToken) return false

    const ev = await prisma.calendarEvent.findFirst({
      where: { id: eventId, userId },
      select: { title: true, description: true, startDate: true, endDate: true, allDay: true, sourceType: true, sourceId: true, googleEventId: true },
    })
    if (!ev) return true

    const end = ev.endDate ?? new Date(new Date(ev.startDate).getTime() + 30 * 60_000)
    const payload = {
      summary: ev.title,
      description: ev.description ?? undefined,
      start: ev.startDate,
      end,
      allDay: ev.allDay,
    }

    if (ev.sourceType === "GOOGLE") {
      // Événement importé : on met à jour sa copie dans l'agenda primaire.
      if (!ev.sourceId) return true
      await pushGoogleEvent(accessToken, "primary", payload, ev.sourceId)
      return true
    }

    // Événement manuel → agenda dédié ERP.
    const calendarId = await getErpCalendarId(userId, accessToken)
    if (!calendarId) return false

    const { id: googleEventId, updated } = await pushGoogleEvent(
      accessToken,
      calendarId,
      payload,
      ev.googleEventId,
    )

    const syncedAt = updated ? new Date(updated) : new Date()
    await prisma.calendarEvent.updateMany({
      where: { id: eventId, userId },
      data: { googleEventId, googleSyncedAt: syncedAt },
    })
    return true
  } catch {
    // best-effort : on n'interrompt jamais l'action ERP
    return false
  }
}

/**
 * Supprime côté Google l'événement associé. Silencieux si pas de scope/token.
 */
async function removeManualEventFromGoogle(userId: string, googleEventId: string): Promise<void> {
  try {
    const accessToken = await getGoogleAccessToken(userId)
    if (!accessToken) return
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { googleErpCalendarId: true } })
    const calendarId = user?.googleErpCalendarId
    if (!calendarId) return
    await deleteGoogleEvent(accessToken, calendarId, googleEventId)
  } catch {
    // best-effort
  }
}

/** Supprime dans l'agenda principal un événement importé. Best-effort. */
async function removeImportedEventFromGoogle(userId: string, sourceId: string): Promise<void> {
  try {
    const accessToken = await getGoogleAccessToken(userId)
    if (!accessToken) return
    await deleteGoogleEvent(accessToken, "primary", sourceId)
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
  const { id } = await prisma.calendarEvent.create({
    data: {
      userId,
      title: data.title,
      description: data.description,
      startDate: data.startDate,
      endDate: data.endDate,
      allDay: data.allDay,
      sourceType: "MANUAL",
      sourceId: data.sourceId ?? null,
      categoryId: data.categoryId,
      projectId: data.projectId,
      clientId: data.clientId,
    },
    select: { id: true },
  })
  return id
}

/**
 * Crée l'entité adaptée au contexte. Renvoie { error } si validation échoue.
 */
export async function createCalendarItem(input: CalItemInput): Promise<{ error?: string }> {
  const userId = await requireAuth()

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
        if (clientId)  revalidatePath(`/contacts/${clientId}`)
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
        revalidatePath(`/contacts/${clientId}`)
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
        revalidatePath(`/contacts/${clientId}`)
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
        await pushEventToGoogle(userId, noteEventId)
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
        await pushEventToGoogle(userId, eventId)
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
  const userId = await requireAuth()

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
        if (t.clientId)  revalidatePath(`/contacts/${t.clientId}`)
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
        revalidatePath(`/contacts/${r.clientId}`)
        break
      }
      case "interaction": {
        const i = await prisma.interaction.findFirst({
          where: { id, client: { userId } },
          select: { id: true, clientId: true },
        })
        if (!i) return { error: "Interaction introuvable" }
        await prisma.interaction.update({ where: { id }, data: { date: newStart } })
        revalidatePath(`/contacts/${i.clientId}`)
        break
      }
      case "manual": {
        await prisma.calendarEvent.updateMany({
          where: { id, userId },
          data: { startDate: newStart, endDate: newEnd, allDay },
        })
        await pushEventToGoogle(userId, id)
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
  const userId = await requireAuth()

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
        if (t.clientId)  revalidatePath(`/contacts/${t.clientId}`)
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
        revalidatePath(`/contacts/${r.clientId}`)
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
        revalidatePath(`/contacts/${i.clientId}`)
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
        await pushEventToGoogle(userId, id)
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
  const userId = await requireAuth()

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
        if (t.clientId)  revalidatePath(`/contacts/${t.clientId}`)
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
        revalidatePath(`/contacts/${r.clientId}`)
        break
      }
      case "interaction": {
        const i = await prisma.interaction.findFirst({ where: { id, client: { userId } }, select: { clientId: true } })
        if (!i) return { error: "Interaction introuvable" }
        await prisma.interaction.delete({ where: { id } })
        revalidatePath(`/contacts/${i.clientId}`)
        break
      }
      case "manual": {
        // Récupère l'id Google avant suppression pour répercuter côté agenda.
        const ev = await prisma.calendarEvent.findFirst({
          where: { id, userId },
          select: { googleEventId: true, sourceType: true, sourceId: true },
        })
        await prisma.calendarEvent.deleteMany({ where: { id, userId } })
        if (ev?.googleEventId) await removeManualEventFromGoogle(userId, ev.googleEventId)
        // Importé de l'agenda principal : sans ça, il réapparaissait à la synchro suivante (#11)
        else if (ev?.sourceType === "GOOGLE" && ev.sourceId) await removeImportedEventFromGoogle(userId, ev.sourceId)
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
 *
 * `monthsBack` borne la fenêtre passée récupérée (1 mois par défaut). On ne pull
 * PAS tout l'historique par défaut — sur un compte Google avec des années
 * d'ancienneté, singleEvents=true explose chaque récurrence sur tout cet
 * historique (potentiellement des milliers d'événements), et la boucle
 * d'écriture SQL séquentielle qui suit dépasse alors le timeout des fonctions
 * serverless (10s par défaut sur Vercel sans maxDuration) — le sync ne se
 * termine jamais côté client. Le client (CalendarView) élargit `monthsBack` à
 * la demande quand l'utilisateur navigue au-delà de la fenêtre déjà synchro.
 */
/**
 * Vérifie l'état de la connexion Google Calendar sans déclencher de sync
 * complète — utilisé pour refléter l'état réel (connecté / erreur / non
 * connecté) sur le bouton dès l'ouverture de la page, avant toute action
 * de l'utilisateur.
 */
export async function getGoogleCalendarConnectionStatus(): Promise<GoogleConnectionStatus> {
  const userId = await requireAuth()
  return checkGoogleCalendarStatus(userId)
}

/** Étape « récupération » de la sync : Google → ERP (pull + dédoublonnage). */
export async function syncGooglePull(monthsBack: number = 1): Promise<SyncResult> {
  const userId = await requireAuth()

  const hasScope = await hasCalendarScope(userId)
  if (!hasScope) return { synced: 0, needsPermission: true }

  const accessToken = await getGoogleAccessToken(userId)
  if (!accessToken) return { synced: 0, needsPermission: true }

  try {
    // Récupération (pull) : fenêtre glissante récente → 3 mois dans le futur.
    const from = new Date()
    from.setMonth(from.getMonth() - Math.max(1, Math.min(monthsBack, 24)))
    const to = new Date()
    to.setMonth(to.getMonth() + 3)

    // showDeleted : les suppressions récentes reviennent en status "cancelled" (#11).
    const primaryEvents = await fetchGoogleEvents(accessToken, from, to, "primary", { showDeleted: true })

    // Agenda dédié « ERP Freelance » : nos événements poussés (arbitrage des modifs faites
    // côté Google). S'il a été supprimé dans Google, on oublie son id (il sera recréé au
    // prochain push) au lieu de faire échouer tout l'import, agenda principal compris.
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { googleErpCalendarId: true } })
    let erpEvents: GoogleCalendarEvent[] = []
    if (user?.googleErpCalendarId) {
      try {
        erpEvents = await fetchGoogleEvents(accessToken, from, to, user.googleErpCalendarId, { showDeleted: true })
      } catch (e) {
        const status = (e as { status?: number }).status
        if (status !== 404 && status !== 410) throw e
        await prisma.user.update({ where: { id: userId }, data: { googleErpCalendarId: null } })
      }
    }

    // Miroirs poussés par google-task-sync (tâches ✅, jalons 🚩, entretiens 💼) : déjà
    // projetés par /calendrier depuis leur entité — les ré-importer les affichait en double.
    const [mirrorTasks, mirrorMilestones, mirrorApps] = await Promise.all([
      prisma.task.findMany({ where: { OR: [{ userId }, { project: { userId } }], googleEventId: { not: null } }, select: { googleEventId: true } }),
      prisma.milestone.findMany({ where: { project: { userId }, googleEventId: { not: null } }, select: { googleEventId: true } }),
      prisma.jobApplication.findMany({ where: { userId, googleEventId: { not: null } }, select: { googleEventId: true } }),
    ])
    const mirrorIds = new Set([...mirrorTasks, ...mirrorMilestones, ...mirrorApps].map((r) => r.googleEventId!))

    // Nos événements MANUAL poussés (dédoublonnage + arbitrage « dernière modif gagne »).
    const pushed = await prisma.calendarEvent.findMany({
      where: { userId, sourceType: "MANUAL", googleEventId: { not: null } },
      select: { id: true, googleEventId: true, googleSyncedAt: true },
    })
    const pushedByGoogleId = new Map(pushed.map((e) => [e.googleEventId!, e]))

    // Importés : recherche par sourceId SANS borne de date. Google renvoie ce qui CHEVAUCHE la
    // fenêtre ; un événement commencé avant `from` n'était jamais retrouvé par un index borné
    // sur startDate → une nouvelle ligne à chaque synchro (#42).
    const existing = await prisma.calendarEvent.findMany({
      where: { userId, sourceType: "GOOGLE", sourceId: { in: primaryEvents.map((g) => g.id) } },
      select: { id: true, sourceId: true },
    })
    const existingBySourceId = new Map(existing.map((e) => [e.sourceId!, e.id]))

    // Journée entière = date seule ("2026-09-10", fin EXCLUSIVE) → minuit Europe/Paris via
    // parseGoogleDate, indépendamment du fuseau du serveur (UTC sur Vercel).
    const fieldsOf = (g: GoogleCalendarEvent) => {
      const startStr = g.start?.dateTime ?? g.start?.date
      if (!g.summary || !startStr) return null
      const endStr = g.end?.dateTime ?? g.end?.date
      return {
        title: g.summary,
        description: g.description ?? null,
        startDate: parseGoogleDate(startStr),
        endDate: endStr ? parseGoogleDate(endStr) : null,
        allDay: !g.start.dateTime,
      }
    }

    let synced = 0

    for (const g of erpEvents) {
      if (mirrorIds.has(g.id)) continue
      const mine = pushedByGoogleId.get(g.id)
      if (g.status === "cancelled") {
        // Supprimé dans Google → supprimé dans l'ERP (« suppression des deux côtés »)
        if (mine) { await prisma.calendarEvent.deleteMany({ where: { id: mine.id, userId } }); synced++ }
        continue
      }
      const fields = fieldsOf(g)
      if (!fields) continue
      const updatedAt = g.updated ? new Date(g.updated) : new Date()
      if (mine) {
        // On ne rapatrie la version Google que si elle est plus récente que notre dernière synchro.
        if (updatedAt.getTime() > (mine.googleSyncedAt?.getTime() ?? 0) && g.updated) {
          await prisma.calendarEvent.update({ where: { id: mine.id }, data: { ...fields, googleSyncedAt: updatedAt } })
          synced++
        }
        continue
      }
      // Créé directement dans « ERP Freelance » côté Google : adopté comme événement ERP (MANUAL +
      // googleEventId), pour que ses modifications repartent sur CET agenda et non sur primary (#42).
      await prisma.calendarEvent.create({ data: { userId, ...fields, sourceType: "MANUAL", googleEventId: g.id, googleSyncedAt: updatedAt } })
      synced++
    }

    const seen = new Set<string>()
    for (const g of primaryEvents) {
      if (mirrorIds.has(g.id) || pushedByGoogleId.has(g.id)) continue
      const existingId = existingBySourceId.get(g.id)
      if (g.status === "cancelled") {
        if (existingId) { await prisma.calendarEvent.deleteMany({ where: { id: existingId, userId } }); synced++ }
        continue
      }
      seen.add(g.id)
      const fields = fieldsOf(g)
      if (!fields) continue
      if (existingId) {
        await prisma.calendarEvent.update({ where: { id: existingId }, data: fields })
      } else {
        await prisma.calendarEvent.create({ data: { userId, ...fields, sourceType: "GOOGLE", sourceId: g.id } })
      }
      synced++
    }

    // Suppressions anciennes : showDeleted ne remonte que les récentes. Un importé de la fenêtre
    // absent de la réponse a disparu de Google — seulement si la lecture n'est pas tronquée.
    if (primaryEvents.length < GOOGLE_FETCH_CAP) {
      const { count } = await prisma.calendarEvent.deleteMany({
        where: { userId, sourceType: "GOOGLE", sourceId: { notIn: [...seen] }, startDate: { gte: from, lte: to } },
      })
      synced += count
    }

    revalidatePath("/calendrier")
    return { synced }

  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur inconnue"
    return { synced: 0, error: message }
  }
}

/**
 * Étape « export » de la sync : ERP → Google. Rattrape le backlog des
 * événements manuels de la fenêtre récente jamais poussés (googleEventId
 * NULL) — les nouveaux événements sont déjà poussés à la création.
 */
export async function syncGooglePush(): Promise<SyncResult> {
  const userId = await requireAuth()

  const hasScope = await hasCalendarScope(userId)
  if (!hasScope) return { synced: 0, needsPermission: true }
  const accessToken = await getGoogleAccessToken(userId)
  if (!accessToken) return { synced: 0, needsPermission: true }

  try {
    const pushFrom = new Date()
    pushFrom.setMonth(pushFrom.getMonth() - 1)
    const to = new Date()
    to.setMonth(to.getMonth() + 3)

    const backlog = await prisma.calendarEvent.findMany({
      where: { userId, sourceType: "MANUAL", googleEventId: null, startDate: { gte: pushFrom, lte: to } },
      select: { id: true },
    })
    let synced = 0
    let failed = 0
    for (const row of backlog) {
      if (await pushEventToGoogle(userId, row.id)) synced++
      else failed++
    }
    // Google en panne : ni « N synchronisés », ni horodatage frais (sinon le seuil de
    // fraîcheur bloquait la nouvelle tentative automatique alors que rien n'était parti).
    if (failed > 0) {
      revalidatePath("/calendrier")
      return { synced, error: `${failed} événement${failed > 1 ? "s n'ont" : " n'a"} pas pu être envoyé${failed > 1 ? "s" : ""} à Google Agenda` }
    }

    // Push = dernière étape d'un cycle de synchro (le client fait pull puis
    // push) : on horodate ici la dernière synchro réussie, affichée sur l'agenda.
    await prisma.userProfile.upsert({ where: { userId }, create: { userId, lastGoogleSyncAt: new Date() }, update: { lastGoogleSyncAt: new Date() } })

    revalidatePath("/calendrier")
    return { synced }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur inconnue"
    return { synced: 0, error: message }
  }
}

/** Enregistre le seuil de fraîcheur de la synchro auto (minutes ; 0 = toujours). */
export async function setCalendarSyncThreshold(minutes: number): Promise<void> {
  const userId = await requireAuth()
  const clamped = Math.min(Math.max(Math.round(minutes), 0), 1440) // 0 min → 24 h
  await prisma.userProfile.upsert({ where: { userId }, create: { userId, calendarSyncThresholdMin: clamped }, update: { calendarSyncThresholdMin: clamped } })
  revalidatePath("/settings")
  revalidatePath("/calendrier")
}

/** Date de la dernière synchro Google Agenda réussie (null si jamais). */
export async function getLastGoogleSyncAt(): Promise<Date | null> {
  const session = await auth()
  if (!session) return null
  const profile = await prisma.userProfile.findUnique({
    where: { userId: session.user.id },
    select: { lastGoogleSyncAt: true },
  })
  return profile?.lastGoogleSyncAt ?? null
}

/**
 * Sync complète (compat) : pull puis push — conservée pour les appelants
 * existants ; le calendrier appelle désormais les deux étapes séparément
 * pour visualiser la progression.
 */
export async function syncGoogleEvents(monthsBack: number = 1): Promise<SyncResult> {
  const pull = await syncGooglePull(monthsBack)
  if (pull.needsPermission || pull.error) return pull
  const push = await syncGooglePush()
  return { synced: pull.synced + (push.synced ?? 0), error: push.error, needsPermission: push.needsPermission }
}
