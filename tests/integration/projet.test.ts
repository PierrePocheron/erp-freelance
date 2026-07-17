import { describe, it, expect } from "vitest"
import { createProject, updateProjectCategory, createClientTask } from "@/actions/projet"
import { prisma } from "@/lib/prisma"
import { setTestUser } from "./setup"
import { makeUser, makeClient, makeProject } from "./helpers/factories"

// Projets : catégorie (liseré d'affichage) + tâches client autonomes avec priorité.

// ── createProject (FormData) ─────────────────────────────────────────────────

describe("createProject", () => {
  it("persiste la catégorie passée dans le FormData", async () => {
    const user = await makeUser()
    setTestUser(user.id)

    const fd = new FormData()
    fd.set("name", "Refonte site vitrine")
    fd.set("category", "DEV")

    const project = await createProject("ignored", fd)

    const row = await prisma.project.findUnique({ where: { id: project.id } })
    expect(row?.userId).toBe(user.id)
    expect(row?.name).toBe("Refonte site vitrine")
    expect(row?.category).toBe("DEV")
  })

  it("catégorie absente → AUTRE par défaut", async () => {
    const user = await makeUser()
    setTestUser(user.id)

    const fd = new FormData()
    fd.set("name", "Projet sans catégorie")

    const project = await createProject("ignored", fd)
    const row = await prisma.project.findUnique({ where: { id: project.id } })
    expect(row?.category).toBe("AUTRE")
  })
})

// ── updateProjectCategory ────────────────────────────────────────────────────

describe("updateProjectCategory", () => {
  it("met à jour la catégorie du projet", async () => {
    const user = await makeUser()
    const client = await makeClient(user.id)
    const project = await makeProject(user.id, client.id)
    setTestUser(user.id)

    await updateProjectCategory(project.id, "FORMATION")

    const row = await prisma.project.findUnique({ where: { id: project.id } })
    expect(row?.category).toBe("FORMATION")
  })

  it("refuse le projet d'un autre utilisateur (anti-IDOR)", async () => {
    const owner = await makeUser()
    const intruder = await makeUser()
    const client = await makeClient(owner.id)
    const project = await makeProject(owner.id, client.id)

    setTestUser(intruder.id)
    await expect(updateProjectCategory(project.id, "PROSPECTION")).rejects.toThrow()

    const row = await prisma.project.findUnique({ where: { id: project.id } })
    expect(row?.category).toBe("AUTRE")
  })
})

// ── createClientTask ─────────────────────────────────────────────────────────

describe("createClientTask", () => {
  it("crée une tâche client avec la priorité passée", async () => {
    const user = await makeUser()
    const client = await makeClient(user.id)
    setTestUser(user.id)

    const task = await createClientTask(client.id, "Relancer le devis", "2026-08-01", "URGENT")

    const row = await prisma.task.findUnique({ where: { id: task.id } })
    expect(row?.userId).toBe(user.id)
    expect(row?.clientId).toBe(client.id)
    expect(row?.title).toBe("Relancer le devis")
    expect(row?.priority).toBe("URGENT")
    expect(row?.dueDate?.toISOString().slice(0, 10)).toBe("2026-08-01")
  })

  it("priorité omise → défaut LOW (défaut Prisma du modèle Task)", async () => {
    const user = await makeUser()
    setTestUser(user.id)

    const task = await createClientTask(null, "Tâche sans contexte")

    const row = await prisma.task.findUnique({ where: { id: task.id } })
    expect(row?.clientId).toBeNull()
    expect(row?.dueDate).toBeNull()
    expect(row?.priority).toBe("LOW")
  })

  it("refuse le client d'un autre utilisateur (anti-IDOR)", async () => {
    const owner = await makeUser()
    const intruder = await makeUser()
    const client = await makeClient(owner.id)

    setTestUser(intruder.id)
    await expect(createClientTask(client.id, "Tâche volée", null, "HIGH")).rejects.toThrow(/introuvable/i)

    expect(await prisma.task.count()).toBe(0)
  })
})
