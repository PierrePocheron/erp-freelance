import { defineConfig } from "vitest/config"
import { config as loadEnv } from "dotenv"

// ── URL de la base de test ────────────────────────────────────────────────────
// Priorité : TEST_DATABASE_URL (CI) > DATABASE_URL local (.env) avec le nom de
// base remplacé par « erp_test ». On NE charge JAMAIS .env.local ici (= prod Neon).
function resolveTestDatabaseUrl(): string {
  if (process.env.TEST_DATABASE_URL) return process.env.TEST_DATABASE_URL
  loadEnv() // charge .env (local), sans override
  const base = process.env.DATABASE_URL
  if (!base) {
    // Valeur par défaut raisonnable pour un Postgres local de dev.
    return "postgresql://postgres:postgres@localhost:5432/erp_test"
  }
  try {
    const u = new URL(base)
    u.pathname = "/erp_test"
    return u.toString()
  } catch {
    return base
  }
}

const testDatabaseUrl = resolveTestDatabaseUrl()

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          environment: "node",
          include: ["tests/unit/**/*.test.ts", "src/**/*.test.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "integration",
          environment: "node",
          include: ["tests/integration/**/*.test.ts"],
          globalSetup: ["tests/integration/globalSetup.ts"],
          setupFiles: ["tests/integration/setup.ts"],
          // Une seule base partagée → on sérialise les fichiers pour éviter les
          // collisions ; le reset (truncate) se fait en beforeEach.
          fileParallelism: false,
          env: {
            DATABASE_URL: testDatabaseUrl,
            TEST_DATABASE_URL: testDatabaseUrl,
            NODE_ENV: "test",
          },
        },
      },
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      reportsDirectory: "coverage",
      include: ["src/lib/**", "src/actions/**"],
      exclude: ["src/generated/**", "**/*.test.ts"],
    },
  },
})
