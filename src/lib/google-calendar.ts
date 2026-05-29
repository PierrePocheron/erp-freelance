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
].join(" ")

// ── Types ─────────────────────────────────────────────────────────────────────

export type GoogleCalendarEvent = {
  id: string
  summary: string
  description?: string
  start: { dateTime?: string; date?: string }
  end: { dateTime?: string; date?: string }
  status: string
  htmlLink: string
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
  to: Date
): Promise<GoogleCalendarEvent[]> {
  const params = new URLSearchParams({
    timeMin: from.toISOString(),
    timeMax: to.toISOString(),
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "250",
  })

  const res = await fetch(`${GOOGLE_CALENDAR_API}/calendars/primary/events?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

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
