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
          // Fuseau FIGÉ : la logique de dates est écrite pour Paris et la prod
          // tourne en UTC. Sans ça, un test de fin de mois ou de journée entière
          // passe ou échoue selon la machine (poste en Europe/Paris, CI en UTC).
          env: { TZ: "Europe/Paris" },
        },
      },
      {
        extends: true,
        test: {
          // Rejoue le fuseau de la PRODUCTION. Vercel tourne en UTC et refuse la
          // variable `TZ` (nom réservé) : le décalage ne peut donc pas être
          // corrigé par la configuration, il doit l'être dans le code — et c'est
          // ici qu'on le prouve.
          name: "unit-utc",
          environment: "node",
          include: ["tests/unit-utc/**/*.test.ts"],
          env: { TZ: "UTC" },
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
