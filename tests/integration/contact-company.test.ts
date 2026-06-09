import { describe, it, expect } from "vitest"
import {
  createClient,
  updateClientAll,
  updateCompany,
  deleteCompany,
  searchCompanies,
} from "@/actions/crm"
import { prisma } from "@/lib/prisma"
import { setTestUser } from "./setup"
import { makeUser, makeCompany } from "./helpers/factories"

// Séparation société ↔ contact : un contact pointe vers une Company (companyId),
// et `Client.company` n'est qu'un cache d'affichage resynchronisé côté serveur.

describe("séparation société / contact", () => {
  it("createClient crée la société si elle n'existe pas et lie le contact", async () => {
    const user = await makeUser()
    setTestUser(user.id)

    const client = await createClient(user.id, {
      firstName: "Jean",
      lastName: "Dupont",
      companyName: "Globex SARL",
    })

    expect(client.companyId).not.toBeNull()
    expect(client.company).toBe("Globex SARL")
    expect(client.name).toBe("Jean Dupont")

    const co = await prisma.company.findUnique({ where: { id: client.companyId! } })
    expect(co?.name).toBe("Globex SARL")
    expect(co?.userId).toBe(user.id)
  })

  it("réutilise une société existante (insensible à la casse) sans doublon", async () => {
    const user = await makeUser()
    setTestUser(user.id)
    const existing = await makeCompany(user.id, { name: "Initech" })

    const client = await createClient(user.id, {
      lastName: "Lemoine",
      companyName: "initech",
    })

    expect(client.companyId).toBe(existing.id)
    expect(client.company).toBe("Initech")
    const count = await prisma.company.count({ where: { userId: user.id, name: { equals: "Initech", mode: "insensitive" } } })
    expect(count).toBe(1)
  })

  it("le libellé prime sur prénom/nom pour le cache d'affichage", async () => {
    const user = await makeUser()
    setTestUser(user.id)

    const client = await createClient(user.id, {
      label: "Compta Globex",
      firstName: "Jean",
      lastName: "Dupont",
    })
    expect(client.name).toBe("Compta Globex")
  })

  it("updateClientAll recalcule le cache name quand l'identité change", async () => {
    const user = await makeUser()
    setTestUser(user.id)
    const client = await createClient(user.id, { firstName: "Jean", lastName: "Dupont" })

    await updateClientAll(client.id, { firstName: "Jeanne" })
    const after = await prisma.client.findUnique({ where: { id: client.id } })
    expect(after?.name).toBe("Jeanne Dupont")
  })

  it("updateCompany renomme la société et resynchronise le cache des contacts", async () => {
    const user = await makeUser()
    setTestUser(user.id)
    const client = await createClient(user.id, { lastName: "Martin", companyName: "OldName" })
    expect(client.company).toBe("OldName")

    await updateCompany(client.companyId!, { name: "NewName" })
    const after = await prisma.client.findUnique({ where: { id: client.id } })
    expect(after?.company).toBe("NewName")
  })

  it("deleteCompany détache les contacts (companyId null, cache vidé) sans les supprimer", async () => {
    const user = await makeUser()
    setTestUser(user.id)
    const client = await createClient(user.id, { lastName: "Durand", companyName: "ToDelete" })
    const companyId = client.companyId!

    await deleteCompany(companyId)
    const after = await prisma.client.findUnique({ where: { id: client.id } })
    expect(after).not.toBeNull()
    expect(after?.companyId).toBeNull()
    expect(after?.company).toBeNull()
    expect(await prisma.company.findUnique({ where: { id: companyId } })).toBeNull()
  })

  it("searchCompanies ne renvoie que les sociétés de l'utilisateur courant", async () => {
    const user = await makeUser()
    const other = await makeUser()
    await makeCompany(other.id, { name: "Wayne Enterprises" })
    await makeCompany(user.id, { name: "Wayne Holding" })
    setTestUser(user.id)

    const results = await searchCompanies("Wayne")
    expect(results).toHaveLength(1)
    expect(results[0].name).toBe("Wayne Holding")
  })
})
