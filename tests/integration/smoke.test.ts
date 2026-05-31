import { describe, it, expect } from "vitest"
import { prisma } from "@/lib/prisma"

// Test de fumée : valide que le harness (création base erp_test, migrations,
// reset beforeEach, connexion Prisma) fonctionne avant d'écrire les vrais tests.
describe("harness d'intégration", () => {
  it("se connecte à la base de test et la voit vide après reset", async () => {
    const users = await prisma.user.count()
    expect(users).toBe(0)
  })

  it("peut créer puis relire un User", async () => {
    await prisma.user.create({
      data: { id: "smoke-1", email: "smoke@test.local", name: "Smoke" },
    })
    const found = await prisma.user.findUnique({ where: { id: "smoke-1" } })
    expect(found?.email).toBe("smoke@test.local")
  })
})
