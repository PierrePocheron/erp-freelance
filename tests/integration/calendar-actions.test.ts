import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import {
  createCalendarCategory, deleteCalendarCategory, getOrCreateDefaultCategories,
  getCalendarEvents, createCalendarEvent, updateCalendarEvent, deleteCalendarEvent,
  cancelCalendarEvent, uncancelCalendarEvent, setCalendarEventOutcome,
  createCalendarItem, moveCalendarItem, updateCalendarItem, deleteCalendarItem,
  getGoogleCalendarConnectionStatus, syncGooglePull, syncGooglePush, syncGoogleEvents,
  setCalendarSyncThreshold, getLastGoogleSyncAt,
} from "@/actions/calendar"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { zonedMidnight, zonedDateKey } from "@/lib/dates"
import { setTestUser } from "./setup"
import { makeUser, makeClient, makeProject, uniq } from "./helpers/factories"

// Complète calendar-items.test.ts (création des 5 natures, déplacement de tâche,
// catégories de base) : API directe des événements, branches restantes du
// dispatcher, anti-IDOR sur chaque action à id, et toute la synchro Google —
// avec un faux Google branché sur `fetch` (aucun appel réseau, aucun vrai jeton).

// ── Faux Google ───────────────────────────────────────────────────────────────
type Call = { method: string; url: URL; body: Record<string, unknown> | undefined; auth: string | undefined }
type GEvent = {
  id: string; summary?: string; description?: string; status?: string; htmlLink?: string; updated?: string
  start: { dateTime?: string; date?: string }; end: { dateTime?: string; date?: string }
}

let calls: Call[]
let seq: number
let google: {
  calendars: { id: string; summary: string }[]
  events: Record<string, GEvent[][]> // pages d'événements par agenda
  refresh: { status: number; body: unknown }
  override?: (c: Call) => Response | undefined
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })

function route(c: Call): Response {
  const o = google.override?.(c)
  if (o) return o
  const p = c.url.pathname
  if (c.url.host === "oauth2.googleapis.com") return json(google.refresh.body, google.refresh.status)
  if (p === "/calendar/v3/users/me/calendarList" && c.method === "GET") return json({ items: google.calendars })
  if (p.startsWith("/calendar/v3/users/me/calendarList/")) return json({})
  if (p === "/calendar/v3/calendars" && c.method === "POST") {
    google.calendars.push({ id: "erp-cal@group", summary: String(c.body?.summary) })
    return json({ id: "erp-cal@group" })
  }
  const m = /^\/calendar\/v3\/calendars\/([^/]+)\/events(?:\/([^/]+))?$/.exec(p)
  if (m) {
    if (c.method === "GET") {
      const pages = google.events[decodeURIComponent(m[1])] ?? [[]]
      const i = Number(c.url.searchParams.get("pageToken") ?? 0)
      return json({ items: pages[i], nextPageToken: i + 1 < pages.length ? String(i + 1) : undefined })
    }
    if (c.method === "DELETE") return new Response(null, { status: 204 })
    return json({ id: m[2] ?? `g-${++seq}`, updated: "2026-09-01T10:00:00.000Z" })
  }
  throw new Error(`appel Google inattendu : ${c.method} ${c.url}`)
}

beforeEach(() => {
  calls = []
  seq = 0
  google = { calendars: [], events: {}, refresh: { status: 200, body: { access_token: "at-refreshed", expires_in: 3599 } } }
  vi.stubGlobal("fetch", vi.fn(async (input: string, init: RequestInit = {}) => {
    const headers = (init.headers ?? {}) as Record<string, string>
    const body = typeof init.body === "string" ? JSON.parse(init.body)
      : init.body instanceof URLSearchParams ? Object.fromEntries(init.body) : undefined
    const call: Call = { method: init.method ?? "GET", url: new URL(input), body, auth: headers.Authorization }
    calls.push(call)
    return route(call)
  }))
})
afterEach(() => vi.unstubAllGlobals())

const eventCalls = (method: string) => calls.filter((c) => c.method === method && c.url.pathname.includes("/events"))

// ── Fabriques locales ─────────────────────────────────────────────────────────
const DAY = 86_400_000
/** Instant relatif à maintenant (les fenêtres de synchro sont glissantes). */
const inDays = (n: number) => new Date(Math.floor((Date.now() + n * DAY) / 60_000) * 60_000)

async function signIn() {
  const user = await makeUser()
  setTestUser(user.id)
  return user
}

async function connectGoogle(userId: string, over: Record<string, unknown> = {}) {
  return prisma.account.create({
    data: {
      userId, type: "oauth", provider: "google", providerAccountId: uniq("gacc"),
      access_token: "at-test", refresh_token: "rt-test",
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      scope: "openid email https://www.googleapis.com/auth/calendar",
      ...over,
    },
  })
}

async function makeEvent(userId: string, over: Record<string, unknown> = {}) {
  return prisma.calendarEvent.create({
    data: { userId, title: "Événement", startDate: new Date("2026-10-02T10:00:00Z"), ...over },
  })
}

const gTimed = (id: string, summary: string, start: Date, over: Partial<GEvent> = {}): GEvent => ({
  id, summary, status: "confirmed", htmlLink: "",
  start: { dateTime: start.toISOString() }, end: { dateTime: new Date(start.getTime() + 3_600_000).toISOString() },
  ...over,
})

// ══════════════════════════════════════════════════════════════════════════════

describe("catégories", () => {
  it("refuse un nom vide ou déjà pris", async () => {
    await signIn()
    expect(await createCalendarCategory({ name: "   ", color: "#000" })).toEqual({ error: "Le nom est requis" })
    expect((await createCalendarCategory({ name: " Sport ", color: "#0f0" })).category?.name).toBe("Sport")
    expect(await createCalendarCategory({ name: "Sport", color: "#f00" })).toEqual({ error: "Ce nom de catégorie existe déjà" })
  })

  it("ne supprime ni une catégorie par défaut ni celle d'un autre compte", async () => {
    await signIn()
    const { category: victimCat } = await createCalendarCategory({ name: "Privée", color: "#123456" })

    await signIn()
    const defaults = await getOrCreateDefaultCategories()
    await deleteCalendarCategory(defaults[0].id)
    await deleteCalendarCategory(victimCat!.id)

    expect(await prisma.calendarCategory.count({ where: { id: { in: [defaults[0].id, victimCat!.id] } } })).toBe(2)
  })
})

describe("événements manuels — API directe", () => {
  it("crée un événement avec sa catégorie, refuse un titre vide", async () => {
    await signIn()
    expect(await createCalendarEvent({ title: "  ", startDate: new Date() })).toEqual({ error: "Le titre est requis" })

    const { category } = await createCalendarCategory({ name: "Perso", color: "#ff0000" })
    const { event } = await createCalendarEvent({
      title: " Dentiste ", description: "Contrôle", startDate: zonedMidnight("2026-09-03"), allDay: true, categoryId: category!.id,
    })

    expect(event).toMatchObject({ title: "Dentiste", description: "Contrôle", allDay: true, sourceType: "MANUAL" })
    expect(event!.category).toMatchObject({ name: "Perso", color: "#ff0000" })
  })

  it("filtre la période demandée", async () => {
    const user = await signIn()
    for (const [title, d] of [["Avant", "2026-09-01"], ["Dedans", "2026-09-15"], ["Après", "2026-10-01"]]) {
      await makeEvent(user.id, { title, startDate: zonedMidnight(d) })
    }
    const events = await getCalendarEvents({ from: zonedMidnight("2026-09-10"), to: zonedMidnight("2026-09-20") })
    expect(events.map((e) => e.title)).toEqual(["Dedans"])
  })

  it("mise à jour partielle : seuls les champs fournis changent", async () => {
    const user = await signIn()
    const { category } = await createCalendarCategory({ name: "Perso", color: "#ff0000" })
    const ev = await makeEvent(user.id, { title: "Avant", description: "garde-moi", categoryId: category!.id })

    await updateCalendarEvent(ev.id, { title: "Après", categoryId: null })

    const after = await prisma.calendarEvent.findUniqueOrThrow({ where: { id: ev.id } })
    expect([after.title, after.description, after.categoryId, after.startDate]).toEqual(["Après", "garde-moi", null, ev.startDate])
  })

  it("modifier / supprimer / annuler l'événement d'un autre compte n'a aucun effet", async () => {
    const victim = await makeUser()
    const ev = await makeEvent(victim.id, { title: "Privé" })
    await signIn()

    await updateCalendarEvent(ev.id, { title: "Piraté" })
    await deleteCalendarEvent(ev.id)
    await expect(cancelCalendarEvent(ev.id, "x")).rejects.toThrow("Non autorisé")
    await expect(uncancelCalendarEvent(ev.id)).rejects.toThrow("Non autorisé")
    await expect(setCalendarEventOutcome(ev.id, "x")).rejects.toThrow("Non autorisé")

    const after = await prisma.calendarEvent.findUniqueOrThrow({ where: { id: ev.id } })
    expect([after.title, after.cancelledAt, after.outcome]).toEqual(["Privé", null, null])
  })

  it("supprime son propre événement", async () => {
    const user = await signIn()
    const ev = await makeEvent(user.id)
    await deleteCalendarEvent(ev.id)
    expect(await prisma.calendarEvent.count({ where: { id: ev.id } })).toBe(0)
  })

  it("annule (raison facultative), rétablit, puis enregistre un compte-rendu", async () => {
    const user = await signIn()
    const ev = await makeEvent(user.id)
    const read = () => prisma.calendarEvent.findUniqueOrThrow({ where: { id: ev.id } })

    await cancelCalendarEvent(ev.id, "  Malade  ")
    expect((await read()).cancelledAt).not.toBeNull()
    expect((await read()).outcome).toBe("Malade")

    await uncancelCalendarEvent(ev.id)
    expect((await read()).cancelledAt).toBeNull()

    await cancelCalendarEvent(ev.id)
    expect((await read()).outcome).toBeNull()

    await setCalendarEventOutcome(ev.id, " RDV fructueux ")
    expect(await read()).toMatchObject({ outcome: "RDV fructueux", cancelledAt: null })

    await setCalendarEventOutcome(ev.id, "   ")
    expect((await read()).outcome).toBeNull()
  })
})

describe("createCalendarItem — branches restantes", () => {
  it.each([
    ["milestone", "Un jalon doit être rattaché à un projet"],
    ["note", "Une note doit être rattachée à un projet"],
    ["interaction", "Une interaction doit être rattachée à un client"],
    ["reminder", "Un rappel doit être rattaché à un client"],
  ] as const)("%s sans rattachement → refusé", async (nature, error) => {
    await signIn()
    expect(await createCalendarItem({ nature, title: "X", startDate: new Date() })).toEqual({ error })
  })

  it("tâche sur un contact : priorité LOW par défaut, description nettoyée", async () => {
    const user = await signIn()
    const client = await makeClient(user.id)
    await createCalendarItem({ nature: "task", title: "Appeler", description: "  ", startDate: new Date(), clientId: client.id })
    const task = await prisma.task.findFirstOrThrow({ where: { clientId: client.id } })
    expect([task.userId, task.priority, task.description]).toEqual([user.id, "LOW", null])
  })

  it("refuse une tâche ou un événement rattaché au contact / projet d'un autre compte", async () => {
    const victim = await makeUser()
    const vClient = await makeClient(victim.id)
    const vProject = await makeProject(victim.id, vClient.id)
    const me = await signIn()

    for (const input of [
      { nature: "task" as const, clientId: vClient.id },
      { nature: "task" as const, projectId: vProject.id },
      { nature: "event" as const, clientId: vClient.id },
      { nature: "event" as const, projectId: vProject.id },
      { nature: "note" as const, projectId: vProject.id },
      { nature: "reminder" as const, clientId: vClient.id },
    ]) {
      expect((await createCalendarItem({ ...input, title: "X", startDate: new Date() })).error).toMatch(/introuvable/)
    }
    expect(await prisma.task.count()).toBe(0)
    expect(await prisma.calendarEvent.count({ where: { userId: me.id } })).toBe(0)
    expect(await prisma.reminder.count()).toBe(0)
    expect(await prisma.journalEntry.count()).toBe(0)
  })

  it("rappel : la description est accolée au titre", async () => {
    const user = await signIn()
    const client = await makeClient(user.id)
    await createCalendarItem({ nature: "reminder", title: "Relancer", description: "Devis envoyé", startDate: new Date(), clientId: client.id })
    expect((await prisma.reminder.findFirstOrThrow({ where: { clientId: client.id } })).note).toBe("Relancer — Devis envoyé")
  })

  it("note : entrée de journal + événement daté qui la référence", async () => {
    const user = await signIn()
    const client = await makeClient(user.id)
    const project = await makeProject(user.id, client.id)

    const out = await createCalendarItem({
      nature: "note", title: "Point d'étape", description: "Maquettes validées", startDate: zonedMidnight("2026-09-03"), allDay: true, projectId: project.id,
    })

    expect(out).toEqual({})
    const entry = await prisma.journalEntry.findFirstOrThrow({ where: { projectId: project.id } })
    expect(entry.content).toBe("Point d'étape\nMaquettes validées")
    const ev = await prisma.calendarEvent.findFirstOrThrow({ where: { userId: user.id } })
    expect(ev).toMatchObject({ sourceType: "MANUAL", sourceId: entry.id, projectId: project.id, allDay: true })
  })
})

describe("moveCalendarItem — branches restantes", () => {
  it("reprogramme rappel, interaction et événement manuel", async () => {
    const user = await signIn()
    const client = await makeClient(user.id)
    const reminder = await prisma.reminder.create({ data: { clientId: client.id, dueDate: new Date("2026-10-01T08:00:00Z") } })
    const interaction = await prisma.interaction.create({ data: { clientId: client.id, date: new Date("2026-10-01T08:00:00Z"), channel: "CALL", summary: "Appel" } })
    const ev = await makeEvent(user.id)
    const newStart = zonedMidnight("2026-10-08")
    const newEnd = zonedMidnight("2026-10-09")

    expect(await moveCalendarItem("reminder", reminder.id, newStart, null, true)).toEqual({})
    expect(await moveCalendarItem("interaction", interaction.id, newStart, null, true)).toEqual({})
    expect(await moveCalendarItem("manual", ev.id, newStart, newEnd, true)).toEqual({})

    expect((await prisma.reminder.findUniqueOrThrow({ where: { id: reminder.id } })).dueDate).toEqual(newStart)
    expect((await prisma.interaction.findUniqueOrThrow({ where: { id: interaction.id } })).date).toEqual(newStart)
    expect(await prisma.calendarEvent.findUniqueOrThrow({ where: { id: ev.id } })).toMatchObject({ startDate: newStart, endDate: newEnd, allDay: true })
  })

  it("ne déplace aucune entité d'un autre compte", async () => {
    const victim = await makeUser()
    const vClient = await makeClient(victim.id)
    const vProject = await makeProject(victim.id, vClient.id)
    const old = new Date("2026-10-01T08:00:00Z")
    const milestone = await prisma.milestone.create({ data: { projectId: vProject.id, name: "J", date: old } })
    const reminder = await prisma.reminder.create({ data: { clientId: vClient.id, dueDate: old } })
    const interaction = await prisma.interaction.create({ data: { clientId: vClient.id, date: old, channel: "CALL", summary: "A" } })
    const ev = await makeEvent(victim.id, { startDate: old })
    await signIn()
    const target = new Date("2027-01-01T08:00:00Z")

    expect(await moveCalendarItem("milestone", milestone.id, target, null, false)).toEqual({ error: "Jalon introuvable" })
    expect(await moveCalendarItem("reminder", reminder.id, target, null, false)).toEqual({ error: "Rappel introuvable" })
    expect(await moveCalendarItem("interaction", interaction.id, target, null, false)).toEqual({ error: "Interaction introuvable" })
    await moveCalendarItem("manual", ev.id, target, null, false)

    expect((await prisma.milestone.findUniqueOrThrow({ where: { id: milestone.id } })).date).toEqual(old)
    expect((await prisma.reminder.findUniqueOrThrow({ where: { id: reminder.id } })).dueDate).toEqual(old)
    expect((await prisma.interaction.findUniqueOrThrow({ where: { id: interaction.id } })).date).toEqual(old)
    expect((await prisma.calendarEvent.findUniqueOrThrow({ where: { id: ev.id } })).startDate).toEqual(old)
  })
})

describe("updateCalendarItem", () => {
  it("met à jour tâche, jalon, rappel et interaction", async () => {
    const user = await signIn()
    const client = await makeClient(user.id)
    const project = await makeProject(user.id, client.id)
    const d0 = new Date("2026-10-01T08:00:00Z")
    const d1 = zonedMidnight("2026-10-15")
    const task = await prisma.task.create({ data: { userId: user.id, projectId: project.id, clientId: client.id, title: "T", dueDate: d0 } })
    const milestone = await prisma.milestone.create({ data: { projectId: project.id, name: "J", date: d0 } })
    const reminder = await prisma.reminder.create({ data: { clientId: client.id, dueDate: d0, note: "R" } })
    const interaction = await prisma.interaction.create({ data: { clientId: client.id, date: d0, channel: "CALL", summary: "I" } })

    expect(await updateCalendarItem("task", task.id, { title: "T2", description: "desc", startDate: d1, priority: "URGENT" })).toEqual({})
    expect(await updateCalendarItem("milestone", milestone.id, { title: "J2", startDate: d1 })).toEqual({})
    expect(await updateCalendarItem("reminder", reminder.id, { title: "R2", startDate: d1 })).toEqual({})
    expect(await updateCalendarItem("interaction", interaction.id, { title: "I2", description: "réponse", startDate: d1, channel: "EMAIL" })).toEqual({})

    expect(await prisma.task.findUniqueOrThrow({ where: { id: task.id } })).toMatchObject({ title: "T2", description: "desc", dueDate: d1, priority: "URGENT" })
    expect(await prisma.milestone.findUniqueOrThrow({ where: { id: milestone.id } })).toMatchObject({ name: "J2", date: d1 })
    expect(await prisma.reminder.findUniqueOrThrow({ where: { id: reminder.id } })).toMatchObject({ note: "R2", dueDate: d1 })
    expect(await prisma.interaction.findUniqueOrThrow({ where: { id: interaction.id } })).toMatchObject({ summary: "I2", response: "réponse", date: d1, channel: "EMAIL" })
  })

  it("mise à jour vide : la tâche garde sa priorité et ses champs", async () => {
    const user = await signIn()
    const task = await prisma.task.create({ data: { userId: user.id, title: "T", priority: "HIGH" } })
    expect(await updateCalendarItem("task", task.id, { priority: null })).toEqual({})
    expect(await prisma.task.findUniqueOrThrow({ where: { id: task.id } })).toMatchObject({ title: "T", priority: "HIGH" })
  })

  it("met à jour un événement manuel (tous les champs)", async () => {
    const user = await signIn()
    const client = await makeClient(user.id)
    const { category } = await createCalendarCategory({ name: "Perso", color: "#f00" })
    const ev = await makeEvent(user.id)
    const start = zonedMidnight("2026-10-20")

    expect(await updateCalendarItem("manual", ev.id, {
      title: "Nouveau", description: "d", startDate: start, endDate: null, allDay: true, categoryId: category!.id, clientId: client.id, projectId: null,
    })).toEqual({})

    expect(await prisma.calendarEvent.findUniqueOrThrow({ where: { id: ev.id } })).toMatchObject({
      title: "Nouveau", description: "d", startDate: start, endDate: null, allDay: true, categoryId: category!.id, clientId: client.id,
    })
  })

  it("ne modifie aucune entité d'un autre compte", async () => {
    const victim = await makeUser()
    const vClient = await makeClient(victim.id)
    const vProject = await makeProject(victim.id, vClient.id)
    const d0 = new Date("2026-10-01T08:00:00Z")
    const task = await prisma.task.create({ data: { userId: victim.id, projectId: vProject.id, title: "T", dueDate: d0 } })
    const milestone = await prisma.milestone.create({ data: { projectId: vProject.id, name: "J", date: d0 } })
    const reminder = await prisma.reminder.create({ data: { clientId: vClient.id, dueDate: d0, note: "R" } })
    const interaction = await prisma.interaction.create({ data: { clientId: vClient.id, date: d0, channel: "CALL", summary: "I" } })
    const ev = await makeEvent(victim.id, { title: "E" })
    await signIn()

    expect(await updateCalendarItem("task", task.id, { title: "X" })).toEqual({ error: "Tâche introuvable" })
    expect(await updateCalendarItem("milestone", milestone.id, { title: "X" })).toEqual({ error: "Jalon introuvable" })
    expect(await updateCalendarItem("reminder", reminder.id, { title: "X" })).toEqual({ error: "Rappel introuvable" })
    expect(await updateCalendarItem("interaction", interaction.id, { title: "X" })).toEqual({ error: "Interaction introuvable" })
    await updateCalendarItem("manual", ev.id, { title: "X" })

    expect((await prisma.task.findUniqueOrThrow({ where: { id: task.id } })).title).toBe("T")
    expect((await prisma.milestone.findUniqueOrThrow({ where: { id: milestone.id } })).name).toBe("J")
    expect((await prisma.reminder.findUniqueOrThrow({ where: { id: reminder.id } })).note).toBe("R")
    expect((await prisma.interaction.findUniqueOrThrow({ where: { id: interaction.id } })).summary).toBe("I")
    expect((await prisma.calendarEvent.findUniqueOrThrow({ where: { id: ev.id } })).title).toBe("E")
  })

  // Régression corrigée le 29/09/2026 (IDOR, fuite de données) — src/actions/calendar.ts:792-803 (updateCalendarItem
  // « manual » → updateCalendarEvent:259) et createCalendarEvent:181 : projectId,
  // clientId et categoryId sont écrits SANS contrôle de propriété, alors que
  // createCalendarItem les vérifie (assertProjectOwnership/assertClientOwnership).
  // La page /calendrier fait ensuite `LEFT JOIN "Project" p ON p.id = e."projectId"`
  // (et Client, CalendarCategory) sans filtre userId : l'attaquant lit le nom du
  // projet, du client et de la catégorie de sa victime dans son propre agenda.
  it("refuse de rattacher son événement au projet / contact / catégorie d'un autre compte", async () => {
    const victim = await makeUser()
    const vClient = await makeClient(victim.id, { name: "Client secret" })
    const vProject = await makeProject(victim.id, vClient.id, "Projet secret")
    const vCat = await prisma.calendarCategory.create({ data: { userId: victim.id, name: "Catégorie secrète", color: "#000" } })
    const me = await signIn()
    const ev = await makeEvent(me.id)

    const out = await updateCalendarItem("manual", ev.id, { projectId: vProject.id, clientId: vClient.id, categoryId: vCat.id })
    await createCalendarEvent({ title: "Autre", startDate: new Date(), categoryId: vCat.id, projectId: vProject.id })

    expect(out.error).toBeTruthy()
    expect(await prisma.calendarEvent.count({ where: { userId: me.id, OR: [{ projectId: vProject.id }, { clientId: vClient.id }, { categoryId: vCat.id }] } })).toBe(0)
    expect((await getCalendarEvents()).some((e) => e.category?.name === "Catégorie secrète")).toBe(false)
  })
})

describe("deleteCalendarItem — branches restantes", () => {
  it("supprime jalon, rappel, interaction et événement manuel", async () => {
    const user = await signIn()
    const client = await makeClient(user.id)
    const project = await makeProject(user.id, client.id)
    const d = new Date()
    const milestone = await prisma.milestone.create({ data: { projectId: project.id, name: "J", date: d } })
    const reminder = await prisma.reminder.create({ data: { clientId: client.id, dueDate: d } })
    const interaction = await prisma.interaction.create({ data: { clientId: client.id, date: d, channel: "CALL", summary: "I" } })
    const ev = await makeEvent(user.id)

    for (const [type, id] of [["milestone", milestone.id], ["reminder", reminder.id], ["interaction", interaction.id], ["manual", ev.id]] as const) {
      expect(await deleteCalendarItem(type, id)).toEqual({})
    }
    expect([await prisma.milestone.count(), await prisma.reminder.count(), await prisma.interaction.count(), await prisma.calendarEvent.count()]).toEqual([0, 0, 0, 0])
  })

  it("ne supprime aucune entité d'un autre compte", async () => {
    const victim = await makeUser()
    const vClient = await makeClient(victim.id)
    const vProject = await makeProject(victim.id, vClient.id)
    const d = new Date()
    const milestone = await prisma.milestone.create({ data: { projectId: vProject.id, name: "J", date: d } })
    const reminder = await prisma.reminder.create({ data: { clientId: vClient.id, dueDate: d } })
    const interaction = await prisma.interaction.create({ data: { clientId: vClient.id, date: d, channel: "CALL", summary: "I" } })
    const ev = await makeEvent(victim.id, { googleEventId: "g-victim" })
    await connectGoogle((await signIn()).id)

    expect(await deleteCalendarItem("milestone", milestone.id)).toEqual({ error: "Jalon introuvable" })
    expect(await deleteCalendarItem("reminder", reminder.id)).toEqual({ error: "Rappel introuvable" })
    expect(await deleteCalendarItem("interaction", interaction.id)).toEqual({ error: "Interaction introuvable" })
    await deleteCalendarItem("manual", ev.id)

    expect([await prisma.milestone.count(), await prisma.reminder.count(), await prisma.interaction.count(), await prisma.calendarEvent.count()]).toEqual([1, 1, 1, 1])
    expect(eventCalls("DELETE")).toHaveLength(0)
  })
})

// ── Synchro Google ────────────────────────────────────────────────────────────

describe("push ERP → Google (best-effort)", () => {
  it("sans compte Google : l'événement est créé, aucun appel réseau", async () => {
    await signIn()
    expect(await createCalendarItem({ nature: "event", title: "Hors ligne", startDate: new Date() })).toEqual({})
    expect(await prisma.calendarEvent.count()).toBe(1)
    expect(calls).toHaveLength(0)
  })

  it("premier push : crée l'agenda « ERP Freelance », le mémorise et stocke l'id Google", async () => {
    const user = await signIn()
    await connectGoogle(user.id)

    await createCalendarItem({ nature: "event", title: "Atelier", startDate: new Date("2026-10-02T12:00:00Z") })

    expect(calls.map((c) => `${c.method} ${c.url.pathname}`)).toEqual([
      "GET /calendar/v3/users/me/calendarList",
      "POST /calendar/v3/calendars",
      "PATCH /calendar/v3/users/me/calendarList/erp-cal%40group",
      "POST /calendar/v3/calendars/erp-cal%40group/events",
    ])
    const post = eventCalls("POST")[0]
    expect(post.auth).toBe("Bearer at-test")
    // Sans fin : 30 min par défaut.
    expect(post.body).toMatchObject({ summary: "Atelier", start: { dateTime: "2026-10-02T12:00:00.000Z" }, end: { dateTime: "2026-10-02T12:30:00.000Z" } })

    const ev = await prisma.calendarEvent.findFirstOrThrow()
    expect([ev.googleEventId, ev.googleSyncedAt?.toISOString()]).toEqual(["g-1", "2026-09-01T10:00:00.000Z"])
    expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).googleErpCalendarId).toBe("erp-cal@group")
  })

  it("journée entière du 03/09 (serveur en UTC) : poussée le 03/09 chez Google", async () => {
    const user = await signIn()
    await connectGoogle(user.id)
    await prisma.user.update({ where: { id: user.id }, data: { googleErpCalendarId: "erp-cal@group" } })

    await createCalendarItem({ nature: "event", title: "Anniversaire", startDate: zonedMidnight("2026-09-03"), allDay: true })

    expect(calls).toHaveLength(1) // agenda déjà mémorisé → pas de calendarList
    expect(calls[0].body).toMatchObject({ start: { date: "2026-09-03" }, end: { date: "2026-09-04" } })
  })

  it("réutilise l'agenda existant et met à jour (PATCH) un événement déjà poussé lors d'un déplacement", async () => {
    const user = await signIn()
    await connectGoogle(user.id)
    google.calendars = [{ id: "existing@group", summary: "ERP Freelance" }]
    const ev = await makeEvent(user.id, { googleEventId: "g-42" })

    await moveCalendarItem("manual", ev.id, new Date("2026-10-05T09:00:00Z"), new Date("2026-10-05T10:00:00Z"), false)

    expect(eventCalls("PATCH").map((c) => c.url.pathname)).toEqual(["/calendar/v3/calendars/existing%40group/events/g-42"])
    expect(eventCalls("PATCH")[0].body).toMatchObject({ end: { dateTime: "2026-10-05T10:00:00.000Z" } })
    expect(calls.some((c) => c.method === "POST")).toBe(false)
  })

  it("une panne Google ne casse pas l'action ERP", async () => {
    const user = await signIn()
    await connectGoogle(user.id)
    google.override = () => json({ error: { message: "Backend Error" } }, 500)

    expect(await createCalendarItem({ nature: "event", title: "Résilient", startDate: new Date() })).toEqual({})
    expect((await prisma.calendarEvent.findFirstOrThrow()).googleEventId).toBeNull()
  })

  it("un événement importé de Google, modifié dans l'ERP, est répercuté sur l'agenda principal", async () => {
    const user = await signIn()
    await connectGoogle(user.id)
    const imported = await makeEvent(user.id, { sourceType: "GOOGLE", sourceId: "g-primary-1" })
    const orphan = await makeEvent(user.id, { sourceType: "GOOGLE", sourceId: null })

    await updateCalendarItem("manual", imported.id, { title: "Renommé dans l'ERP" })
    await updateCalendarItem("manual", orphan.id, { title: "Sans id Google" })

    expect(calls.map((c) => `${c.method} ${c.url.pathname}`)).toEqual(["PATCH /calendar/v3/calendars/primary/events/g-primary-1"])
    expect(calls[0].body).toMatchObject({ summary: "Renommé dans l'ERP" })
  })

  it("supprimer un événement poussé le retire de l'agenda ERP", async () => {
    const user = await signIn()
    await connectGoogle(user.id)
    await prisma.user.update({ where: { id: user.id }, data: { googleErpCalendarId: "erp-cal@group" } })
    const ev = await makeEvent(user.id, { googleEventId: "g-9" })

    expect(await deleteCalendarItem("manual", ev.id)).toEqual({})

    expect(calls.map((c) => `${c.method} ${c.url.pathname}`)).toEqual(["DELETE /calendar/v3/calendars/erp-cal%40group/events/g-9"])
    expect(await prisma.calendarEvent.count()).toBe(0)
  })

  it("suppression sans agenda ERP mémorisé : locale seulement, aucun appel", async () => {
    const user = await signIn()
    await connectGoogle(user.id)
    const ev = await makeEvent(user.id, { googleEventId: "g-9" })
    expect(await deleteCalendarItem("manual", ev.id)).toEqual({})
    expect(calls).toHaveLength(0)
  })
})

describe("état de la connexion Google", () => {
  it("non connecté : pas de compte, ou compte sans le droit agenda", async () => {
    const user = await signIn()
    expect(await getGoogleCalendarConnectionStatus()).toEqual({ status: "disconnected" })
    await connectGoogle(user.id, { scope: "openid email" })
    expect(await getGoogleCalendarConnectionStatus()).toEqual({ status: "disconnected" })
    expect(calls).toHaveLength(0)
  })

  it("connecté quand l'API répond", async () => {
    const user = await signIn()
    await connectGoogle(user.id)
    expect(await getGoogleCalendarConnectionStatus()).toEqual({ status: "connected" })
    expect(calls[0].url.searchParams.get("maxResults")).toBe("1")
    expect(calls[0].auth).toBe("Bearer at-test")
  })

  it.each([401, 403])("accès révoqué côté Google (%i) → erreur « réautorisez »", async (status) => {
    const user = await signIn()
    await connectGoogle(user.id)
    google.override = () => json({}, status)
    expect(await getGoogleCalendarConnectionStatus()).toEqual({ status: "error", detail: "Accès Google refusé. Réautorisez l'accès à votre agenda." })
  })

  it("autre statut ou réseau coupé → erreur explicite", async () => {
    const user = await signIn()
    await connectGoogle(user.id)
    google.override = () => json({}, 503)
    expect(await getGoogleCalendarConnectionStatus()).toEqual({ status: "error", detail: "Google Calendar API 503" })
    google.override = () => { throw new TypeError("fetch failed") }
    expect(await getGoogleCalendarConnectionStatus()).toEqual({ status: "error", detail: "Impossible de contacter Google Calendar." })
  })

  it("jeton expiré : rafraîchi, enregistré en base, puis utilisé", async () => {
    const user = await signIn()
    await connectGoogle(user.id, { expires_at: Math.floor(Date.now() / 1000) + 60 }) // < 5 min → refresh

    expect(await getGoogleCalendarConnectionStatus()).toEqual({ status: "connected" })

    const [refresh, check] = calls
    expect([refresh.method, refresh.url.host]).toEqual(["POST", "oauth2.googleapis.com"])
    expect(refresh.body).toMatchObject({ grant_type: "refresh_token", refresh_token: "rt-test" })
    expect(check.auth).toBe("Bearer at-refreshed")
    const account = await prisma.account.findFirstOrThrow({ where: { userId: user.id } })
    expect(account.access_token).toBe("at-refreshed")
    expect(account.expires_at).toBeGreaterThan(Math.floor(Date.now() / 1000) + 3500)
  })

  it("refresh refusé, absent ou en échec réseau → erreur « jeton expiré »", async () => {
    const expired = { expires_at: Math.floor(Date.now() / 1000) - 10 }
    const detail = "Le jeton d'accès a expiré ou a été révoqué. Réautorisez l'accès."

    const u1 = await signIn()
    await connectGoogle(u1.id, expired)
    google.refresh = { status: 400, body: { error: "invalid_grant" } }
    expect(await getGoogleCalendarConnectionStatus()).toEqual({ status: "error", detail })

    const u2 = await signIn()
    await connectGoogle(u2.id, { ...expired, refresh_token: null })
    google.override = () => { throw new TypeError("fetch failed") }
    expect(await getGoogleCalendarConnectionStatus()).toEqual({ status: "error", detail })

    const u3 = await signIn()
    await connectGoogle(u3.id, expired)
    expect(await getGoogleCalendarConnectionStatus()).toEqual({ status: "error", detail })

    const u4 = await signIn()
    await connectGoogle(u4.id, { access_token: null })
    expect(await getGoogleCalendarConnectionStatus()).toEqual({ status: "error", detail })
  })
})

describe("syncGooglePull — Google → ERP", () => {
  it("sans droit agenda, ou jeton impossible à rafraîchir → needsPermission", async () => {
    const u1 = await signIn()
    expect(await syncGooglePull()).toEqual({ synced: 0, needsPermission: true })
    await connectGoogle(u1.id, { expires_at: 1, refresh_token: null })
    expect(await syncGooglePull()).toEqual({ synced: 0, needsPermission: true })
    expect(calls).toHaveLength(0)
  })

  it("importe horaires et journées entières ; ignore annulés, sans titre, sans début", async () => {
    const user = await signIn()
    await connectGoogle(user.id)
    google.events.primary = [[
      gTimed("g-timed", "Réunion", new Date("2026-09-03T12:00:00Z"), { description: "Ordre du jour" }),
      { id: "g-allday", summary: "Anniversaire Hugo", status: "confirmed", start: { date: "2026-09-03" }, end: { date: "2026-09-04" } },
      gTimed("g-cancelled", "Annulé", new Date("2026-09-04T12:00:00Z"), { status: "cancelled" }),
      gTimed("g-untitled", "", new Date("2026-09-04T12:00:00Z")),
      { id: "g-nostart", summary: "Bizarre", status: "confirmed", start: {}, end: {} },
    ]]

    expect(await syncGooglePull()).toEqual({ synced: 2 })

    const rows = await prisma.calendarEvent.findMany({ where: { userId: user.id }, orderBy: { title: "asc" } })
    expect(rows.map((r) => [r.title, r.sourceType, r.sourceId, r.allDay])).toEqual([
      ["Anniversaire Hugo", "GOOGLE", "g-allday", true],
      ["Réunion", "GOOGLE", "g-timed", false],
    ])
    // Serveur en UTC : la journée entière du 03/09 reste le 03/09 à Paris
    // (minuit Paris = 22:00Z la veille), fin exclusive le 04/09.
    const allDay = rows[0]
    expect(allDay.startDate.toISOString()).toBe("2026-09-02T22:00:00.000Z")
    expect([zonedDateKey(allDay.startDate), zonedDateKey(allDay.endDate!)]).toEqual(["2026-09-03", "2026-09-04"])
    expect(rows[1]).toMatchObject({ description: "Ordre du jour", startDate: new Date("2026-09-03T12:00:00Z") })
  })

  it("resynchroniser met à jour l'événement importé au lieu de le dupliquer", async () => {
    const user = await signIn()
    await connectGoogle(user.id)
    const start = inDays(5)
    google.events.primary = [[gTimed("g-1", "Version 1", start)]]
    await syncGooglePull()
    google.events.primary = [[gTimed("g-1", "Version 2", new Date(start.getTime() + 3_600_000))]]

    expect(await syncGooglePull()).toEqual({ synced: 1 })

    const rows = await prisma.calendarEvent.findMany({ where: { userId: user.id } })
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ title: "Version 2", startDate: new Date(start.getTime() + 3_600_000) })
  })

  it("suit la pagination (nextPageToken)", async () => {
    const user = await signIn()
    await connectGoogle(user.id)
    google.events.primary = [
      [gTimed("p1", "Page 1", inDays(1))],
      [gTimed("p2", "Page 2", inDays(2))],
      [gTimed("p3", "Page 3", inDays(3))],
    ]
    expect(await syncGooglePull()).toEqual({ synced: 3 })
    expect(eventCalls("GET").map((c) => c.url.searchParams.get("pageToken"))).toEqual([null, "1", "2"])
  })

  it("agenda ERP : la version Google plus récente l'emporte, l'ancienne est ignorée, jamais de doublon", async () => {
    const user = await signIn()
    await connectGoogle(user.id)
    await prisma.user.update({ where: { id: user.id }, data: { googleErpCalendarId: "erp-cal@group" } })
    const syncedAt = new Date("2026-09-01T10:00:00Z")
    const newer = await makeEvent(user.id, { title: "ERP", googleEventId: "g-newer", googleSyncedAt: syncedAt })
    const older = await makeEvent(user.id, { title: "ERP intact", googleEventId: "g-older", googleSyncedAt: syncedAt })
    google.events["erp-cal@group"] = [[
      gTimed("g-newer", "Modifié dans Google", new Date("2026-10-03T08:00:00Z"), { updated: "2026-09-02T10:00:00.000Z" }),
      gTimed("g-older", "Vieille version", new Date("2026-10-03T08:00:00Z"), { updated: "2026-08-01T10:00:00.000Z" }),
    ]]

    expect(await syncGooglePull()).toEqual({ synced: 1 })

    expect(eventCalls("GET").map((c) => c.url.pathname)).toEqual([
      "/calendar/v3/calendars/primary/events",
      "/calendar/v3/calendars/erp-cal%40group/events",
    ])
    expect(await prisma.calendarEvent.findUniqueOrThrow({ where: { id: newer.id } })).toMatchObject({
      title: "Modifié dans Google", sourceType: "MANUAL", startDate: new Date("2026-10-03T08:00:00Z"),
      googleSyncedAt: new Date("2026-09-02T10:00:00.000Z"),
    })
    expect((await prisma.calendarEvent.findUniqueOrThrow({ where: { id: older.id } })).title).toBe("ERP intact")
    expect(await prisma.calendarEvent.count({ where: { sourceType: "GOOGLE" } })).toBe(0)
  })

  it("401 pendant la récupération → erreur remontée, rien d'importé", async () => {
    const user = await signIn()
    await connectGoogle(user.id)
    google.override = (c) => (c.url.pathname.endsWith("/events") ? json({ error: { message: "Invalid Credentials" } }, 401) : undefined)

    expect(await syncGooglePull()).toEqual({ synced: 0, error: "Google Calendar API 401 — Invalid Credentials" })
    expect(await prisma.calendarEvent.count()).toBe(0)
  })

  it("borne la fenêtre passée entre 1 et 24 mois", async () => {
    const user = await signIn()
    await connectGoogle(user.id)
    const monthsAgo = (c: Call) => (Date.now() - new Date(c.url.searchParams.get("timeMin")!).getTime()) / (30.44 * DAY)

    await syncGooglePull(100)
    await syncGooglePull(0)

    const [clampedHigh, clampedLow] = eventCalls("GET").map(monthsAgo)
    expect(clampedHigh).toBeGreaterThan(23.5)
    expect(clampedHigh).toBeLessThan(24.5)
    expect(clampedLow).toBeGreaterThan(0.9)
    expect(clampedLow).toBeLessThan(1.1)
  })

  // Régression corrigée le 29/09/2026 — src/actions/calendar.ts:954-1016 (syncGooglePull) : un événement supprimé
  // côté Google n'est JAMAIS supprimé dans l'ERP. La boucle ne fait que des
  // INSERT/UPDATE ; un statut "cancelled" est simplement sauté (l.956) et un
  // événement absent de la réponse n'est pas détecté. Or le commentaire l.348
  // annonce « suppression des deux côtés ». Scénario : RDV importé puis supprimé
  // dans Google Agenda → il reste affiché dans /calendrier indéfiniment.
  it("un événement supprimé dans Google disparaît de l'ERP à la synchro suivante", async () => {
    const user = await signIn()
    await connectGoogle(user.id)
    const start = inDays(5)
    google.events.primary = [[gTimed("g-1", "RDV", start), gTimed("g-2", "Autre RDV", start)]]
    await syncGooglePull()

    google.events.primary = [[gTimed("g-2", "Autre RDV", start, { status: "cancelled" })]] // g-1 absent, g-2 annulé
    await syncGooglePull()

    expect(await prisma.calendarEvent.count({ where: { userId: user.id } })).toBe(0)
  })

  // Régression corrigée le 29/09/2026 — src/actions/calendar.ts:928-931 + 945-952 : le pull relit l'agenda dédié
  // « ERP Freelance », où google-task-sync pousse AUSSI les tâches (✅), jalons (🚩)
  // et entretiens (💼). Le dédoublonnage ne regarde que les CalendarEvent MANUAL
  // (`pushedByGoogleId`) — pas Task/Milestone/JobApplication.googleEventId — donc
  // chaque miroir est ré-importé comme CalendarEvent GOOGLE : la tâche apparaît
  // deux fois dans /calendrier (projection Task + copie « Google Calendar »).
  it("les miroirs de tâches / jalons poussés dans l'agenda ERP ne sont pas ré-importés", async () => {
    const user = await signIn()
    await connectGoogle(user.id)
    await prisma.user.update({ where: { id: user.id }, data: { googleErpCalendarId: "erp-cal@group" } })
    await prisma.task.create({ data: { userId: user.id, title: "Relancer", dueDate: inDays(3), googleEventId: "g-task" } })
    google.events["erp-cal@group"] = [[
      { id: "g-task", summary: "✅ Relancer", status: "confirmed", start: { date: zonedDateKey(inDays(3)) }, end: { date: zonedDateKey(inDays(4)) } },
    ]]

    await syncGooglePull()

    expect(await prisma.calendarEvent.count({ where: { userId: user.id } })).toBe(0)
  })

  // Régression corrigée le 29/09/2026 — src/actions/calendar.ts:925-931 : l'id de l'agenda ERP mémorisé
  // (User.googleErpCalendarId) n'est jamais invalidé. Si Pierre supprime l'agenda
  // « ERP Freelance » dans Google, fetchGoogleEvents(erpCalendarId) répond 404 et
  // TOUT le pull échoue (primaire compris), à chaque synchro, pour toujours ;
  // en parallèle chaque push (POST sur l'agenda disparu → 404) échoue en silence.
  it("un agenda ERP supprimé côté Google ne bloque pas l'import de l'agenda principal", async () => {
    const user = await signIn()
    await connectGoogle(user.id)
    await prisma.user.update({ where: { id: user.id }, data: { googleErpCalendarId: "deleted@group" } })
    google.events.primary = [[gTimed("g-1", "RDV", inDays(2))]]
    google.override = (c) => (c.url.pathname.includes("deleted%40group") ? json({ error: { message: "Not Found" } }, 404) : undefined)

    const out = await syncGooglePull()

    expect(out.error).toBeUndefined()
    expect(await prisma.calendarEvent.count({ where: { userId: user.id } })).toBe(1)
  })
})

describe("syncGooglePush / cycle complet / réglages", () => {
  it("sans droit agenda ou sans jeton → needsPermission", async () => {
    const user = await signIn()
    expect(await syncGooglePush()).toEqual({ synced: 0, needsPermission: true })
    await connectGoogle(user.id, { access_token: null })
    expect(await syncGooglePush()).toEqual({ synced: 0, needsPermission: true })
  })

  it("rattrape le backlog de la fenêtre récente et horodate la synchro", async () => {
    const user = await signIn()
    await connectGoogle(user.id)
    await prisma.user.update({ where: { id: user.id }, data: { googleErpCalendarId: "erp-cal@group" } })
    const a = await makeEvent(user.id, { title: "A", startDate: inDays(2) })
    const b = await makeEvent(user.id, { title: "B", startDate: inDays(-10) })
    await makeEvent(user.id, { title: "Trop vieux", startDate: inDays(-60) })
    await makeEvent(user.id, { title: "Déjà poussé", startDate: inDays(3), googleEventId: "g-old" })
    await makeEvent(user.id, { title: "Importé", startDate: inDays(3), sourceType: "GOOGLE", sourceId: "g-imp" })
    const victim = await makeUser()
    await makeEvent(victim.id, { title: "Autre compte", startDate: inDays(1) })

    expect(await getLastGoogleSyncAt()).toBeNull()
    expect(await syncGooglePush()).toEqual({ synced: 2 })

    expect(eventCalls("POST").map((c) => c.body?.summary).sort()).toEqual(["A", "B"])
    const pushed = await prisma.calendarEvent.findMany({ where: { id: { in: [a.id, b.id] } } })
    expect(pushed.every((e) => e.googleEventId?.startsWith("g-"))).toBe(true)
    const last = await getLastGoogleSyncAt()
    expect(Math.abs(last!.getTime() - Date.now())).toBeLessThan(60_000)
  })

  it("getLastGoogleSyncAt sans session → null", async () => {
    vi.mocked(auth).mockResolvedValueOnce(null as never)
    expect(await getLastGoogleSyncAt()).toBeNull()
  })

  // Régression corrigée le 29/09/2026 — src/actions/calendar.ts:1053-1060 : pushEventToGoogle avale toute erreur
  // (best-effort) mais syncGooglePush incrémente `synced` quoi qu'il arrive, puis
  // horodate lastGoogleSyncAt (« dernière synchro RÉUSSIE », l.1058). Google en
  // panne → « 2 synchronisés » et un horodatage frais, alors que rien n'est parti :
  // le seuil de fraîcheur empêche ensuite la nouvelle tentative automatique.
  it("une panne Google n'est ni comptée comme synchro, ni horodatée", async () => {
    const user = await signIn()
    await connectGoogle(user.id)
    await prisma.user.update({ where: { id: user.id }, data: { googleErpCalendarId: "erp-cal@group" } })
    await makeEvent(user.id, { startDate: inDays(1) })
    await makeEvent(user.id, { startDate: inDays(2) })
    google.override = () => json({ error: { message: "Backend Error" } }, 500)

    const out = await syncGooglePush()

    expect(out.synced).toBe(0)
    expect(await getLastGoogleSyncAt()).toBeNull()
  })

  it("syncGoogleEvents : pull puis push, résultats cumulés", async () => {
    const user = await signIn()
    await connectGoogle(user.id)
    await prisma.user.update({ where: { id: user.id }, data: { googleErpCalendarId: "erp-cal@group" } })
    await makeEvent(user.id, { title: "À pousser", startDate: inDays(1) })
    google.events.primary = [[gTimed("g-in", "Importé", inDays(2))]]

    expect(await syncGoogleEvents()).toEqual({ synced: 2, error: undefined, needsPermission: undefined })
  })

  it("syncGoogleEvents s'arrête au pull si la permission manque", async () => {
    await signIn()
    expect(await syncGoogleEvents()).toEqual({ synced: 0, needsPermission: true })
    expect(await getLastGoogleSyncAt()).toBeNull()
  })

  it("seuil de synchro auto : arrondi et borné entre 0 et 1440 minutes", async () => {
    const user = await signIn()
    const read = async () => (await prisma.userProfile.findUniqueOrThrow({ where: { userId: user.id } })).calendarSyncThresholdMin
    await setCalendarSyncThreshold(12.6)
    expect(await read()).toBe(13)
    await setCalendarSyncThreshold(-5)
    expect(await read()).toBe(0)
    await setCalendarSyncThreshold(99_999)
    expect(await read()).toBe(1440)
  })
})

describe("synchro Google — doublons et suppressions (#42, #11)", () => {
  it("un événement à cheval sur le début de la fenêtre n'est pas ré-importé à chaque synchro", async () => {
    const user = await signIn()
    await connectGoogle(user.id)
    // Commence 40 jours avant (hors fenêtre d'un mois), finit dans 2 jours : Google le renvoie
    const long = gTimed("g-long", "Mission longue", inDays(-40), { end: { dateTime: inDays(2).toISOString() } })
    google.events.primary = [[long]]
    await syncGooglePull()
    await syncGooglePull()
    await syncGooglePull()
    expect(await prisma.calendarEvent.count({ where: { userId: user.id, sourceId: "g-long" } })).toBe(1)
  })

  it("un événement créé dans l'agenda « ERP Freelance » côté Google est adopté comme événement ERP", async () => {
    const user = await signIn()
    await connectGoogle(user.id)
    await prisma.user.update({ where: { id: user.id }, data: { googleErpCalendarId: "erp-cal@group" } })
    google.events["erp-cal@group"] = [[gTimed("g-erp", "Créé dans Google", inDays(3), { updated: "2026-09-01T10:00:00.000Z" })]]

    await syncGooglePull()

    const ev = await prisma.calendarEvent.findFirstOrThrow({ where: { userId: user.id } })
    // MANUAL + googleEventId : ses modifications repartiront sur l'agenda ERP, pas sur primary
    expect(ev).toMatchObject({ sourceType: "MANUAL", googleEventId: "g-erp", title: "Créé dans Google" })
  })

  it("supprimer dans l'ERP un événement importé le supprime aussi dans l'agenda principal", async () => {
    const user = await signIn()
    await connectGoogle(user.id)
    const ev = await makeEvent(user.id, { sourceType: "GOOGLE", sourceId: "g-imp", startDate: inDays(4) })

    expect(await deleteCalendarItem("manual", ev.id)).toEqual({})

    const del = eventCalls("DELETE")
    expect(del).toHaveLength(1)
    expect(del[0].url.pathname).toBe("/calendar/v3/calendars/primary/events/g-imp")
    expect(await prisma.calendarEvent.count({ where: { id: ev.id } })).toBe(0)
  })

  it("la lecture demande les suppressions récentes (showDeleted)", async () => {
    const user = await signIn()
    await connectGoogle(user.id)
    await syncGooglePull()
    expect(eventCalls("GET")[0].url.searchParams.get("showDeleted")).toBe("true")
  })
})
