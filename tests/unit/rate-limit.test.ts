import { describe, it, expect, vi, beforeEach } from "vitest"

// On mock Upstash pour tester le chemin in-memory uniquement.
vi.mock("@upstash/redis", () => ({ Redis: class {} }))
vi.mock("@upstash/ratelimit", () => ({ Ratelimit: class { static slidingWindow = vi.fn() } }))

// Import APRÈS le mock pour que les dépendances soient stubées.
const { checkRateLimit, enforceRateLimit } = await import("@/lib/rate-limit")

describe("checkRateLimit (fallback in-memory)", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  it("autorise la première requête", async () => {
    const ok = await checkRateLimit("test:1", 3, 10_000)
    expect(ok).toBe(true)
  })

  it("bloque quand la limite est atteinte dans la fenêtre", async () => {
    const key = "test:block"
    await checkRateLimit(key, 2, 10_000)
    await checkRateLimit(key, 2, 10_000)
    const blocked = await checkRateLimit(key, 2, 10_000)
    expect(blocked).toBe(false)
  })

  it("réinitialise après expiration de la fenêtre", async () => {
    const key = "test:reset"
    await checkRateLimit(key, 1, 1_000)
    const blocked = await checkRateLimit(key, 1, 1_000)
    expect(blocked).toBe(false)

    // Avance le temps au-delà de la fenêtre
    vi.advanceTimersByTime(1_100)

    const allowed = await checkRateLimit(key, 1, 1_000)
    expect(allowed).toBe(true)
  })

  it("clés indépendantes ne s'influencent pas", async () => {
    await checkRateLimit("user-a", 1, 10_000)
    // user-a est bloqué, user-b doit passer
    expect(await checkRateLimit("user-a", 1, 10_000)).toBe(false)
    expect(await checkRateLimit("user-b", 1, 10_000)).toBe(true)
  })
})

describe("enforceRateLimit", () => {
  it("ne lève pas d'erreur si limite non atteinte", async () => {
    await expect(enforceRateLimit("enforce:1", 5, 10_000)).resolves.toBeUndefined()
  })

  it("lève une erreur quand la limite est dépassée", async () => {
    const key = "enforce:block"
    await enforceRateLimit(key, 1, 10_000)
    await expect(enforceRateLimit(key, 1, 10_000)).rejects.toThrow(/trop de requêtes/i)
  })
})
