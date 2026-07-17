import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { prisma } from "@/lib/prisma"
import { setTestUser } from "./setup"
import { makeUser } from "./helpers/factories"

// Notifications push : abonnements en base + envoi web-push (mocké — aucun
// appel réseau réel). Le marqueur "server-only" est neutralisé dans setup.ts.

type WebPushSubscription = { endpoint: string; keys: { p256dh: string; auth: string } }

const webpushMock = vi.hoisted(() => ({
  setVapidDetails: vi.fn(),
  sendNotification: vi.fn<(sub: WebPushSubscription, body: string) => Promise<{ statusCode: number }>>(
    async () => ({ statusCode: 201 })
  ),
}))

vi.mock("web-push", () => ({ default: webpushMock }))

import { savePushSubscription, removePushSubscription } from "@/actions/push"

/**
 * sendPushToUser garde un flag module-level `configured` (VAPID posé une seule
 * fois) : on ré-importe une instance fraîche par test pour maîtriser l'état.
 */
async function freshSendPushToUser() {
  vi.resetModules()
  const mod = await import("@/lib/push")
  return mod.sendPushToUser
}

function sub(endpoint: string, p256dh = "pk", auth = "secret") {
  return { endpoint, keys: { p256dh, auth } }
}

beforeEach(() => {
  webpushMock.setVapidDetails.mockClear()
  webpushMock.sendNotification.mockClear()
  webpushMock.sendNotification.mockImplementation(async () => ({ statusCode: 201 }))
})

afterEach(() => {
  vi.unstubAllEnvs()
})

// ── savePushSubscription ─────────────────────────────────────────────────────

describe("savePushSubscription", () => {
  it("crée l'abonnement puis met à jour les clés au réabonnement (pas de doublon)", async () => {
    const user = await makeUser()
    setTestUser(user.id)

    await savePushSubscription(sub("https://push.test/ep1", "k1", "a1"))
    await savePushSubscription(sub("https://push.test/ep1", "k2", "a2"))

    const rows = await prisma.pushSubscription.findMany({ where: { endpoint: "https://push.test/ep1" } })
    expect(rows).toHaveLength(1)
    expect(rows[0].userId).toBe(user.id)
    expect(rows[0].p256dh).toBe("k2")
    expect(rows[0].auth).toBe("a2")
  })

  it("ré-attribue l'endpoint si un autre compte se réabonne sur le même appareil", async () => {
    const u1 = await makeUser()
    const u2 = await makeUser()

    setTestUser(u1.id)
    await savePushSubscription(sub("https://push.test/shared"))

    setTestUser(u2.id)
    await savePushSubscription(sub("https://push.test/shared"))

    const rows = await prisma.pushSubscription.findMany({ where: { endpoint: "https://push.test/shared" } })
    expect(rows).toHaveLength(1)
    expect(rows[0].userId).toBe(u2.id)
  })
})

// ── removePushSubscription ───────────────────────────────────────────────────

describe("removePushSubscription", () => {
  it("supprime l'abonnement de l'utilisateur courant", async () => {
    const user = await makeUser()
    setTestUser(user.id)
    await savePushSubscription(sub("https://push.test/mine"))

    await removePushSubscription("https://push.test/mine")

    expect(await prisma.pushSubscription.count({ where: { userId: user.id } })).toBe(0)
  })

  it("est scopé par user : un intrus ne peut pas supprimer l'abonnement d'un autre", async () => {
    const owner = await makeUser()
    const intruder = await makeUser()

    setTestUser(owner.id)
    await savePushSubscription(sub("https://push.test/owner"))

    setTestUser(intruder.id)
    await removePushSubscription("https://push.test/owner")

    expect(await prisma.pushSubscription.count({ where: { endpoint: "https://push.test/owner" } })).toBe(1)
  })
})

// ── sendPushToUser ───────────────────────────────────────────────────────────

describe("sendPushToUser", () => {
  it("envoie à tous les endpoints du user, et seulement les siens", async () => {
    vi.stubEnv("NEXT_PUBLIC_VAPID_PUBLIC_KEY", "test-public-key")
    vi.stubEnv("VAPID_PRIVATE_KEY", "test-private-key")

    const user = await makeUser()
    const other = await makeUser()
    await prisma.pushSubscription.createMany({
      data: [
        { userId: user.id, endpoint: "https://push.test/a", p256dh: "pk", auth: "s" },
        { userId: user.id, endpoint: "https://push.test/b", p256dh: "pk", auth: "s" },
        { userId: other.id, endpoint: "https://push.test/autre", p256dh: "pk", auth: "s" },
      ],
    })

    const sendPushToUser = await freshSendPushToUser()
    await sendPushToUser(user.id, { title: "Test", body: "Bonjour", url: "/" })

    expect(webpushMock.setVapidDetails).toHaveBeenCalledOnce()
    expect(webpushMock.sendNotification).toHaveBeenCalledTimes(2)
    const endpoints = webpushMock.sendNotification.mock.calls.map((c) => c[0].endpoint)
    expect(endpoints.sort()).toEqual(["https://push.test/a", "https://push.test/b"])
    // Le payload part sérialisé en JSON.
    const body = webpushMock.sendNotification.mock.calls[0][1]
    expect(JSON.parse(body)).toEqual({ title: "Test", body: "Bonjour", url: "/" })
  })

  it("purge l'abonnement mort (410) mais garde ceux en échec transitoire (500)", async () => {
    vi.stubEnv("NEXT_PUBLIC_VAPID_PUBLIC_KEY", "test-public-key")
    vi.stubEnv("VAPID_PRIVATE_KEY", "test-private-key")

    const user = await makeUser()
    await prisma.pushSubscription.createMany({
      data: [
        { userId: user.id, endpoint: "https://push.test/ok", p256dh: "pk", auth: "s" },
        { userId: user.id, endpoint: "https://push.test/gone", p256dh: "pk", auth: "s" },
        { userId: user.id, endpoint: "https://push.test/flaky", p256dh: "pk", auth: "s" },
      ],
    })

    webpushMock.sendNotification.mockImplementation(async ({ endpoint }) => {
      if (endpoint.endsWith("/gone")) throw Object.assign(new Error("Gone"), { statusCode: 410 })
      if (endpoint.endsWith("/flaky")) throw Object.assign(new Error("Server error"), { statusCode: 500 })
      return { statusCode: 201 }
    })

    const sendPushToUser = await freshSendPushToUser()
    // Best-effort : les échecs d'envoi ne remontent jamais à l'appelant.
    await expect(sendPushToUser(user.id, { title: "Purge" })).resolves.toBeUndefined()

    const endpoints = (await prisma.pushSubscription.findMany({ where: { userId: user.id } }))
      .map((s) => s.endpoint)
      .sort()
    expect(endpoints).toEqual(["https://push.test/flaky", "https://push.test/ok"])
  })

  it("n'envoie rien si les clés VAPID ne sont pas configurées", async () => {
    vi.stubEnv("NEXT_PUBLIC_VAPID_PUBLIC_KEY", undefined)
    vi.stubEnv("VAPID_PRIVATE_KEY", undefined)

    const user = await makeUser()
    await prisma.pushSubscription.create({
      data: { userId: user.id, endpoint: "https://push.test/silencieux", p256dh: "pk", auth: "s" },
    })

    const sendPushToUser = await freshSendPushToUser()
    await expect(sendPushToUser(user.id, { title: "Muet" })).resolves.toBeUndefined()

    expect(webpushMock.setVapidDetails).not.toHaveBeenCalled()
    expect(webpushMock.sendNotification).not.toHaveBeenCalled()
  })
})
