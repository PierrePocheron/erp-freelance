import { describe, it, expect } from "vitest"
import { assertLocalTestUrl, maintenanceTarget } from "../integration/helpers/test-db-url"

// Les tests d'intégration exécutent CREATE DATABASE + `prisma db push --accept-data-loss`.
// Ce garde-fou est la seule chose qui empêche de le faire sur le cluster de production
// si .env venait à contenir une URL distante.
describe("assertLocalTestUrl", () => {
  it("accepte un Postgres local", () => {
    for (const h of ["localhost", "127.0.0.1", "host.docker.internal"]) {
      expect(assertLocalTestUrl(`postgresql://u:p@${h}:5432/erp_test`)).toContain(h)
    }
  })

  it("refuse un hôte distant", () => {
    expect(() => assertLocalTestUrl("postgresql://u:p@ep-xyz.eu-central-1.aws.neon.tech/erp_test?sslmode=require"))
      .toThrow(/n'est pas local/)
  })

  it("laisse passer une chaîne non parsable (le client Postgres tranchera)", () => {
    expect(assertLocalTestUrl("pas-une-url")).toBe("pas-une-url")
  })
})

describe("maintenanceTarget", () => {
  it("bascule sur la base postgres et extrait le nom de base sans query string", () => {
    const { maintUrl, dbName } = maintenanceTarget("postgresql://u:p@localhost:5432/erp_test?schema=public")
    expect(maintUrl).toContain("/postgres")
    expect(dbName).toBe("erp_test")
  })

  it("refuse aussi un hôte distant", () => {
    expect(() => maintenanceTarget("postgresql://u:p@db.example.com:5432/erp_test")).toThrow(/n'est pas local/)
  })
})
