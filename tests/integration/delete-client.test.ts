import { describe, it, expect } from "vitest"
import { deleteClient } from "@/actions/crm"
import { prisma } from "@/lib/prisma"
import { setTestUser } from "./setup"
import { makeUser, makeClient, makeInvoice } from "./helpers/factories"

describe("supprimer un contact (#36)", () => {
  it("refuse un contact facturé avec un message clair (au lieu d'une violation de clé étrangère)", async () => {
    const user = await makeUser()
    const client = await makeClient(user.id)
    await makeInvoice(user.id, client.id, { status: "ISSUED", totalHT: 100 })
    setTestUser(user.id)
    await expect(deleteClient(client.id, "ignored")).rejects.toThrow(/lié à 1 facture/)
    expect(await prisma.client.findUnique({ where: { id: client.id } })).not.toBeNull()
  })

  it("supprime un contact sans document", async () => {
    const user = await makeUser()
    const client = await makeClient(user.id)
    setTestUser(user.id)
    await deleteClient(client.id, "ignored")
    expect(await prisma.client.findUnique({ where: { id: client.id } })).toBeNull()
  })

  it("ne supprime pas le contact d'un autre compte", async () => {
    const victim = await makeUser()
    const theirs = await makeClient(victim.id)
    setTestUser((await makeUser()).id)
    await expect(deleteClient(theirs.id, "ignored")).rejects.toThrow()
    expect(await prisma.client.findUnique({ where: { id: theirs.id } })).not.toBeNull()
  })
})
