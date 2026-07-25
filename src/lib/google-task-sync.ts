/**
 * Pousse automatiquement les Task datées et les Milestone vers l'agenda Google
 * dédié "ERP Freelance". Miroir unidirectionnel ERP → Google uniquement (contrairement
 * aux CalendarEvent MANUAL qui sont bidirectionnels, cf. src/actions/calendar.ts) —
 * pas de lecture retour, pas d'arbitrage last-write-wins.
 * Tout est best-effort : un échec Google ne doit jamais casser l'action ERP.
 */

import { prisma } from "@/lib/prisma"
import { getGoogleAccessToken, getErpCalendarId, pushGoogleEvent, deleteGoogleEvent } from "@/lib/google-calendar"
import { meetingFormat } from "@/components/modules/entretien/status-config"

function hasTime(d: Date): boolean {
  return d.getHours() !== 0 || d.getMinutes() !== 0
}

/**
 * Synchronise une tâche : pousse (create/update) si elle a une échéance,
 * retire l'événement Google si l'échéance a été vidée.
 */
export async function syncTaskGoogleState(userId: string, taskId: string): Promise<void> {
  try {
    const task = await prisma.task.findFirst({
      where: { id: taskId, OR: [{ project: { userId } }, { userId }] },
      select: { title: true, description: true, dueDate: true, googleEventId: true },
    })
    if (!task) return

    const accessToken = await getGoogleAccessToken(userId)
    if (!accessToken) return
    const calendarId = await getErpCalendarId(userId, accessToken)
    if (!calendarId) return

    if (!task.dueDate) {
      if (task.googleEventId) {
        await deleteGoogleEvent(accessToken, calendarId, task.googleEventId)
        await prisma.task.update({ where: { id: taskId }, data: { googleEventId: null, googleSyncedAt: null } })
      }
      return
    }

    const { id: googleEventId, updated } = await pushGoogleEvent(
      accessToken,
      calendarId,
      {
        summary: `✅ ${task.title}`,
        description: task.description ?? undefined,
        start: task.dueDate,
        end: task.dueDate,
        allDay: true,
      },
      task.googleEventId,
    )
    await prisma.task.update({
      where: { id: taskId },
      data: { googleEventId, googleSyncedAt: updated ? new Date(updated) : new Date() },
    })
  } catch {
    // best-effort : un échec Google ne doit jamais casser l'action ERP
  }
}

/** À appeler avant suppression d'une tâche pour retirer l'événement Google associé. */
export async function removeTaskFromGoogle(userId: string, taskId: string): Promise<void> {
  try {
    const task = await prisma.task.findFirst({
      where: { id: taskId, OR: [{ project: { userId } }, { userId }] },
      select: { googleEventId: true },
    })
    if (!task?.googleEventId) return
    const accessToken = await getGoogleAccessToken(userId)
    if (!accessToken) return
    const calendarId = await getErpCalendarId(userId, accessToken)
    if (!calendarId) return
    await deleteGoogleEvent(accessToken, calendarId, task.googleEventId)
  } catch {
    // best-effort
  }
}

/** Synchronise un jalon (toujours daté — pas de branche "perte de date"). */
export async function syncMilestoneGoogleState(userId: string, milestoneId: string): Promise<void> {
  try {
    const milestone = await prisma.milestone.findFirst({
      where: { id: milestoneId, project: { userId } },
      select: { name: true, date: true, endDate: true, googleEventId: true },
    })
    if (!milestone) return

    const accessToken = await getGoogleAccessToken(userId)
    if (!accessToken) return
    const calendarId = await getErpCalendarId(userId, accessToken)
    if (!calendarId) return

    const { id: googleEventId, updated } = await pushGoogleEvent(
      accessToken,
      calendarId,
      {
        summary: `🚩 ${milestone.name}`,
        start: milestone.date,
        end: milestone.endDate ?? milestone.date,
        allDay: !hasTime(milestone.date),
      },
      milestone.googleEventId,
    )
    await prisma.milestone.update({
      where: { id: milestoneId },
      data: { googleEventId, googleSyncedAt: updated ? new Date(updated) : new Date() },
    })
  } catch {
    // best-effort
  }
}

/** À appeler avant suppression d'un jalon pour retirer l'événement Google associé. */
export async function removeMilestoneFromGoogle(userId: string, milestoneId: string): Promise<void> {
  try {
    const milestone = await prisma.milestone.findFirst({
      where: { id: milestoneId, project: { userId } },
      select: { googleEventId: true },
    })
    if (!milestone?.googleEventId) return
    const accessToken = await getGoogleAccessToken(userId)
    if (!accessToken) return
    const calendarId = await getErpCalendarId(userId, accessToken)
    if (!calendarId) return
    await deleteGoogleEvent(accessToken, calendarId, milestone.googleEventId)
  } catch {
    // best-effort
  }
}

/**
 * Synchronise une candidature/entretien : pousse son PROCHAIN POINT planifié
 * (nextActionAt) vers l'agenda Google, ou retire l'événement si le point a été
 * vidé/validé. Événement horaire si l'heure est renseignée (1h par défaut),
 * sinon journée entière.
 */
export async function syncJobApplicationGoogleState(userId: string, applicationId: string): Promise<void> {
  try {
    const app = await prisma.jobApplication.findFirst({
      where: { id: applicationId, userId },
      select: {
        companyName: true, position: true, location: true,
        nextActionAt: true, nextActionLabel: true, nextActionFormat: true, googleEventId: true,
      },
    })
    if (!app) return

    const accessToken = await getGoogleAccessToken(userId)
    if (!accessToken) return
    const calendarId = await getErpCalendarId(userId, accessToken)
    if (!calendarId) return

    if (!app.nextActionAt) {
      if (app.googleEventId) {
        await deleteGoogleEvent(accessToken, calendarId, app.googleEventId)
        await prisma.jobApplication.update({ where: { id: applicationId }, data: { googleEventId: null, googleSyncedAt: null } })
      }
      return
    }

    const timed = hasTime(app.nextActionAt)
    const end = timed ? new Date(app.nextActionAt.getTime() + 60 * 60 * 1000) : app.nextActionAt
    const fmt = meetingFormat(app.nextActionFormat)
    const description = [fmt ? `${fmt.icon} ${fmt.label}` : null, app.location].filter(Boolean).join(" · ") || undefined
    const { id: googleEventId, updated } = await pushGoogleEvent(
      accessToken,
      calendarId,
      {
        summary: `💼 ${app.companyName} — ${app.nextActionLabel ?? app.position}`,
        description,
        start: app.nextActionAt,
        end,
        allDay: !timed,
      },
      app.googleEventId,
    )
    await prisma.jobApplication.update({
      where: { id: applicationId },
      data: { googleEventId, googleSyncedAt: updated ? new Date(updated) : new Date() },
    })
  } catch {
    // best-effort : un échec Google ne doit jamais casser l'action ERP
  }
}

/** À appeler avant suppression d'une candidature pour retirer l'événement Google associé. */
export async function removeJobApplicationFromGoogle(userId: string, applicationId: string): Promise<void> {
  try {
    const app = await prisma.jobApplication.findFirst({
      where: { id: applicationId, userId },
      select: { googleEventId: true },
    })
    if (!app?.googleEventId) return
    const accessToken = await getGoogleAccessToken(userId)
    if (!accessToken) return
    const calendarId = await getErpCalendarId(userId, accessToken)
    if (!calendarId) return
    await deleteGoogleEvent(accessToken, calendarId, app.googleEventId)
  } catch {
    // best-effort
  }
}
