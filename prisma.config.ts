import "dotenv/config";
import dotenv from "dotenv";
import { defineConfig } from "prisma/config";

// Charge .env.local en priorité (variables Next.js)
dotenv.config({ path: ".env.local", override: true });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env["DATABASE_URL"],
  },
});
