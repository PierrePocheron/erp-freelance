import { describe, it, expect } from "vitest"
import {
  createProspect,
  updateProspectStatus,
  updateProspectsStatusBulk,
  markProspectsContacted,
  deleteProspects,
} from "@/actions/prospection"
import { prisma } from "@/lib/prisma"
import { setTestUser } from "./setup"
import { makeUser, makeClient } from "./helpers/factories"

// Module Prospection : statut 6 valeurs, actions en lot, tracking par Interaction.

describe("createProspect", () => {
  it("crée un prospect TO_CONTACT avec société résolue par nom", async () => {
    const user = await makeUser()
    setTestUser(user.id)

    const p = await createProspect({ name: "Jean Dupont", email: "jean@dupont.fr", companyName: "Boulangerie Dupont" })
    expect(p.type).toBe("PROSPECT")
    expect(p.prospectStatus).toBe("TO_CONTACT")
    expect(p.company).toBe("Boulangerie Dupont")

    const co = await prisma.company.findFirst({ where: { userId: user.id, name: "Boulangerie Dupont" } })
    expect(co).not.toBeNull()
  })
})

describe("updateProspectStatus", () => {
  it("WON convertit le prospect en client", async () => {
    const user = await makeUser()
    setTestUser(user.id)
    const p = await makeClient(user.id, { type: "PROSPECT", prospectStatus: "IN_DISCUSSION" })

    await updateProspectStatus(p.id, "WON")

    const after = await prisma.client.findUnique({ where: { id: p.id } })
    expect(after?.prospectStatus).toBe("WON")
    expect(after?.type).toBe("CLIENT")
  })

  it("un autre statut ne change pas le type", async () => {
    const user = await makeUser()
    setTestUser(user.id)
    const p = await makeClient(user.id, { type: "PROSPECT", prospectStatus: "TO_CONTACT" })

    await updateProspectStatus(p.id, "REPLIED")

    const after = await prisma.client.findUnique({ where: { id: p.id } })
    expect(after?.prospectStatus).toBe("REPLIED")
    expect(after?.type).toBe("PROSPECT")
  })
})

describe("markProspectsContacted", () => {
  it("crée une Interaction par prospect et ne bump que TO_CONTACT", async () => {
    const user = await makeUser()
    setTestUser(user.id)
    const fresh = await makeClient(user.id, { type: "PROSPECT", prospectStatus: "TO_CONTACT" })
    const advanced = await makeClient(user.id, { type: "PROSPECT", prospectStatus: "IN_DISCUSSION", name: "Avancé" })

    const { contacted } = await markProspectsContacted([fresh.id, advanced.id], "EMAIL")
    expect(contacted).toBe(2)

    const freshAfter = await prisma.client.findUnique({ where: { id: fresh.id } })
    const advancedAfter = await prisma.client.findUnique({ where: { id: advanced.id } })
    expect(freshAfter?.prospectStatus).toBe("CONTACTED")
    // Un statut plus avancé n'est pas rétrogradé
    expect(advancedAfter?.prospectStatus).toBe("IN_DISCUSSION")

    const interactions = await prisma.interaction.findMany({ where: { clientId: { in: [fresh.id, advanced.id] } } })
    expect(interactions).toHaveLength(2)
    expect(interactions.every((i) => i.channel === "EMAIL")).toBe(true)
  })

  it("ignore les ids d'un autre utilisateur (anti-IDOR)", async () => {
    const owner = await makeUser()
    const attacker = await makeUser()
    const victim = await makeClient(owner.id, { type: "PROSPECT", prospectStatus: "TO_CONTACT" })

    setTestUser(attacker.id)
    const { contacted } = await markProspectsContacted([victim.id], "CALL")
    expect(contacted).toBe(0)

    const after = await prisma.client.findUnique({ where: { id: victim.id } })
    expect(after?.prospectStatus).toBe("TO_CONTACT")
    expect(await prisma.interaction.count({ where: { clientId: victim.id } })).toBe(0)
  })
})

describe("updateProspectsStatusBulk / deleteProspects", () => {
  it("met à jour en lot uniquement les prospects du user", async () => {
    const user = await makeUser()
    const other = await makeUser()
    const mine = await makeClient(user.id, { type: "PROSPECT" })
    const theirs = await makeClient(other.id, { type: "PROSPECT", name: "Autre" })

    setTestUser(user.id)
    await updateProspectsStatusBulk([mine.id, theirs.id], "LOST")

    expect((await prisma.client.findUnique({ where: { id: mine.id } }))?.prospectStatus).toBe("LOST")
    expect((await prisma.client.findUnique({ where: { id: theirs.id } }))?.prospectStatus).toBe("TO_CONTACT")
  })

  it("deleteProspects ne supprime que des PROSPECT du user", async () => {
    const user = await makeUser()
    setTestUser(user.id)
    const prospect = await makeClient(user.id, { type: "PROSPECT" })
    const realClient = await makeClient(user.id, { type: "CLIENT", name: "Vrai client" })

    const { deleted } = await deleteProspects([prospect.id, realClient.id])
    expect(deleted).toBe(1)
    expect(await prisma.client.findUnique({ where: { id: prospect.id } })).toBeNull()
    expect(await prisma.client.findUnique({ where: { id: realClient.id } })).not.toBeNull()
  })
})
