import { describe, it, expect, vi, afterEach } from "vitest"
import { startTimer, stopTimer, deleteTimeEntry, createManualTimeEntry, getRunningTimer } from "@/actions/timetracking"
import { prisma } from "@/lib/prisma"
import { setTestUser } from "./setup"
import { makeUser, makeClient, makeProject } from "./helpers/factories"

// Suivi du temps : `TimeEntry.duration` est en SECONDES (piège déjà rencontré une
// fois) et démarrer un chrono doit arrêter celui en cours. Aucun test jusqu'ici.

afterEach(() => { vi.useRealTimers() })

async function task(userId: string, title = "Développer") {
  const client = await makeClient(userId)
  const project = await makeProject(userId, client.id)
  const t = await prisma.task.create({ data: { userId, projectId: project.id, title } })
  return { project, task: t }
}

describe("suivi du temps", () => {
  it("démarre un chrono, l'arrête, et enregistre la durée EN SECONDES", async () => {
    const user = await makeUser()
    const { project, task: t } = await task(user.id)
    setTestUser(user.id)

    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(new Date(2026, 8, 28, 10, 0, 0))
    const entry = await startTimer(t.id, "ignored", project.id)
    expect(entry.endedAt).toBeNull()

    vi.setSystemTime(new Date(2026, 8, 28, 10, 25, 0)) // +25 min
    await stopTimer(entry.id, "ignored", project.id)

    const stored = await prisma.timeEntry.findUniqueOrThrow({ where: { id: entry.id } })
    expect(stored.duration).toBe(25 * 60) // 1500 secondes, pas 25
    expect(stored.endedAt).not.toBeNull()
  })

  it("démarrer un second chrono arrête le premier", async () => {
    const user = await makeUser()
    const { project, task: a } = await task(user.id, "A")
    const b = await prisma.task.create({ data: { userId: user.id, projectId: project.id, title: "B" } })
    setTestUser(user.id)

    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(new Date(2026, 8, 28, 9, 0, 0))
    const first = await startTimer(a.id, "ignored", project.id)
    vi.setSystemTime(new Date(2026, 8, 28, 9, 10, 0))
    const second = await startTimer(b.id, "ignored", project.id)

    const closed = await prisma.timeEntry.findUniqueOrThrow({ where: { id: first.id } })
    expect(closed.duration).toBe(600)
    expect(closed.endedAt).not.toBeNull()

    const running = await getRunningTimer("ignored")
    expect(running?.id).toBe(second.id)
    expect(await prisma.timeEntry.count({ where: { userId: user.id, endedAt: null } })).toBe(1)
  })

  it("saisie manuelle : durée calculée, fin avant début refusée", async () => {
    const user = await makeUser()
    const { project, task: t } = await task(user.id)
    setTestUser(user.id)

    const ko = await createManualTimeEntry(t.id, project.id, new Date(2026, 8, 28, 14, 0), new Date(2026, 8, 28, 13, 0))
    expect(ko.error).toBeTruthy()

    const ok = await createManualTimeEntry(t.id, project.id, new Date(2026, 8, 28, 14, 0), new Date(2026, 8, 28, 15, 30), "  note  ")
    expect(ok).toEqual({})
    const entry = await prisma.timeEntry.findFirstOrThrow({ where: { taskId: t.id } })
    expect(entry.duration).toBe(90 * 60)
    expect(entry.note).toBe("note")
  })

  it("refuse la tâche d'un autre compte et ne supprime pas son temps", async () => {
    const victim = await makeUser()
    const { project: victimProject, task: victimTask } = await task(victim.id)
    setTestUser(victim.id)
    const victimEntry = await startTimer(victimTask.id, "ignored", victimProject.id)

    const intruder = await makeUser()
    setTestUser(intruder.id)

    await expect(startTimer(victimTask.id, "ignored", victimProject.id)).rejects.toThrow(/introuvable/i)
    expect((await createManualTimeEntry(victimTask.id, victimProject.id, new Date(2026, 8, 28, 9, 0), new Date(2026, 8, 28, 10, 0))).error).toBeTruthy()
    await stopTimer(victimEntry.id, "ignored", victimProject.id) // silencieux : rien à lui
    await expect(deleteTimeEntry(victimEntry.id, "ignored", victimProject.id)).rejects.toThrow()

    const untouched = await prisma.timeEntry.findUniqueOrThrow({ where: { id: victimEntry.id } })
    expect(untouched.endedAt).toBeNull()
    expect(await prisma.timeEntry.count({ where: { userId: intruder.id } })).toBe(0)
  })

  it("aucun chrono en cours → getRunningTimer renvoie null", async () => {
    const user = await makeUser()
    setTestUser(user.id)
    expect(await getRunningTimer("ignored")).toBeNull()
  })
})
