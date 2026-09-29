import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import {
  syncTaskGoogleState, removeTaskFromGoogle,
  syncMilestoneGoogleState, removeMilestoneFromGoogle,
  syncJobApplicationGoogleState, removeJobApplicationFromGoogle,
} from "@/lib/google-task-sync"
import { prisma } from "@/lib/prisma"
import { zonedMidnight, zonedInstant } from "@/lib/dates"
import { makeUser, makeClient, makeProject, makeJobApplication, uniq } from "./helpers/factories"

// Miroir unidirectionnel Task / Milestone / JobApplication → agenda Google « ERP
// Freelance ». Projet `integration` = TZ=UTC, comme la production Vercel.
// Faux Google branché sur `fetch` : aucun appel réseau, aucun vrai jeton.

type Call = { method: string; path: string; body: Record<string, unknown> | undefined }
let calls: Call[]
let seq: number
let fail: number | null

beforeEach(() => {
  calls = []
  seq = 0
  fail = null
  vi.stubGlobal("fetch", vi.fn(async (input: string, init: RequestInit = {}) => {
    const url = new URL(input)
    const call: Call = { method: init.method ?? "GET", path: url.pathname, body: typeof init.body === "string" ? JSON.parse(init.body) : undefined }
    calls.push(call)
    if (fail) return new Response(JSON.stringify({ error: { message: "Backend Error" } }), { status: fail })
    if (call.method === "DELETE") return new Response(null, { status: 204 })
    const id = /\/events\/([^/]+)$/.exec(url.pathname)?.[1] ?? `g-${++seq}`
    return new Response(JSON.stringify({ id, updated: "2026-09-01T10:00:00.000Z" }), { status: 200 })
  }))
})
afterEach(() => vi.unstubAllGlobals())

const EVENTS = "/calendar/v3/calendars/erp-cal%40group/events"

/** Compte Google valide + agenda ERP déjà mémorisé (pas de calendarList). */
async function connectedUser() {
  const user = await makeUser()
  await prisma.user.update({ where: { id: user.id }, data: { googleErpCalendarId: "erp-cal@group" } })
  await prisma.account.create({
    data: {
      userId: user.id, type: "oauth", provider: "google", providerAccountId: uniq("gacc"),
      access_token: "at-test", refresh_token: "rt-test", expires_at: Math.floor(Date.now() / 1000) + 3600,
      scope: "https://www.googleapis.com/auth/calendar",
    },
  })
  return user
}

async function projectOf(userId: string) {
  return makeProject(userId, (await makeClient(userId)).id)
}

describe("tâches", () => {
  it("pousse une tâche datée en journée entière (le 03/09 reste le 03/09 en UTC)", async () => {
    const user = await connectedUser()
    const task = await prisma.task.create({ data: { userId: user.id, title: "Relancer", description: "Devis", dueDate: zonedMidnight("2026-09-03") } })

    await syncTaskGoogleState(user.id, task.id)

    expect(calls).toEqual([{
      method: "POST", path: EVENTS,
      body: { summary: "✅ Relancer", description: "Devis", start: { date: "2026-09-03" }, end: { date: "2026-09-04" } },
    }])
    const after = await prisma.task.findUniqueOrThrow({ where: { id: task.id } })
    expect([after.googleEventId, after.googleSyncedAt?.toISOString()]).toEqual(["g-1", "2026-09-01T10:00:00.000Z"])
  })

  it("met à jour (PATCH) une tâche déjà poussée, y compris une tâche de projet sans userId", async () => {
    const user = await connectedUser()
    const project = await projectOf(user.id)
    const task = await prisma.task.create({ data: { projectId: project.id, title: "T", dueDate: zonedMidnight("2026-09-10"), googleEventId: "g-77" } })

    await syncTaskGoogleState(user.id, task.id)

    expect(calls.map((c) => `${c.method} ${c.path}`)).toEqual([`PATCH ${EVENTS}/g-77`])
  })

  it("échéance retirée : supprime l'événement Google et oublie son id", async () => {
    const user = await connectedUser()
    const task = await prisma.task.create({ data: { userId: user.id, title: "T", googleEventId: "g-5", googleSyncedAt: new Date() } })

    await syncTaskGoogleState(user.id, task.id)

    expect(calls.map((c) => `${c.method} ${c.path}`)).toEqual([`DELETE ${EVENTS}/g-5`])
    expect(await prisma.task.findUniqueOrThrow({ where: { id: task.id } })).toMatchObject({ googleEventId: null, googleSyncedAt: null })
  })

  it("sans échéance ni id Google, sans compte Google, ou tâche d'un autre compte : aucun appel", async () => {
    const user = await connectedUser()
    const undated = await prisma.task.create({ data: { userId: user.id, title: "T" } })
    const offline = await makeUser()
    const offlineTask = await prisma.task.create({ data: { userId: offline.id, title: "T", dueDate: new Date() } })
    const victim = await makeUser()
    const victimTask = await prisma.task.create({ data: { userId: victim.id, title: "Privée", dueDate: new Date(), googleEventId: "g-v" } })

    await syncTaskGoogleState(user.id, undated.id)
    await syncTaskGoogleState(offline.id, offlineTask.id)
    await syncTaskGoogleState(user.id, victimTask.id)
    await removeTaskFromGoogle(user.id, victimTask.id)
    await syncTaskGoogleState(user.id, "inexistante")

    expect(calls).toHaveLength(0)
  })

  it("panne Google avalée (best-effort) : la tâche reste sans id Google", async () => {
    const user = await connectedUser()
    const task = await prisma.task.create({ data: { userId: user.id, title: "T", dueDate: new Date() } })
    fail = 500

    await expect(syncTaskGoogleState(user.id, task.id)).resolves.toBeUndefined()
    await expect(removeTaskFromGoogle(user.id, task.id)).resolves.toBeUndefined()
    expect((await prisma.task.findUniqueOrThrow({ where: { id: task.id } })).googleEventId).toBeNull()
  })

  it("removeTaskFromGoogle : supprime l'événement lié, rien si la tâche n'a jamais été poussée", async () => {
    const user = await connectedUser()
    const pushed = await prisma.task.create({ data: { userId: user.id, title: "T", googleEventId: "g-3" } })
    const never = await prisma.task.create({ data: { userId: user.id, title: "T" } })

    await removeTaskFromGoogle(user.id, pushed.id)
    await removeTaskFromGoogle(user.id, never.id)

    expect(calls.map((c) => `${c.method} ${c.path}`)).toEqual([`DELETE ${EVENTS}/g-3`])
  })

  it("removeTaskFromGoogle sans compte Google : aucun appel", async () => {
    const user = await makeUser()
    const task = await prisma.task.create({ data: { userId: user.id, title: "T", googleEventId: "g-3" } })
    await removeTaskFromGoogle(user.id, task.id)
    expect(calls).toHaveLength(0)
  })

  it("remove / delete Google : une erreur 500 est avalée", async () => {
    const user = await connectedUser()
    const task = await prisma.task.create({ data: { userId: user.id, title: "T", googleEventId: "g-3" } })
    fail = 500
    await expect(syncTaskGoogleState(user.id, task.id)).resolves.toBeUndefined() // branche DELETE en échec
    expect((await prisma.task.findUniqueOrThrow({ where: { id: task.id } })).googleEventId).toBe("g-3")
  })
})

describe("jalons", () => {
  it("jalon horaire : événement daté, fin = endDate", async () => {
    const user = await connectedUser()
    const project = await projectOf(user.id)
    const start = zonedInstant(2026, 9, 3, 14, 0)
    const end = zonedInstant(2026, 9, 3, 16, 0)
    const milestone = await prisma.milestone.create({ data: { projectId: project.id, name: "Démo", date: start, endDate: end } })

    await syncMilestoneGoogleState(user.id, milestone.id)

    expect(calls[0]).toMatchObject({
      method: "POST", path: EVENTS,
      body: { summary: "🚩 Démo", start: { dateTime: "2026-09-03T12:00:00.000Z" }, end: { dateTime: "2026-09-03T14:00:00.000Z" } },
    })
    expect((await prisma.milestone.findUniqueOrThrow({ where: { id: milestone.id } })).googleEventId).toBe("g-1")
  })

  it("met à jour un jalon déjà poussé ; ignore le jalon d'un autre compte et un compte hors ligne", async () => {
    const user = await connectedUser()
    const mine = await prisma.milestone.create({ data: { projectId: (await projectOf(user.id)).id, name: "J", date: zonedInstant(2026, 9, 3, 9, 0), googleEventId: "g-m" } })
    const victim = await makeUser()
    const theirs = await prisma.milestone.create({ data: { projectId: (await projectOf(victim.id)).id, name: "Privé", date: new Date(), googleEventId: "g-v" } })

    await syncMilestoneGoogleState(user.id, mine.id)
    await syncMilestoneGoogleState(user.id, theirs.id)
    await removeMilestoneFromGoogle(user.id, theirs.id)
    await syncMilestoneGoogleState(victim.id, theirs.id) // victime sans compte Google

    expect(calls.map((c) => `${c.method} ${c.path}`)).toEqual([`PATCH ${EVENTS}/g-m`])
  })

  it("removeMilestoneFromGoogle : supprime l'événement lié ; panne avalée", async () => {
    const user = await connectedUser()
    const project = await projectOf(user.id)
    const pushed = await prisma.milestone.create({ data: { projectId: project.id, name: "J", date: new Date(), googleEventId: "g-9" } })
    const never = await prisma.milestone.create({ data: { projectId: project.id, name: "J2", date: new Date() } })

    await removeMilestoneFromGoogle(user.id, pushed.id)
    await removeMilestoneFromGoogle(user.id, never.id)
    expect(calls.map((c) => `${c.method} ${c.path}`)).toEqual([`DELETE ${EVENTS}/g-9`])

    fail = 500
    await expect(removeMilestoneFromGoogle(user.id, pushed.id)).resolves.toBeUndefined()
    await expect(syncMilestoneGoogleState(user.id, never.id)).resolves.toBeUndefined()
  })

  // BUG — src/lib/google-task-sync.ts:13-15 (`hasTime`) : `getHours()/getMinutes()`
  // lisent le fuseau du PROCESS, soit UTC en production. Un jalon « journée
  // entière » est stocké à minuit Paris (22:00Z / 23:00Z) → getHours() = 22 →
  // poussé comme créneau HORAIRE de durée nulle à minuit (l.116), au lieu d'une
  // journée entière. Inversement, un jalon à 02:00 Paris (00:00Z) est poussé en
  // journée entière. Correctif attendu : `isZonedAllDay` de lib/dates.ts.
  it("un jalon à minuit Paris part en journée entière (serveur UTC)", async () => {
    const user = await connectedUser()
    const project = await projectOf(user.id)
    const milestone = await prisma.milestone.create({ data: { projectId: project.id, name: "Livraison", date: zonedMidnight("2026-09-03") } })

    await syncMilestoneGoogleState(user.id, milestone.id)

    expect(calls[0].body).toMatchObject({ start: { date: "2026-09-03" }, end: { date: "2026-09-04" } })
  })
})

describe("candidatures / entretiens", () => {
  it("prochain point horaire : créneau d'1 h, libellé, format et lieu", async () => {
    const user = await connectedUser()
    const app = await makeJobApplication(user.id, { companyName: "ACME" })
    await prisma.jobApplication.update({
      where: { id: app.id },
      data: { nextActionAt: zonedInstant(2026, 9, 3, 10, 30), nextActionLabel: "Entretien technique", nextActionFormat: "TEAMS", location: "Lyon" },
    })

    await syncJobApplicationGoogleState(user.id, app.id)

    expect(calls[0]).toMatchObject({
      method: "POST", path: EVENTS,
      body: {
        summary: "💼 ACME — Entretien technique", description: "🎥 Visio — Teams · Lyon",
        start: { dateTime: "2026-09-03T08:30:00.000Z" }, end: { dateTime: "2026-09-03T09:30:00.000Z" },
      },
    })
    expect((await prisma.jobApplication.findUniqueOrThrow({ where: { id: app.id } })).googleEventId).toBe("g-1")
  })

  it("sans libellé ni format : le poste sert de titre, pas de description", async () => {
    const user = await connectedUser()
    const app = await makeJobApplication(user.id, { companyName: "ACME", position: "Dev Java" })
    await prisma.jobApplication.update({ where: { id: app.id }, data: { nextActionAt: zonedInstant(2026, 9, 3, 10, 30), googleEventId: "g-app" } })

    await syncJobApplicationGoogleState(user.id, app.id)

    expect(calls[0].method).toBe("PATCH")
    expect(calls[0].body).toMatchObject({ summary: "💼 ACME — Dev Java" })
    expect(calls[0].body).not.toHaveProperty("description")
  })

  it("point vidé : supprime l'événement et oublie son id ; rien si jamais poussé", async () => {
    const user = await connectedUser()
    const pushed = await makeJobApplication(user.id)
    await prisma.jobApplication.update({ where: { id: pushed.id }, data: { googleEventId: "g-a", googleSyncedAt: new Date() } })
    const never = await makeJobApplication(user.id)

    await syncJobApplicationGoogleState(user.id, pushed.id)
    await syncJobApplicationGoogleState(user.id, never.id)

    expect(calls.map((c) => `${c.method} ${c.path}`)).toEqual([`DELETE ${EVENTS}/g-a`])
    expect(await prisma.jobApplication.findUniqueOrThrow({ where: { id: pushed.id } })).toMatchObject({ googleEventId: null, googleSyncedAt: null })
  })

  it("candidature d'un autre compte, compte hors ligne, panne Google : aucun effet", async () => {
    const user = await connectedUser()
    const victim = await makeUser()
    const theirs = await makeJobApplication(victim.id)
    await prisma.jobApplication.update({ where: { id: theirs.id }, data: { nextActionAt: new Date(), googleEventId: "g-v" } })

    await syncJobApplicationGoogleState(user.id, theirs.id)
    await removeJobApplicationFromGoogle(user.id, theirs.id)
    await syncJobApplicationGoogleState(victim.id, theirs.id)
    expect(calls).toHaveLength(0)

    const mine = await makeJobApplication(user.id)
    await prisma.jobApplication.update({ where: { id: mine.id }, data: { nextActionAt: new Date() } })
    fail = 500
    await expect(syncJobApplicationGoogleState(user.id, mine.id)).resolves.toBeUndefined()
    expect((await prisma.jobApplication.findUniqueOrThrow({ where: { id: mine.id } })).googleEventId).toBeNull()
  })

  it("removeJobApplicationFromGoogle : supprime l'événement lié ; panne avalée", async () => {
    const user = await connectedUser()
    const app = await makeJobApplication(user.id)
    await prisma.jobApplication.update({ where: { id: app.id }, data: { googleEventId: "g-r" } })
    const never = await makeJobApplication(user.id)

    await removeJobApplicationFromGoogle(user.id, app.id)
    await removeJobApplicationFromGoogle(user.id, never.id)
    expect(calls.map((c) => `${c.method} ${c.path}`)).toEqual([`DELETE ${EVENTS}/g-r`])

    fail = 500
    await expect(removeJobApplicationFromGoogle(user.id, app.id)).resolves.toBeUndefined()
  })

  // BUG — même cause que les jalons (google-task-sync.ts:172, `hasTime`) : un
  // entretien sans heure (minuit Paris) est poussé en créneau 00:00–01:00 au lieu
  // d'une journée entière quand le serveur tourne en UTC.
  it("un prochain point sans heure part en journée entière (serveur UTC)", async () => {
    const user = await connectedUser()
    const app = await makeJobApplication(user.id)
    await prisma.jobApplication.update({ where: { id: app.id }, data: { nextActionAt: zonedMidnight("2026-09-03") } })

    await syncJobApplicationGoogleState(user.id, app.id)

    expect(calls[0].body).toMatchObject({ start: { date: "2026-09-03" }, end: { date: "2026-09-04" } })
  })
})
