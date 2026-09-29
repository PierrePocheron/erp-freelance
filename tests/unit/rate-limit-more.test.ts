import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

// Chemin Upstash (Redis configuré) + fallback sur erreur + purge des buckets.
// Aucun appel réseau : Redis et Ratelimit sont remplacés par des doubles.
const limitMock = vi.hoisted(() => vi.fn())
const ctorArgs = vi.hoisted(() => [] as unknown[])

vi.mock("@upstash/redis", () => ({ Redis: class { constructor(public opts: unknown) {} } }))
vi.mock("@upstash/ratelimit", () => ({
  Ratelimit: class {
    static slidingWindow = vi.fn((n: number, w: string) => ({ n, w }))
    constructor(opts: unknown) {
      ctorArgs.push(opts)
    }
    limit = limitMock
  },
}))

async function loadWithRedis() {
  vi.resetModules()
  vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://redis.invalid")
  vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "fake-token")
  return import("@/lib/rate-limit")
}

describe("checkRateLimit — Upstash configuré", () => {
  beforeEach(() => {
    limitMock.mockReset()
    ctorArgs.length = 0
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.useRealTimers()
  })

  it("délègue à Ratelimit.limit et renvoie son verdict", async () => {
    const { checkRateLimit } = await loadWithRedis()
    limitMock.mockResolvedValueOnce({ success: true }).mockResolvedValueOnce({ success: false })
    expect(await checkRateLimit("k:1", 5, 1_000)).toBe(true)
    expect(await checkRateLimit("k:1", 5, 1_000)).toBe(false)
    expect(limitMock).toHaveBeenCalledWith("k:1")
  })

  it("met en cache un limiteur par couple (limite, fenêtre)", async () => {
    const { checkRateLimit } = await loadWithRedis()
    limitMock.mockResolvedValue({ success: true })
    await checkRateLimit("a", 5, 1_000)
    await checkRateLimit("b", 5, 1_000)
    await checkRateLimit("c", 6, 1_000)
    expect(ctorArgs).toHaveLength(2)
    expect(ctorArgs[0]).toMatchObject({ prefix: "rl", limiter: { n: 5, w: "1000 ms" } })
  })

  it("Redis en erreur → retombe sur le compteur mémoire", async () => {
    const { checkRateLimit, enforceRateLimit } = await loadWithRedis()
    limitMock.mockRejectedValue(new Error("redis down"))
    expect(await checkRateLimit("fb", 1, 10_000)).toBe(true)
    expect(await checkRateLimit("fb", 1, 10_000)).toBe(false)
    await expect(enforceRateLimit("fb", 1, 10_000)).rejects.toThrow(/trop de requêtes/i)
  })
})

describe("fallback mémoire — purge des buckets", () => {
  afterEach(() => vi.useRealTimers())

  it("un bucket expiré est purgé puis recréé (compteur remis à 1)", async () => {
    vi.resetModules()
    const { checkRateLimit } = await import("@/lib/rate-limit")
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"))
    expect(await checkRateLimit("sweep", 1, 1_000)).toBe(true)
    expect(await checkRateLimit("sweep", 1, 1_000)).toBe(false)
    // > SWEEP_INTERVAL_MS (60 s) : la purge passe et supprime le bucket expiré.
    vi.setSystemTime(new Date("2026-01-01T00:02:00Z"))
    expect(await checkRateLimit("other", 1, 1_000)).toBe(true)
    expect(await checkRateLimit("sweep", 1, 1_000)).toBe(true)
  })

  it("la fenêtre par défaut vaut 60 s", async () => {
    vi.resetModules()
    const { checkRateLimit } = await import("@/lib/rate-limit")
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"))
    expect(await checkRateLimit("def", 1)).toBe(true)
    vi.setSystemTime(new Date("2026-01-01T00:00:59Z"))
    expect(await checkRateLimit("def", 1)).toBe(false)
    vi.setSystemTime(new Date("2026-01-01T00:01:01Z"))
    expect(await checkRateLimit("def", 1)).toBe(true)
  })
})
