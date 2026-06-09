import { config as loadEnv } from "dotenv"

// URL de la base de test. Priorité : TEST_DATABASE_URL (CI) > DATABASE_URL local
// (.env) avec le nom de base remplacé par « erp_test ». On NE charge JAMAIS
// .env.local (= Neon prod).
export function resolveTestDatabaseUrl(): string {
  if (process.env.TEST_DATABASE_URL) return process.env.TEST_DATABASE_URL
  loadEnv() // .env local, sans override
  const base = process.env.DATABASE_URL
  if (!base) return "postgresql://postgres:postgres@localhost:5432/erp_test"
  try {
    const u = new URL(base)
    u.pathname = "/erp_test"
    return u.toString()
  } catch {
    return base
  }
}

// URL pointée sur la base de maintenance « postgres » + nom de la base de test
// (pour exécuter CREATE DATABASE).
export function maintenanceTarget(testUrl: string): { maintUrl: string; dbName: string } {
  const u = new URL(testUrl)
  const dbName = u.pathname.replace(/^\//, "").split("?")[0] || "erp_test"
  u.pathname = "/postgres"
  return { maintUrl: u.toString(), dbName }
}
