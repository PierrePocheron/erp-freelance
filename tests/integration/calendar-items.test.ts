import { describe, it, expect } from "vitest"
import {
  createCalendarItem, moveCalendarItem, deleteCalendarItem,
  createCalendarCategory, getOrCreateDefaultCategories, deleteCalendarCategory,
  getCalendarEvents,
} from "@/actions/calendar"
import { prisma } from "@/lib/prisma"
import { setTestUser } from "./setup"
import { makeUser, makeClient, makeProject } from "./helpers/factories"

// `actions/calendar.ts` fait 40 ko et n'avait aucun test, alors qu'il écrit en
// SQL BRUT (donc sans filet de typage) et qu'il crée six natures d'entités
// différentes depuis un seul formulaire.

const D = (y: number, m: number, d: number, h = 9) => new Date(y, m - 1, d, h, 0, 0)

describe("création depuis le calendrier", () => {
  it("crée un événement perso (CalendarEvent MANUAL)", async () => {
    const user = await makeUser()
    setTestUser(user.id)

    const out = await createCalendarItem({ nature: "event", title: "Déjeuner équipe", startDate: D(2026, 10, 2, 12) })

    expect(out.error).toBeUndefined()
    const ev = await prisma.calendarEvent.findFirstOrThrow({ where: { userId: user.id } })
    expect([ev.title, ev.sourceType]).toEqual(["Déjeuner équipe", "MANUAL"])
  })

  it("crée une tâche datée avec sa priorité", async () => {
    const user = await makeUser()
    const client = await makeClient(user.id)
    const project = await makeProject(user.id, client.id)
    setTestUser(user.id)

    await createCalendarItem({
      nature: "task", title: "Relancer le client", startDate: D(2026, 10, 3, 16),
      projectId: project.id, priority: "HIGH",
    })

    const task = await prisma.task.findFirstOrThrow({ where: { projectId: project.id } })
    expect([task.title, task.priority]).toEqual(["Relancer le client", "HIGH"])
    expect(task.dueDate?.getHours()).toBe(16)
  })

  it("crée une interaction et un rappel sur un contact", async () => {
    const user = await makeUser()
    const client = await makeClient(user.id)
    setTestUser(user.id)

    await createCalendarItem({ nature: "interaction", title: "Appel de suivi", startDate: D(2026, 10, 4), clientId: client.id, channel: "CALL" })
    await createCalendarItem({ nature: "reminder", title: "Relancer", startDate: D(2026, 10, 10), clientId: client.id })

    const interaction = await prisma.interaction.findFirstOrThrow({ where: { clientId: client.id } })
    expect([interaction.summary, interaction.channel]).toEqual(["Appel de suivi", "CALL"])
    expect(await prisma.reminder.count({ where: { clientId: client.id } })).toBe(1)
  })

  it("crée un jalon sur un projet", async () => {
    const user = await makeUser()
    const client = await makeClient(user.id)
    const project = await makeProject(user.id, client.id)
    setTestUser(user.id)

    await createCalendarItem({ nature: "milestone", title: "Livraison V1", startDate: D(2026, 11, 5), projectId: project.id })

    const milestone = await prisma.milestone.findFirstOrThrow({ where: { projectId: project.id } })
    expect(milestone.name).toBe("Livraison V1")
  })

  it("refuse un titre vide", async () => {
    const user = await makeUser()
    setTestUser(user.id)
    expect(await createCalendarItem({ nature: "event", title: "   ", startDate: D(2026, 10, 2) })).toEqual({ error: "Le titre est requis" })
    expect(await prisma.calendarEvent.count({ where: { userId: user.id } })).toBe(0)
  })

  it("refuse le contact ou le projet d'un autre compte", async () => {
    const victim = await makeUser()
    const victimClient = await makeClient(victim.id)
    const victimProject = await makeProject(victim.id, victimClient.id)

    const intruder = await makeUser()
    setTestUser(intruder.id)

    const r1 = await createCalendarItem({ nature: "interaction", title: "X", startDate: D(2026, 10, 2), clientId: victimClient.id, channel: "CALL" })
    const r2 = await createCalendarItem({ nature: "milestone", title: "X", startDate: D(2026, 10, 2), projectId: victimProject.id })

    expect(r1.error).toBeTruthy()
    expect(r2.error).toBeTruthy()
    expect(await prisma.interaction.count({ where: { clientId: victimClient.id } })).toBe(0)
    expect(await prisma.milestone.count({ where: { projectId: victimProject.id } })).toBe(0)
  })
})

describe("déplacement depuis le calendrier", () => {
  it("reprogramme une tâche et un jalon", async () => {
    const user = await makeUser()
    const client = await makeClient(user.id)
    const project = await makeProject(user.id, client.id)
    setTestUser(user.id)
    const task = await prisma.task.create({ data: { userId: user.id, projectId: project.id, title: "T", dueDate: D(2026, 10, 1) } })
    const milestone = await prisma.milestone.create({ data: { projectId: project.id, name: "J", date: D(2026, 10, 1) } })

    expect(await moveCalendarItem("task", task.id, D(2026, 10, 8, 14), null, false)).toEqual({})
    expect(await moveCalendarItem("milestone", milestone.id, D(2026, 10, 9), null, true)).toEqual({})

    expect((await prisma.task.findUniqueOrThrow({ where: { id: task.id } })).dueDate?.getDate()).toBe(8)
    expect((await prisma.milestone.findUniqueOrThrow({ where: { id: milestone.id } })).date.getDate()).toBe(9)
  })

  it("ne déplace pas la tâche d'un autre compte", async () => {
    const victim = await makeUser()
    const victimClient = await makeClient(victim.id)
    const victimProject = await makeProject(victim.id, victimClient.id)
    const task = await prisma.task.create({ data: { userId: victim.id, projectId: victimProject.id, title: "T", dueDate: D(2026, 10, 1) } })

    const intruder = await makeUser()
    setTestUser(intruder.id)

    expect((await moveCalendarItem("task", task.id, D(2026, 12, 25), null, false)).error).toBeTruthy()
    expect((await prisma.task.findUniqueOrThrow({ where: { id: task.id } })).dueDate?.getMonth()).toBe(9)
  })

  it("supprime une entité depuis le calendrier, jamais celle d'un autre compte", async () => {
    const victim = await makeUser()
    const victimClient = await makeClient(victim.id)
    const victimTask = await prisma.task.create({ data: { userId: victim.id, clientId: victimClient.id, title: "Privée" } })

    const user = await makeUser()
    const client = await makeClient(user.id)
    const mine = await prisma.task.create({ data: { userId: user.id, clientId: client.id, title: "À moi" } })
    setTestUser(user.id)

    expect(await deleteCalendarItem("task", mine.id)).toEqual({})
    expect(await prisma.task.count({ where: { id: mine.id } })).toBe(0)

    expect((await deleteCalendarItem("task", victimTask.id)).error).toBeTruthy()
    expect(await prisma.task.count({ where: { id: victimTask.id } })).toBe(1)
  })
})

describe("catégories de calendrier", () => {
  it("crée les catégories par défaut une seule fois", async () => {
    const user = await makeUser()
    setTestUser(user.id)

    const first = await getOrCreateDefaultCategories()
    expect(first.length).toBeGreaterThan(0)
    const second = await getOrCreateDefaultCategories()
    expect(second.map((c) => c.id).sort()).toEqual(first.map((c) => c.id).sort())
  })

  it("crée une catégorie et la retrouve sur l'événement", async () => {
    const user = await makeUser()
    setTestUser(user.id)
    const { category } = await createCalendarCategory({ name: "Perso", color: "#ff0000" })
    expect(category).toBeTruthy()

    await createCalendarItem({ nature: "event", title: "Sport", startDate: D(2026, 10, 2, 18), categoryId: category!.id })
    const events = await getCalendarEvents()
    expect(events.some((e) => e.title === "Sport" && e.categoryId === category!.id)).toBe(true)

    await deleteCalendarCategory(category!.id)
    expect(await prisma.calendarCategory.count({ where: { id: category!.id } })).toBe(0)
  })

  it("ne renvoie que les événements du compte courant", async () => {
    const victim = await makeUser()
    setTestUser(victim.id)
    await createCalendarItem({ nature: "event", title: "Événement privé", startDate: D(2026, 10, 2) })

    const other = await makeUser()
    setTestUser(other.id)
    const events = await getCalendarEvents()
    expect(events.some((e) => e.title === "Événement privé")).toBe(false)
  })
})
