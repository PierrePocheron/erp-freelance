import { describe, it, expect } from "vitest"
import { createTag, setProjectTags, deleteTag, getOrCreateDefaultTags } from "@/actions/tags"
import { prisma } from "@/lib/prisma"
import { setTestUser } from "./setup"
import { makeUser, makeClient, makeProject } from "./helpers/factories"

// Étiquettes de projet : `setProjectTags` recevait des ids bruts et les posait
// tels quels (`set:`), sans vérifier le propriétaire.

describe("étiquettes de projet", () => {
  it("pose puis remplace les étiquettes d'un projet", async () => {
    const user = await makeUser()
    const client = await makeClient(user.id)
    const project = await makeProject(user.id, client.id)
    setTestUser(user.id)

    const dev = await createTag("ignored", "dev", "#111111")
    const design = await createTag("ignored", "design", "#222222")

    await setProjectTags(project.id, [dev.id, design.id])
    const withTwo = await prisma.project.findUniqueOrThrow({ where: { id: project.id }, include: { tags: true } })
    expect(withTwo.tags.map((t) => t.name).sort()).toEqual(["design", "dev"])

    await setProjectTags(project.id, [dev.id])
    const withOne = await prisma.project.findUniqueOrThrow({ where: { id: project.id }, include: { tags: true } })
    expect(withOne.tags.map((t) => t.name)).toEqual(["dev"])
  })

  it("ignore l'étiquette d'un autre compte", async () => {
    const victim = await makeUser()
    setTestUser(victim.id)
    const victimTag = await createTag("ignored", "confidentiel", "#ff0000")

    const user = await makeUser()
    const client = await makeClient(user.id)
    const project = await makeProject(user.id, client.id)
    setTestUser(user.id)
    const mine = await createTag("ignored", "dev", "#111111")

    await setProjectTags(project.id, [mine.id, victimTag.id])

    const tags = (await prisma.project.findUniqueOrThrow({ where: { id: project.id }, include: { tags: true } })).tags
    expect(tags.map((t) => t.name)).toEqual(["dev"])
  })

  it("refuse le projet d'un autre compte", async () => {
    const victim = await makeUser()
    const victimClient = await makeClient(victim.id)
    const victimProject = await makeProject(victim.id, victimClient.id)

    const user = await makeUser()
    setTestUser(user.id)
    const mine = await createTag("ignored", "dev", "#111111")

    await expect(setProjectTags(victimProject.id, [mine.id])).rejects.toThrow(/introuvable/i)
  })

  it("ne supprime pas l'étiquette d'un autre compte", async () => {
    const victim = await makeUser()
    setTestUser(victim.id)
    const victimTag = await createTag("ignored", "à garder", "#00ff00")

    const intruder = await makeUser()
    setTestUser(intruder.id)
    await expect(deleteTag(victimTag.id, "ignored")).rejects.toThrow()
    expect(await prisma.tag.count({ where: { id: victimTag.id } })).toBe(1)
  })

  it("les étiquettes par défaut sont créées une seule fois", async () => {
    const user = await makeUser()
    setTestUser(user.id)

    const first = await getOrCreateDefaultTags()
    expect(first.length).toBeGreaterThan(0)
    const second = await getOrCreateDefaultTags()

    expect(second.map((t) => t.id).sort()).toEqual(first.map((t) => t.id).sort())
    expect(await prisma.tag.count({ where: { userId: user.id } })).toBe(first.length)
  })
})
