/**
 * Utilitaires pour l'API Google Calendar.
 * Phase 3 — Lecture seule, synchronisation manuelle.
 */

import { prisma } from "@/lib/prisma"

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
const GOOGLE_CALENDAR_API = "https://www.googleapis.com/calendar/v3"

// Scope requis pour lire le calendrier
export const CALENDAR_SCOPES = [
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/calendar.events",
  // calendar (lecture/écriture complète) : nécessaire pour créer l'agenda dédié
  "https://www.googleapis.com/auth/calendar",
].join(" ")

// Nom de l'agenda Google dédié où sont poussés les événements de l'ERP.
export const ERP_CALENDAR_NAME = "ERP Freelance"
// Couleur de base de l'agenda (indigo ERP) — modifiable ensuite dans Google.
const ERP_CALENDAR_BG = "#4f46e5"
const ERP_CALENDAR_FG = "#ffffff"

// ── Types ─────────────────────────────────────────────────────────────────────

export type GoogleCalendarEvent = {
  id: string
  summary: string
  description?: string
  start: { dateTime?: string; date?: string }
  end: { dateTime?: string; date?: string }
  status: string
  htmlLink: string
  updated?: string
}

/** Charge utile pour créer / mettre à jour un événement Google. */
export type GooglePushPayload = {
  summary: string
  description?: string
  /** ISO datetime pour un événement horaire ; sinon utiliser allDay + startDate/endDate. */
  start: Date
  end: Date
  allDay: boolean
}

export type SyncResult = {
  synced: number
  error?: string
  needsPermission?: boolean
}

// ── Fonctions ─────────────────────────────────────────────────────────────────

/**
 * Vérifie si l'utilisateur a accordé les droits Google Calendar.
 */
export async function hasCalendarScope(userId: string): Promise<boolean> {
  const account = await prisma.account.findFirst({
    where: { userId, provider: "google" },
    select: { scope: true },
  })
  if (!account?.scope) return false
  return account.scope.includes("calendar")
}

/**
 * Retourne un access_token valide pour l'utilisateur.
 * Rafraîchit automatiquement si le token est expiré.
 * Retourne null si pas de compte Google ou pas de scope calendar.
 */
export async function getGoogleAccessToken(userId: string): Promise<string | null> {
  const account = await prisma.account.findFirst({
    where: { userId, provider: "google" },
    select: { access_token: true, refresh_token: true, expires_at: true, scope: true },
  })

  if (!account) return null
  if (!account.scope?.includes("calendar")) return null
  if (!account.access_token) return null

  // Si le token expire dans moins de 5 minutes, on le rafraîchit
  const nowSec = Math.floor(Date.now() / 1000)
  const isExpired = account.expires_at ? account.expires_at < nowSec + 300 : false

  if (!isExpired) return account.access_token

  // Refresh
  if (!account.refresh_token) return null

  try {
    const res = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        refresh_token: account.refresh_token,
        grant_type: "refresh_token",
      }),
    })

    if (!res.ok) return null

    const data = await res.json() as {
      access_token: string
      expires_in: number
    }

    // Met à jour le token en base
    await prisma.account.updateMany({
      where: { userId, provider: "google" },
      data: {
        access_token: data.access_token,
        expires_at: nowSec + data.expires_in,
      },
    })

    return data.access_token
  } catch {
    return null
  }
}

/**
 * Récupère les événements Google Calendar sur une période donnée.
 */
export async function fetchGoogleEvents(
  accessToken: string,
  from: Date,
  to: Date,
  calendarId: string = "primary"
): Promise<GoogleCalendarEvent[]> {
  const params = new URLSearchParams({
    timeMin: from.toISOString(),
    timeMax: to.toISOString(),
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "250",
  })

  const res = await fetch(
    `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events?${params}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )

  if (!res.ok) {
    let detail = ""
    try {
      const body = await res.json() as { error?: { message?: string } }
      detail = body?.error?.message ?? ""
    } catch { /* corps non-JSON */ }
    throw new Error(`Google Calendar API ${res.status}${detail ? ` — ${detail}` : ""}`)
  }

  const data = await res.json() as { items?: GoogleCalendarEvent[] }
  return data.items ?? []
}

// ── Agenda dédié "ERP Freelance" ────────────────────────────────────────────────

type GoogleCalendarListEntry = { id: string; summary?: string }

/**
 * Retrouve l'agenda "ERP Freelance" dans la liste de l'utilisateur, ou le crée.
 * Applique une couleur de base au passage. Retourne son id.
 * Lève une erreur en cas d'échec API (l'appelant gère le best-effort).
 */
export async function getOrCreateErpCalendar(accessToken: string): Promise<string> {
  // 1) Cherche un agenda existant portant ce nom
  const listRes = await fetch(`${GOOGLE_CALENDAR_API}/users/me/calendarList`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (listRes.ok) {
    const data = await listRes.json() as { items?: GoogleCalendarListEntry[] }
    const found = data.items?.find(c => c.summary === ERP_CALENDAR_NAME)
    if (found) return found.id
  }

  // 2) Crée l'agenda
  const createRes = await fetch(`${GOOGLE_CALENDAR_API}/calendars`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ summary: ERP_CALENDAR_NAME }),
  })
  if (!createRes.ok) {
    let detail = ""
    try {
      const errBody = await createRes.json() as { error?: { message?: string } }
      detail = errBody?.error?.message ?? ""
    } catch { /* corps non-JSON */ }
    throw new Error(`Google Calendar create ${createRes.status}${detail ? ` — ${detail}` : ""}`)
  }
  const created = await createRes.json() as { id: string }

  // 3) Applique la couleur de base (best-effort : on ignore un éventuel échec)
  try {
    await fetch(
      `${GOOGLE_CALENDAR_API}/users/me/calendarList/${encodeURIComponent(created.id)}?colorRgbFormat=true`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          backgroundColor: ERP_CALENDAR_BG,
          foregroundColor: ERP_CALENDAR_FG,
        }),
      }
    )
  } catch { /* couleur non bloquante */ }

  return created.id
}

// ── Écriture (ERP → Google) ────────────────────────────────────────────────────

/**
 * Formate une date au format YYYY-MM-DD en heure LOCALE (événement journée
 * entière). `toISOString()` utiliserait UTC → décalage d'un jour en fuseau positif.
 */
function toLocalDateString(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

/**
 * Construit le corps JSON attendu par l'API Google à partir d'une charge ERP.
 */
function buildGoogleEventBody(payload: GooglePushPayload) {
  const body: Record<string, unknown> = {
    summary: payload.summary,
    description: payload.description ?? undefined,
  }
  if (payload.allDay) {
    // Google attend des dates de jour (locales). end.date est EXCLUSIF et doit
    // être strictement après start.date (sinon l'API rejette l'événement).
    const startDay = new Date(payload.start); startDay.setHours(0, 0, 0, 0)
    let endDay = new Date(payload.end); endDay.setHours(0, 0, 0, 0)
    if (endDay.getTime() <= startDay.getTime()) {
      endDay = new Date(startDay); endDay.setDate(endDay.getDate() + 1)
    }
    body.start = { date: toLocalDateString(startDay) }
    body.end = { date: toLocalDateString(endDay) }
  } else {
    body.start = { dateTime: payload.start.toISOString() }
    body.end = { dateTime: payload.end.toISOString() }
  }
  return body
}

/**
 * Crée (POST) ou met à jour (PATCH) un événement dans Google Calendar.
 * Retourne l'id Google et la date `updated` renvoyée par l'API.
 * Lève une erreur en cas d'échec — l'appelant gère le best-effort.
 */
export async function pushGoogleEvent(
  accessToken: string,
  calendarId: string,
  payload: GooglePushPayload,
  googleEventId?: string | null
): Promise<{ id: string; updated: string }> {
  const body = buildGoogleEventBody(payload)
  const isUpdate = Boolean(googleEventId)
  const base = `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events`
  const url = isUpdate ? `${base}/${googleEventId}` : base

  const res = await fetch(url, {
    method: isUpdate ? "PATCH" : "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  })

  // Si la mise à jour cible un événement disparu côté Google (404/410),
  // on le recrée pour ne pas perdre la synchro.
  if (isUpdate && (res.status === 404 || res.status === 410)) {
    return pushGoogleEvent(accessToken, calendarId, payload, null)
  }

  if (!res.ok) {
    let detail = ""
    try {
      const errBody = await res.json() as { error?: { message?: string } }
      detail = errBody?.error?.message ?? ""
    } catch { /* corps non-JSON */ }
    throw new Error(`Google Calendar push ${res.status}${detail ? ` — ${detail}` : ""}`)
  }

  const data = await res.json() as { id: string; updated: string }
  return { id: data.id, updated: data.updated }
}

/**
 * Supprime un événement dans Google Calendar.
 * Les statuts 404/410 (déjà supprimé) sont considérés comme un succès.
 */
export async function deleteGoogleEvent(
  accessToken: string,
  calendarId: string,
  googleEventId: string
): Promise<void> {
  const res = await fetch(
    `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events/${googleEventId}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  )

  if (res.ok || res.status === 404 || res.status === 410) return

  let detail = ""
  try {
    const errBody = await res.json() as { error?: { message?: string } }
    detail = errBody?.error?.message ?? ""
  } catch { /* corps non-JSON */ }
  throw new Error(`Google Calendar delete ${res.status}${detail ? ` — ${detail}` : ""}`)
}
