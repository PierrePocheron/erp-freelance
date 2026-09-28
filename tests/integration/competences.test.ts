import { describe, it, expect } from "vitest"
import {
  createSkill, updateSkill, deleteSkill, moveSkill, patchSkill,
  setProjectSkill, removeProjectSkill, linkOrCreateProjectSkill,
} from "@/actions/competences"
import { prisma } from "@/lib/prisma"
import { setTestUser } from "./setup"
import { makeUser, makeClient, makeProject } from "./helpers/factories"

// Module Compétences : un ARBRE (parent/enfant) plus des liaisons vers les
// projets. Deux pièges structurels — un parent d'un autre compte, et un cycle
// (rattacher un nœud sous son propre descendant) — dont aucun n'était testé.

describe("arbre de compétences", () => {
  it("crée un nœud racine puis un enfant", async () => {
    const user = await makeUser()
    setTestUser(user.id)

    const backend = await createSkill({ name: "Back-end", type: "HARD", level: 0, status: "TO_ACQUIRE" })
    const go = await createSkill({ name: "Go", type: "HARD", level: 0, status: "TO_ACQUIRE", parentId: backend })

    const child = await prisma.skill.findUniqueOrThrow({ where: { id: go } })
    expect([child.name, child.parentId]).toEqual(["Go", backend])
  })

  it("ignore un parent appartenant à un autre compte", async () => {
    const victim = await makeUser()
    setTestUser(victim.id)
    const victimSkill = await createSkill({ name: "Privé", type: "HARD", level: 0, status: "TO_ACQUIRE" })

    const user = await makeUser()
    setTestUser(user.id)
    const mine = await createSkill({ name: "Go", type: "HARD", level: 0, status: "TO_ACQUIRE", parentId: victimSkill })

    // Rattaché à rien plutôt qu'à l'arbre d'autrui.
    expect((await prisma.skill.findUniqueOrThrow({ where: { id: mine } })).parentId).toBeNull()
  })

  it("refuse un cycle : un nœud ne peut pas passer sous son propre descendant", async () => {
    const user = await makeUser()
    setTestUser(user.id)
    const racine = await createSkill({ name: "Back-end", type: "HARD", level: 0, status: "TO_ACQUIRE" })
    const enfant = await createSkill({ name: "Go", type: "HARD", level: 0, status: "TO_ACQUIRE", parentId: racine })
    const petit = await createSkill({ name: "GORM", type: "HARD", level: 0, status: "TO_ACQUIRE", parentId: enfant })

    await expect(moveSkill(racine, petit)).rejects.toThrow(/cycle/i)
    expect((await prisma.skill.findUniqueOrThrow({ where: { id: racine } })).parentId).toBeNull()
  })

  it("déplace un nœud sous un autre parent", async () => {
    const user = await makeUser()
    setTestUser(user.id)
    const a = await createSkill({ name: "A", type: "HARD", level: 0, status: "TO_ACQUIRE" })
    const b = await createSkill({ name: "B", type: "HARD", level: 0, status: "TO_ACQUIRE" })
    const feuille = await createSkill({ name: "Feuille", type: "HARD", level: 0, status: "TO_ACQUIRE", parentId: a })

    await moveSkill(feuille, b)
    expect((await prisma.skill.findUniqueOrThrow({ where: { id: feuille } })).parentId).toBe(b)

    await moveSkill(feuille, null)
    expect((await prisma.skill.findUniqueOrThrow({ where: { id: feuille } })).parentId).toBeNull()
  })

  it("met à jour puis supprime une compétence", async () => {
    const user = await makeUser()
    setTestUser(user.id)
    const id = await createSkill({ name: "Go", type: "HARD", level: 0, status: "TO_ACQUIRE" })

    await updateSkill(id, { name: "Golang", type: "HARD", level: 3, status: "MASTERED" })
    const updated = await prisma.skill.findUniqueOrThrow({ where: { id } })
    expect([updated.name, updated.level, updated.status]).toEqual(["Golang", 3, "MASTERED"])

    await patchSkill(id, { level: 2 })
    expect((await prisma.skill.findUniqueOrThrow({ where: { id } })).level).toBe(2)

    await deleteSkill(id)
    expect(await prisma.skill.count({ where: { id } })).toBe(0)
  })

  it("ne modifie ni ne supprime la compétence d'un autre compte", async () => {
    const victim = await makeUser()
    setTestUser(victim.id)
    const victimSkill = await createSkill({ name: "Privé", type: "HARD", level: 0, status: "TO_ACQUIRE" })

    const intruder = await makeUser()
    setTestUser(intruder.id)
    await deleteSkill(victimSkill).catch(() => {})
    await updateSkill(victimSkill, { name: "pwned", type: "HARD", level: 0, status: "TO_ACQUIRE" }).catch(() => {})
    await patchSkill(victimSkill, { level: 0 }).catch(() => {})

    const after = await prisma.skill.findUniqueOrThrow({ where: { id: victimSkill } })
    expect(after.name).toBe("Privé")
  })
})

describe("compétences d'un projet", () => {
  it("lie une compétence avec sa version, sans écraser le reste au toggle", async () => {
    const user = await makeUser()
    const client = await makeClient(user.id)
    const project = await makeProject(user.id, client.id)
    setTestUser(user.id)
    const skill = await createSkill({ name: "Next.js", type: "HARD", level: 0, status: "TO_ACQUIRE" })

    await setProjectSkill(project.id, skill, { version: "16", role: "USED" })
    await setProjectSkill(project.id, skill, { core: true }) // toggle « stack principale »

    const link = await prisma.projectSkill.findUniqueOrThrow({
      where: { projectId_skillId: { projectId: project.id, skillId: skill } },
    })
    // La version ne doit pas être perdue par le toggle (mise à jour partielle).
    expect([link.version, link.core]).toEqual(["16", true])

    await removeProjectSkill(project.id, skill)
    expect(await prisma.projectSkill.count({ where: { projectId: project.id } })).toBe(0)
  })

  it("crée la compétence à la volée quand on la lie par son nom", async () => {
    const user = await makeUser()
    const client = await makeClient(user.id)
    const project = await makeProject(user.id, client.id)
    setTestUser(user.id)

    await linkOrCreateProjectSkill(project.id, "Docker", { version: "27" })
    await linkOrCreateProjectSkill(project.id, "docker") // même nom, casse différente

    const skills = await prisma.skill.findMany({ where: { userId: user.id } })
    expect(skills).toHaveLength(1)
    const links = await prisma.projectSkill.findMany({ where: { projectId: project.id } })
    expect(links).toHaveLength(1)
    expect(links[0].version).toBe("27") // la seconde liaison n'écrase pas la version
  })

  it("refuse le projet ou la compétence d'un autre compte", async () => {
    const victim = await makeUser()
    const victimClient = await makeClient(victim.id)
    const victimProject = await makeProject(victim.id, victimClient.id)
    setTestUser(victim.id)
    const victimSkill = await createSkill({ name: "Privé", type: "HARD", level: 0, status: "TO_ACQUIRE" })

    const user = await makeUser()
    const client = await makeClient(user.id)
    const project = await makeProject(user.id, client.id)
    setTestUser(user.id)
    const mySkill = await createSkill({ name: "Go", type: "HARD", level: 0, status: "TO_ACQUIRE" })

    await expect(setProjectSkill(victimProject.id, mySkill, {})).rejects.toThrow(/introuvable/i)
    await expect(setProjectSkill(project.id, victimSkill, {})).rejects.toThrow(/introuvable/i)
    // Lève au lieu de retourner silencieusement : le projet n'est pas à lui.
    await expect(linkOrCreateProjectSkill(victimProject.id, "Injecté")).rejects.toThrow(/introuvable/i)

    expect(await prisma.projectSkill.count({ where: { projectId: victimProject.id } })).toBe(0)
    expect(await prisma.skill.count({ where: { userId: victim.id } })).toBe(1)
  })
})
