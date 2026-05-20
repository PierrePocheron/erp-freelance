/**
 * Rate limiter en mémoire — suffit pour un usage mono-utilisateur.
 * Chaque "bucket" est identifié par une clé (ex: "email:userId").
 * Utilise la fenêtre glissante (sliding window).
 */

type Bucket = { count: number; resetAt: number }

const buckets = new Map<string, Bucket>()

/**
 * Vérifie si une action est autorisée pour la clé donnée.
 * @param key      Identifiant unique (ex: `email:${userId}`)
 * @param limit    Nombre max d'appels autorisés sur la fenêtre
 * @param windowMs Durée de la fenêtre en ms (défaut: 60 000 = 1 min)
 * @returns true si autorisé, false si rate limit dépassé
 */
export function checkRateLimit(key: string, limit: number, windowMs = 60_000): boolean {
  const now = Date.now()
  const bucket = buckets.get(key)

  if (!bucket || now > bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return true
  }

  if (bucket.count >= limit) return false

  bucket.count++
  return true
}

/**
 * Comme checkRateLimit, mais lève une erreur si la limite est atteinte.
 */
export function enforceRateLimit(key: string, limit: number, windowMs = 60_000): void {
  if (!checkRateLimit(key, limit, windowMs)) {
    throw new Error("Trop de requêtes. Veuillez patienter avant de réessayer.")
  }
}
