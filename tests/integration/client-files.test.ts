import { describe, it, expect, vi } from "vitest"
import { del } from "@vercel/blob"
import { addClientFile, deleteClientFile } from "@/actions/crm"
import { prisma } from "@/lib/prisma"
import { setTestUser } from "./setup"
import { makeUser, makeClient } from "./helpers/factories"

const blobUrl = (userId: string, name = "brief.pdf") => `https://abc123.public.blob.vercel-storage.com/uploads/${userId}/${name}`

describe("fichiers d'un contact (#28)", () => {
  it("ajoute un fichier déposé par ce compte, puis le supprime (ligne + stockage)", async () => {
    const user = await makeUser()
    const client = await makeClient(user.id)
    setTestUser(user.id)

    await addClientFile(client.id, { name: "Brief.pdf", fileUrl: blobUrl(user.id), type: "BRIEF" })
    const file = await prisma.clientFile.findFirstOrThrow({ where: { clientId: client.id } })
    expect(file).toMatchObject({ name: "Brief.pdf", type: "BRIEF" })

    await deleteClientFile(file.id)
    expect(await prisma.clientFile.count({ where: { clientId: client.id } })).toBe(0)
    expect(vi.mocked(del)).toHaveBeenCalledWith(blobUrl(user.id))
  })

  it("refuse un lien arbitraire, le fichier d'un autre compte et le contact d'un autre compte", async () => {
    const victim = await makeUser()
    const theirClient = await makeClient(victim.id)
    const user = await makeUser()
    const client = await makeClient(user.id)
    setTestUser(user.id)

    await expect(addClientFile(client.id, { name: "x", fileUrl: "https://evil.example.com/x.pdf" })).rejects.toThrow("Fichier invalide")
    await expect(addClientFile(client.id, { name: "x", fileUrl: blobUrl(victim.id) })).rejects.toThrow("Fichier invalide")
    await expect(addClientFile(theirClient.id, { name: "x", fileUrl: blobUrl(user.id) })).rejects.toThrow("Contact introuvable")
    expect(await prisma.clientFile.count()).toBe(0)
  })

  it("type inconnu → « Autre » ; suppression du fichier d'un autre compte refusée", async () => {
    const victim = await makeUser()
    const vClient = await makeClient(victim.id)
    const theirFile = await prisma.clientFile.create({ data: { clientId: vClient.id, name: "secret.pdf", fileUrl: blobUrl(victim.id) } })
    const user = await makeUser()
    const client = await makeClient(user.id)
    setTestUser(user.id)

    await addClientFile(client.id, { name: "Logo.png", fileUrl: blobUrl(user.id, "logo.png"), type: "PIRATE" })
    expect((await prisma.clientFile.findFirstOrThrow({ where: { clientId: client.id } })).type).toBe("OTHER")
    await expect(deleteClientFile(theirFile.id)).rejects.toThrow("Fichier introuvable")
    expect(await prisma.clientFile.count({ where: { id: theirFile.id } })).toBe(1)
  })
})
