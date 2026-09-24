import { describe, it, expect } from "vitest"
import {
  createCompanyTeam,
  renameCompanyTeam,
  deleteCompanyTeam,
  assignContactToTeam,
  updateContactOrgLevel,
} from "@/actions/crm"
import { prisma } from "@/lib/prisma"
import { setTestUser } from "./setup"
import { makeUser, makeCompany, makeClient } from "./helpers/factories"

// Organigramme : les zones appartiennent à une société (pas de userId propre),
// donc toute mutation doit être scopée par `company: { userId }`.

describe("organigramme société (zones + niveaux)", () => {
  it("createCompanyTeam est idempotent sur le nom, insensible à la casse", async () => {
    const user = await makeUser()
    setTestUser(user.id)
    const co = await makeCompany(user.id)

    const a = await createCompanyTeam(co.id, "Red Team")
    const b = await createCompanyTeam(co.id, "  red team  ")

    expect(b.id).toBe(a.id)
    expect(await prisma.companyTeam.count({ where: { companyId: co.id } })).toBe(1)
  })

  it("range un contact dans une zone puis lui pose un niveau", async () => {
    const user = await makeUser()
    setTestUser(user.id)
    const co = await makeCompany(user.id)
    const team = await createCompanyTeam(co.id, "ALH")
    const contact = await makeClient(user.id, { name: "Thomas", companyId: co.id })

    await assignContactToTeam(contact.id, team.id)
    await updateContactOrgLevel(contact.id, "MANAGER")

    const fresh = await prisma.client.findUniqueOrThrow({ where: { id: contact.id } })
    expect(fresh.teamId).toBe(team.id)
    expect(fresh.orgLevel).toBe("MANAGER")

    // Retour dans « À affecter »
    await assignContactToTeam(contact.id, null)
    expect((await prisma.client.findUniqueOrThrow({ where: { id: contact.id } })).teamId).toBeNull()
  })

  it("refuse une zone appartenant à une AUTRE société du même utilisateur", async () => {
    const user = await makeUser()
    setTestUser(user.id)
    const coA = await makeCompany(user.id)
    const coB = await makeCompany(user.id)
    const teamB = await createCompanyTeam(coB.id, "Red Team")
    const contactA = await makeClient(user.id, { name: "Alice", companyId: coA.id })

    await expect(assignContactToTeam(contactA.id, teamB.id)).rejects.toThrow(/autre société/i)
    expect((await prisma.client.findUniqueOrThrow({ where: { id: contactA.id } })).teamId).toBeNull()
  })

  it("une zone d'un autre utilisateur est invisible (anti-IDOR)", async () => {
    const victim = await makeUser()
    const coVictim = await makeCompany(victim.id)
    const teamVictim = await prisma.companyTeam.create({ data: { companyId: coVictim.id, name: "Direction" } })

    const attacker = await makeUser()
    setTestUser(attacker.id)
    const coAttacker = await makeCompany(attacker.id)
    const contact = await makeClient(attacker.id, { name: "Mallory", companyId: coAttacker.id })

    await expect(assignContactToTeam(contact.id, teamVictim.id)).rejects.toThrow(/introuvable/i)
    await expect(renameCompanyTeam(teamVictim.id, "Pwned")).rejects.toThrow(/introuvable/i)
    await expect(deleteCompanyTeam(teamVictim.id)).rejects.toThrow(/introuvable/i)

    expect((await prisma.companyTeam.findUniqueOrThrow({ where: { id: teamVictim.id } })).name).toBe("Direction")
  })

  it("supprimer une zone ne supprime pas ses membres — ils repassent à affecter", async () => {
    const user = await makeUser()
    setTestUser(user.id)
    const co = await makeCompany(user.id)
    const team = await createCompanyTeam(co.id, "RH")
    const contact = await makeClient(user.id, { name: "Morgane", companyId: co.id })
    await assignContactToTeam(contact.id, team.id)

    await deleteCompanyTeam(team.id)

    const fresh = await prisma.client.findUnique({ where: { id: contact.id } })
    expect(fresh).not.toBeNull()
    expect(fresh!.teamId).toBeNull()
  })
})
