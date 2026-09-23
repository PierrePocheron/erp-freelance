import { defineConfig } from "vitest/config"
import { config as loadEnv } from "dotenv"
import { resolveTestDatabaseUrl } from "./tests/integration/helpers/test-db-url"

// ── URL de la base de test ────────────────────────────────────────────────────
// Résolution partagée avec le globalSetup (une seule source, garde-fou « hôte local »
// inclus : les tests créent et écrasent la base, jamais sur un cluster distant).
loadEnv() // .env local, sans override — fournit aussi ENCRYPTION_KEY ci-dessous
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
            ENCRYPTION_KEY: process.env.ENCRYPTION_KEY,
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
