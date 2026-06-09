import "dotenv/config" // charge .env (local) sans override → JAMAIS .env.local (prod)
import { defineConfig } from "prisma/config"

// Config Prisma dédiée aux tests : la datasource vient de l'environnement
// (DATABASE_URL injecté par le globalSetup vers la base erp_test), sans
// l'override .env.local de prisma.config.ts qui pointe sur Neon prod.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL,
  },
})
