import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { zonedMidnight, zonedInstant, parseGoogleDate } from "@/lib/dates"

// Fonctions HTTP pures de `lib/google-calendar.ts` (aucune ne lit la base : le
// client Prisma est neutralisé). Projet `unit-utc` : TZ=UTC comme la production
// Vercel — c'est ici qu'on prouve qu'une journée entière du 03/09 part bien le
// 03/09 chez Google, et pas la veille.
vi.mock("@/lib/prisma", () => ({ prisma: {} }))

import {
  fetchGoogleEvents, pushGoogleEvent, deleteGoogleEvent, getOrCreateErpCalendar, ERP_CALENDAR_NAME,
} from "@/lib/google-calendar"

type Call = { method: string; url: URL; body: Record<string, unknown> | undefined; auth: string | undefined }
let calls: Call[]
let respond: (c: Call) => Response

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })

beforeEach(() => {
  calls = []
  vi.stubGlobal("fetch", vi.fn(async (input: string, init: RequestInit = {}) => {
    const headers = (init.headers ?? {}) as Record<string, string>
    const call: Call = {
      method: init.method ?? "GET",
      url: new URL(input),
      body: typeof init.body === "string" ? JSON.parse(init.body) : undefined,
      auth: headers.Authorization,
    }
    calls.push(call)
    return respond(call)
  }))
})
afterEach(() => vi.unstubAllGlobals())

const TOKEN = "at-test"

describe("pushGoogleEvent — journées entières en UTC", () => {
  beforeEach(() => { respond = () => json({ id: "g-1", updated: "2026-09-01T10:00:00.000Z" }) })

  it("une journée entière du 03/09 (minuit Paris) part le 03/09, fin exclusive le 04/09", async () => {
    const day = zonedMidnight("2026-09-03") // 2026-09-02T22:00Z : la veille en UTC
    await pushGoogleEvent(TOKEN, "cal", { summary: "Anniv", start: day, end: day, allDay: true })
    expect(calls[0].body).toMatchObject({ start: { date: "2026-09-03" }, end: { date: "2026-09-04" } })
  })

  it("aller-retour : une date Google importée repart sur le même jour (été comme hiver)", async () => {
    for (const d of ["2026-09-03", "2026-01-15", "2026-03-29", "2026-10-25"]) {
      calls = []
      const start = parseGoogleDate(d)
      await pushGoogleEvent(TOKEN, "cal", { summary: "x", start, end: start, allDay: true })
      expect(calls[0].body?.start).toEqual({ date: d })
    }
  })

  it("garde la fin d'un événement de plusieurs jours (fin exclusive déjà après le début)", async () => {
    await pushGoogleEvent(TOKEN, "cal", {
      summary: "Salon", start: zonedMidnight("2026-09-03"), end: zonedMidnight("2026-09-06"), allDay: true,
    })
    expect(calls[0].body).toMatchObject({ start: { date: "2026-09-03" }, end: { date: "2026-09-06" } })
  })

  it("événement horaire : envoie des dateTime ISO (instant exact)", async () => {
    const start = zonedInstant(2026, 9, 3, 14, 0)
    const end = zonedInstant(2026, 9, 3, 15, 30)
    await pushGoogleEvent(TOKEN, "cal", { summary: "RDV", description: "Notes", start, end, allDay: false })
    expect(calls[0].body).toEqual({
      summary: "RDV", description: "Notes",
      start: { dateTime: "2026-09-03T12:00:00.000Z" },
      end: { dateTime: "2026-09-03T13:30:00.000Z" },
    })
  })
})

describe("pushGoogleEvent — création, mise à jour, erreurs", () => {
  const payload = { summary: "RDV", start: new Date("2026-09-03T12:00:00Z"), end: new Date("2026-09-03T13:00:00Z"), allDay: false }

  it("crée (POST) sans id, sur l'agenda encodé, avec le jeton", async () => {
    respond = () => json({ id: "g-new", updated: "2026-09-01T10:00:00.000Z" })
    const out = await pushGoogleEvent(TOKEN, "abc@group.calendar.google.com", payload)
    expect(out).toEqual({ id: "g-new", updated: "2026-09-01T10:00:00.000Z" })
    expect(calls[0].method).toBe("POST")
    expect(calls[0].url.pathname).toBe("/calendar/v3/calendars/abc%40group.calendar.google.com/events")
    expect(calls[0].auth).toBe(`Bearer ${TOKEN}`)
  })

  it("met à jour (PATCH) quand l'id Google est connu", async () => {
    respond = () => json({ id: "g-7", updated: "2026-09-01T10:00:00.000Z" })
    await pushGoogleEvent(TOKEN, "cal", payload, "g-7")
    expect([calls[0].method, calls[0].url.pathname]).toEqual(["PATCH", "/calendar/v3/calendars/cal/events/g-7"])
  })

  it.each([404, 410])("recrée l'événement supprimé côté Google (PATCH → %i → POST)", async (status) => {
    respond = (c) => (c.method === "PATCH" ? json({}, status) : json({ id: "g-recreated", updated: "u" }))
    const out = await pushGoogleEvent(TOKEN, "cal", payload, "g-gone")
    expect(out.id).toBe("g-recreated")
    expect(calls.map((c) => c.method)).toEqual(["PATCH", "POST"])
  })

  it("lève une erreur explicite avec le message Google", async () => {
    respond = () => json({ error: { message: "Rate Limit Exceeded" } }, 429)
    await expect(pushGoogleEvent(TOKEN, "cal", payload)).rejects.toThrow("Google Calendar push 429 — Rate Limit Exceeded")
  })

  it("tolère un corps d'erreur non JSON", async () => {
    respond = () => new Response("<html>oops</html>", { status: 500 })
    await expect(pushGoogleEvent(TOKEN, "cal", payload)).rejects.toThrow(/^Google Calendar push 500$/)
  })
})

describe("fetchGoogleEvents", () => {
  const from = new Date("2026-08-01T00:00:00Z")
  const to = new Date("2026-12-01T00:00:00Z")
  const ev = (id: string) => ({ id, summary: id, start: { date: "2026-09-03" }, end: { date: "2026-09-04" }, status: "confirmed", htmlLink: "" })

  it("suit nextPageToken jusqu'à la dernière page", async () => {
    respond = (c) => c.url.searchParams.get("pageToken") === "p2"
      ? json({ items: [ev("b")] })
      : json({ items: [ev("a")], nextPageToken: "p2" })

    const out = await fetchGoogleEvents(TOKEN, from, to)

    expect(out.map((e) => e.id)).toEqual(["a", "b"])
    expect(calls).toHaveLength(2)
    const q = calls[0].url.searchParams
    expect([q.get("timeMin"), q.get("timeMax"), q.get("singleEvents"), q.get("maxResults")])
      .toEqual([from.toISOString(), to.toISOString(), "true", "250"])
    expect(calls[0].url.pathname).toBe("/calendar/v3/calendars/primary/events")
  })

  it("s'arrête au garde-fou de 5000 événements même si Google pagine encore", async () => {
    let page = 0
    respond = () => json({ items: Array.from({ length: 250 }, (_, i) => ev(`e${page}-${i}`)), nextPageToken: `p${++page}` })
    const out = await fetchGoogleEvents(TOKEN, from, to)
    expect(out).toHaveLength(5000)
    expect(calls).toHaveLength(20)
  })

  it("renvoie [] quand Google omet items", async () => {
    respond = () => json({})
    expect(await fetchGoogleEvents(TOKEN, from, to, "erp@group")).toEqual([])
    expect(calls[0].url.pathname).toBe("/calendar/v3/calendars/erp%40group/events")
  })

  it("401 → erreur avec le détail Google (jeton révoqué)", async () => {
    respond = () => json({ error: { message: "Invalid Credentials" } }, 401)
    await expect(fetchGoogleEvents(TOKEN, from, to)).rejects.toThrow("Google Calendar API 401 — Invalid Credentials")
  })

  it("erreur au corps non JSON → statut seul", async () => {
    respond = () => new Response("Bad Gateway", { status: 502 })
    await expect(fetchGoogleEvents(TOKEN, from, to)).rejects.toThrow(/^Google Calendar API 502$/)
  })
})

describe("deleteGoogleEvent", () => {
  it("supprime (DELETE) l'événement ciblé", async () => {
    respond = () => new Response(null, { status: 204 })
    await deleteGoogleEvent(TOKEN, "a@b", "g-1")
    expect([calls[0].method, calls[0].url.pathname]).toEqual(["DELETE", "/calendar/v3/calendars/a%40b/events/g-1"])
  })

  it.each([404, 410])("considère %i (déjà supprimé) comme un succès", async (status) => {
    respond = () => json({}, status)
    await expect(deleteGoogleEvent(TOKEN, "cal", "g-1")).resolves.toBeUndefined()
  })

  it("lève sur une autre erreur, avec ou sans détail", async () => {
    respond = () => json({ error: { message: "Forbidden" } }, 403)
    await expect(deleteGoogleEvent(TOKEN, "cal", "g-1")).rejects.toThrow("Google Calendar delete 403 — Forbidden")
    respond = () => new Response("nope", { status: 500 })
    await expect(deleteGoogleEvent(TOKEN, "cal", "g-1")).rejects.toThrow(/^Google Calendar delete 500$/)
  })
})

describe("getOrCreateErpCalendar", () => {
  it("réutilise l'agenda « ERP Freelance » existant sans en créer", async () => {
    respond = () => json({ items: [{ id: "perso", summary: "Perso" }, { id: "erp-cal", summary: ERP_CALENDAR_NAME }] })
    expect(await getOrCreateErpCalendar(TOKEN)).toBe("erp-cal")
    expect(calls).toHaveLength(1)
  })

  it("crée l'agenda puis applique sa couleur", async () => {
    respond = (c) => {
      if (c.method === "GET") return json({ items: [{ id: "perso", summary: "Perso" }] })
      if (c.method === "POST") return json({ id: "new@group" })
      return json({})
    }
    expect(await getOrCreateErpCalendar(TOKEN)).toBe("new@group")
    expect(calls.map((c) => c.method)).toEqual(["GET", "POST", "PATCH"])
    expect(calls[1].body).toEqual({ summary: ERP_CALENDAR_NAME })
    expect(calls[2].url.pathname).toBe("/calendar/v3/users/me/calendarList/new%40group")
    expect(calls[2].body).toEqual({ backgroundColor: "#4f46e5", foregroundColor: "#ffffff" })
  })

  it("crée l'agenda même si la liste échoue, et ignore l'échec de la couleur", async () => {
    respond = (c) => {
      if (c.method === "GET") return json({}, 500)
      if (c.method === "POST") return json({ id: "new" })
      throw new Error("réseau coupé")
    }
    expect(await getOrCreateErpCalendar(TOKEN)).toBe("new")
  })

  it("lève si la création est refusée", async () => {
    respond = (c) => (c.method === "GET" ? json({ items: [] }) : json({ error: { message: "Insufficient Permission" } }, 403))
    await expect(getOrCreateErpCalendar(TOKEN)).rejects.toThrow("Google Calendar create 403 — Insufficient Permission")
    respond = (c) => (c.method === "GET" ? json({ items: [] }) : new Response("x", { status: 500 }))
    await expect(getOrCreateErpCalendar(TOKEN)).rejects.toThrow(/^Google Calendar create 500$/)
  })
})
