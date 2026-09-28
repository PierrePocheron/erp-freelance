import { describe, it, expect, afterEach } from "vitest"
import { createCompanyTeam } from "@/actions/crm"
import { createClient } from "@/actions/crm"
import { prisma } from "@/lib/prisma"
import { setTestUser } from "./setup"
import { makeUser, makeCompany } from "./helpers/factories"

// La liste blanche doit fermer la porte sur le chemin des SERVER ACTIONS, pas
// seulement sur celui des pages : le proxy edge (qui la revalide à chaque
// requête) ne voit ni /api/** ni les chemins contenant un point.

const ORIGINAL = process.env.AUTH_ALLOWED_EMAILS
afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.AUTH_ALLOWED_EMAILS
  else process.env.AUTH_ALLOWED_EMAILS = ORIGINAL
})

describe("liste blanche sur les server actions", () => {
  it("refuse une action quand l'email de la session n'est pas listé", async () => {
    const user = await makeUser()
    const co = await makeCompany(user.id)
    setTestUser(user.id, "intrus@exemple.fr")
    process.env.AUTH_ALLOWED_EMAILS = "proprietaire@exemple.fr"

    await expect(createCompanyTeam(co.id, "Direction")).rejects.toThrow(/non autorisé/i)
    await expect(createClient(user.id, { firstName: "Jean" })).rejects.toThrow(/non autorisé/i)
    expect(await prisma.companyTeam.count({ where: { companyId: co.id } })).toBe(0)
  })

  it("laisse passer l'email listé, quelle que soit la casse", async () => {
    const user = await makeUser()
    const co = await makeCompany(user.id)
    setTestUser(user.id, "Proprietaire@Exemple.fr")
    process.env.AUTH_ALLOWED_EMAILS = "proprietaire@exemple.fr, autre@exemple.fr"

    const team = await createCompanyTeam(co.id, "Direction")
    expect(team.name).toBe("Direction")
  })

  it("liste non configurée : les actions passent (repli documenté)", async () => {
    const user = await makeUser()
    const co = await makeCompany(user.id)
    setTestUser(user.id, "nimporte@exemple.fr")
    delete process.env.AUTH_ALLOWED_EMAILS

    await expect(createCompanyTeam(co.id, "RH")).resolves.toBeTruthy()
  })
})
