import { config as loadEnv } from "dotenv"

// URL de la base de test. Priorité : TEST_DATABASE_URL (CI) > DATABASE_URL local
// (.env) avec le nom de base remplacé par « erp_test ». On NE charge JAMAIS
// .env.local (= Neon prod).
//
// ⚠️ Garde-fou : le harnais d'intégration exécute CREATE DATABASE puis
// `prisma db push --accept-data-loss`. Si .env venait à contenir une URL distante
// (copier-coller depuis .env.local, nouvelle machine…), lancer les tests créerait une
// base sur le cluster de PRODUCTION. On refuse donc tout hôte non local, sauf si
// TEST_DATABASE_URL est fourni explicitement (CI, base jetable dédiée).
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]", "0.0.0.0", "host.docker.internal", ""])

export function assertLocalTestUrl(url: string): string {
  let host: string
  try {
    host = new URL(url).hostname
  } catch {
    return url // chaîne non parsable : laissée au client Postgres, qui tranchera
  }
  if (!LOCAL_HOSTS.has(host)) {
    throw new Error(
      `Base de test refusée : l'hôte « ${host} » n'est pas local. Les tests d'intégration créent et écrasent la base ` +
      `(CREATE DATABASE + prisma db push --accept-data-loss). Corrige DATABASE_URL dans .env pour pointer un Postgres ` +
      `local, ou fournis TEST_DATABASE_URL explicitement.`,
    )
  }
  return url
}

export function resolveTestDatabaseUrl(): string {
  if (process.env.TEST_DATABASE_URL) return process.env.TEST_DATABASE_URL
  loadEnv() // .env local, sans override
  const base = process.env.DATABASE_URL
  if (!base) return "postgresql://postgres:postgres@localhost:5432/erp_test"
  try {
    const u = new URL(base)
    u.pathname = "/erp_test"
    return assertLocalTestUrl(u.toString())
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("Base de test refusée")) throw err
    return base
  }
}

// URL pointée sur la base de maintenance « postgres » + nom de la base de test
// (pour exécuter CREATE DATABASE).
export function maintenanceTarget(testUrl: string): { maintUrl: string; dbName: string } {
  const u = new URL(assertLocalTestUrl(testUrl))
  const dbName = u.pathname.replace(/^\//, "").split("?")[0] || "erp_test"
  u.pathname = "/postgres"
  return { maintUrl: u.toString(), dbName }
}
