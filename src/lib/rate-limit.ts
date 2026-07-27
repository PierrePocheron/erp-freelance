// Rate-limiter distribué : Upstash Redis (sliding window) en priorité,
// fallback in-memory si Redis n'est pas configuré ou échoue.
// L'API est async depuis l'ajout d'Upstash — les appelants doivent await.

import { Redis } from "@upstash/redis"
import { Ratelimit } from "@upstash/ratelimit"

// ── Upstash setup (optionnel) ──────────────────────────────────────────────────

let redis: Redis | null = null

if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
  redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  })
}

// Cache des instances Ratelimit (limiteur × fenêtre) pour éviter les re-créations
const limiters = new Map<string, Ratelimit>()

function getLimiter(limit: number, windowMs: number): Ratelimit {
  const cacheKey = `${limit}:${windowMs}`
  if (!limiters.has(cacheKey)) {
    limiters.set(cacheKey, new Ratelimit({
      redis: redis!,
      limiter: Ratelimit.slidingWindow(limit, `${windowMs} ms`),
      prefix: "rl",
    }))
  }
  return limiters.get(cacheKey)!
}

// ── Fallback in-memory (fenêtre glissante) ─────────────────────────────────────

type Bucket = { count: number; resetAt: number }
const buckets = new Map<string, Bucket>()

// Purge périodique des buckets expirés pour borner la mémoire du fallback :
// sans Redis et sur un process long, une clé éphémère (IP/identifiant vu une
// seule fois) resterait indéfiniment en mémoire. Supprimer un bucket expiré est
// sémantiquement neutre (il serait de toute façon réinitialisé au prochain accès).
const SWEEP_INTERVAL_MS = 60_000
const MAX_BUCKETS = 10_000
let lastSweep = 0

function sweepExpiredBuckets(now: number): void {
  for (const [k, b] of buckets) {
    if (now > b.resetAt) buckets.delete(k)
  }
  lastSweep = now
}

function inMemoryCheck(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now()
  if (now - lastSweep > SWEEP_INTERVAL_MS || buckets.size > MAX_BUCKETS) {
    sweepExpiredBuckets(now)
  }
  const bucket = buckets.get(key)
  if (!bucket || now > bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return true
  }
  if (bucket.count >= limit) return false
  bucket.count++
  return true
}

// ── API publique ───────────────────────────────────────────────────────────────

/**
 * Retourne true si l'action est autorisée pour cette clé.
 * Upstash en priorité, fallback in-memory si Redis absent ou en erreur.
 */
export async function checkRateLimit(
  key: string,
  limit: number,
  windowMs = 60_000,
): Promise<boolean> {
  if (!redis) return inMemoryCheck(key, limit, windowMs)
  try {
    const { success } = await getLimiter(limit, windowMs).limit(key)
    return success
  } catch {
    return inMemoryCheck(key, limit, windowMs)
  }
}

/**
 * Lève une erreur si la limite est atteinte.
 */
export async function enforceRateLimit(
  key: string,
  limit: number,
  windowMs = 60_000,
): Promise<void> {
  if (!(await checkRateLimit(key, limit, windowMs))) {
    throw new Error("Trop de requêtes. Veuillez patienter avant de réessayer.")
  }
}
