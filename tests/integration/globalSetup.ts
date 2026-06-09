import { execSync } from "node:child_process"
import { Client } from "pg"
import { resolveTestDatabaseUrl, maintenanceTarget } from "./helpers/test-db-url"

// Exécuté une fois avant toute la suite d'intégration :
//  1. crée la base erp_test si absente,
//  2. synchronise le schéma Prisma dessus via `db push`.
//
// On utilise `db push` plutôt que `migrate deploy` car l'historique de migrations
// présente une dérive avec schema.prisma (certaines tables — ConditionsTemplate,
// TaskTag, ProjectIdea… — ont été créées en prod via db push, sans migration).
// `db push` garantit que la base de test reflète exactement schema.prisma.
export default async function setup() {
  const testUrl = resolveTestDatabaseUrl()
  const { maintUrl, dbName } = maintenanceTarget(testUrl)

  // 1. CREATE DATABASE si nécessaire (via la base de maintenance « postgres »).
  const admin = new Client({ connectionString: maintUrl })
  await admin.connect()
  try {
    const { rowCount } = await admin.query("SELECT 1 FROM pg_database WHERE datname = $1", [dbName])
    if (!rowCount) {
      await admin.query(`CREATE DATABASE "${dbName}"`)
      console.log(`[test-db] base « ${dbName} » créée`)
    }
  } finally {
    await admin.end()
  }

  // 2. Synchronisation du schéma Prisma sur la base de test.
  execSync("npx prisma db push --config prisma.test.config.ts --accept-data-loss", {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: testUrl, TEST_DATABASE_URL: testUrl },
  })
}
