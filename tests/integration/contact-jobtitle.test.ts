import { describe, it, expect } from "vitest"
import { createClient, updateClientAll } from "@/actions/crm"
import { prisma } from "@/lib/prisma"
import { setTestUser } from "./setup"
import { makeUser } from "./helpers/factories"

// Champ jobTitle (poste / fonction) sur les contacts : trim, vide → null, et
// le cache d'affichage `name` ne doit pas être recalculé/cassé par une mise à
// jour qui ne touche pas l'identité.

describe("createClient — jobTitle", () => {
  it("trim le jobTitle et le persiste", async () => {
    const user = await makeUser()
    setTestUser(user.id)

    const client = await createClient("ignored", {
      firstName: "Jean",
      lastName: "Dupont",
      jobTitle: "  Directeur technique  ",
    })

    const row = await prisma.client.findUnique({ where: { id: client.id } })
    expect(row?.jobTitle).toBe("Directeur technique")
    expect(row?.name).toBe("Jean Dupont")
  })

  it("jobTitle vide ou absent → null", async () => {
    const user = await makeUser()
    setTestUser(user.id)

    const vide = await createClient("ignored", { firstName: "Marie", jobTitle: "   " })
    expect((await prisma.client.findUnique({ where: { id: vide.id } }))?.jobTitle).toBeNull()

    const absent = await createClient("ignored", { firstName: "Paul" })
    expect((await prisma.client.findUnique({ where: { id: absent.id } }))?.jobTitle).toBeNull()
  })
})

describe("updateClientAll — jobTitle", () => {
  it("mettre à jour le seul jobTitle ne casse pas le cache name", async () => {
    const user = await makeUser()
    setTestUser(user.id)
    const client = await createClient("ignored", { firstName: "Jean", lastName: "Dupont" })

    await updateClientAll(client.id, { jobTitle: "Gérant" })

    const row = await prisma.client.findUnique({ where: { id: client.id } })
    expect(row?.jobTitle).toBe("Gérant")
    // L'identité n'a pas été touchée → le cache d'affichage reste intact.
    expect(row?.name).toBe("Jean Dupont")
    expect(row?.firstName).toBe("Jean")
    expect(row?.lastName).toBe("Dupont")
  })

  it("jobTitle vidé (chaîne blanche) → null en base", async () => {
    const user = await makeUser()
    setTestUser(user.id)
    const client = await createClient("ignored", { firstName: "Jean", jobTitle: "CTO" })

    await updateClientAll(client.id, { jobTitle: "  " })

    const row = await prisma.client.findUnique({ where: { id: client.id } })
    expect(row?.jobTitle).toBeNull()
  })

  it("refuse le contact d'un autre utilisateur (anti-IDOR)", async () => {
    const owner = await makeUser()
    const intruder = await makeUser()

    setTestUser(owner.id)
    const client = await createClient("ignored", { firstName: "Jean", jobTitle: "CTO" })

    setTestUser(intruder.id)
    await expect(updateClientAll(client.id, { jobTitle: "Piraté" })).rejects.toThrow(/introuvable/i)

    const row = await prisma.client.findUnique({ where: { id: client.id } })
    expect(row?.jobTitle).toBe("CTO")
  })
})
