import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import {
  createPlatform,
  updatePlatform,
  addEntry,
  addDeposit,
  updateEntry,
  ensureInvestmentReviewTasks,
  setInvestmentReviewReminder,
} from "@/actions/investissements"
import { prisma } from "@/lib/prisma"
import { zonedDateKey, zonedParts } from "@/lib/dates"
import { setTestUser } from "./setup"
import { makeUser } from "./helpers/factories"

async function asNewUser() {
  const user = await makeUser()
  setTestUser(user.id)
  return user
}

const parentOf = (userId: string) =>
  prisma.task.findFirstOrThrow({
    where: { userId, investmentPeriod: "2026-09", parentTaskId: null },
    include: { subTasks: { orderBy: { order: "asc" } } },
  })

describe("plateformes et relevés — validations", () => {
  it("nom requis, type vide → AUTRE, champs optionnels nettoyés ; plateforme inconnue refusée", async () => {
    await asNewUser()
    await expect(createPlatform({ name: "  ", type: "X" })).rejects.toThrow(/Nom de plateforme requis/)
    const id = await createPlatform({ name: " Plateforme A ", type: "  ", url: "  ", notes: " n " })
    expect(await prisma.investmentPlatform.findUniqueOrThrow({ where: { id } })).toMatchObject({
      name: "Plateforme A", type: "AUTRE", url: null, notes: "n",
    })
    await expect(updatePlatform(id, { name: "", type: "X" })).rejects.toThrow(/requis/)
    await updatePlatform(id, { name: "Plateforme B", type: " PEA ", notes: "  " })
    expect(await prisma.investmentPlatform.findUniqueOrThrow({ where: { id } })).toMatchObject({ name: "Plateforme B", type: "PEA", notes: null })
    await expect(updatePlatform("inexistante", { name: "x", type: "x" })).rejects.toThrow(/introuvable/)
  })

  it("relevé sans date = maintenant, apport non numérique → 0 ; mise à jour sans date conserve la date", async () => {
    await asNewUser()
    const id = await createPlatform({ name: "Plateforme", type: "PEA" })
    const before = Date.now()
    await addEntry(id, { capital: 1000, contribution: Number.NaN, note: "  " })
    const entry = await prisma.investmentEntry.findFirstOrThrow({ where: { platformId: id } })
    expect(entry).toMatchObject({ capital: 1000, contribution: 0, note: null })
    expect(entry.date.getTime()).toBeGreaterThanOrEqual(before)

    await updateEntry(entry.id, { capital: 1100, note: " revalorisé " })
    const saved = await prisma.investmentEntry.findUniqueOrThrow({ where: { id: entry.id } })
    expect(saved).toMatchObject({ capital: 1100, contribution: 0, note: "revalorisé" })
    expect(saved.date.getTime()).toBe(entry.date.getTime())

    await updateEntry(entry.id, { capital: 1200, contribution: 50, date: "2026-02-28" })
    expect(zonedDateKey((await prisma.investmentEntry.findUniqueOrThrow({ where: { id: entry.id } })).date)).toBe("2026-02-28")

    await expect(updateEntry(entry.id, { capital: Number.NaN })).rejects.toThrow(/Capital invalide/)
    await expect(updateEntry(entry.id, { capital: 1, date: "pas-une-date" })).rejects.toThrow(/Date invalide/)
    await expect(updateEntry("inexistant", { capital: 1 })).rejects.toThrow(/Relevé introuvable/)
    await expect(addDeposit(id, { amount: 10, date: "pas-une-date" })).rejects.toThrow(/Date invalide/)
    expect((await prisma.investmentEntry.findUniqueOrThrow({ where: { id: entry.id } })).capital).toBe(1200)
  })
})

describe("rappels mensuels de relevé", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(new Date("2026-09-15T10:00:00Z"))
  })
  afterEach(() => vi.useRealTimers())

  it("activation : profil enregistré (jour borné 1–28), tâche du mois + une sous-tâche par plateforme, idempotent", async () => {
    const user = await asNewUser()
    const a = await createPlatform({ name: "Plateforme A", type: "PEA" })
    const b = await createPlatform({ name: "Plateforme B", type: "CTO" })

    await setInvestmentReviewReminder(true, 40.7)
    expect(await prisma.userProfile.findUniqueOrThrow({ where: { userId: user.id } })).toMatchObject({
      investmentReviewReminder: true, investmentReviewDay: 28,
    })
    await ensureInvestmentReviewTasks("ignored", true, 28)

    const parent = await parentOf(user.id)
    expect(parent).toMatchObject({ isGroup: true, priority: "MEDIUM", status: "TODO" })
    expect(parent.title).toContain("septembre 2026")
    expect(zonedDateKey(parent.dueDate!)).toBe("2026-09-28")
    // Même sortOrder pour les deux plateformes : ordre relatif non garanti → tri par titre.
    expect(parent.subTasks.map((s) => [s.title, s.investmentPlatformId, s.priority]).sort()).toEqual([
      ["Relevé — Plateforme A", a, "LOW"],
      ["Relevé — Plateforme B", b, "LOW"],
    ])
    expect(await prisma.task.count({ where: { userId: user.id } })).toBe(3)
  })

  it("désactivé, ou sans plateforme : rien n'est créé ; désactivation enregistrée (jour 0 → 1)", async () => {
    const user = await asNewUser()
    await ensureInvestmentReviewTasks("ignored", true, 5) // aucune plateforme
    await createPlatform({ name: "Plateforme", type: "PEA" })
    await ensureInvestmentReviewTasks("ignored", false, 5)
    await setInvestmentReviewReminder(false, 0)
    expect(await prisma.task.count()).toBe(0)
    expect(await prisma.userProfile.findUniqueOrThrow({ where: { userId: user.id } })).toMatchObject({
      investmentReviewReminder: false, investmentReviewDay: 1,
    })
  })

  it("relevé du mois : coche la sous-tâche, puis la tâche parent quand tout est relevé ; dépôt et autre mois sans effet", async () => {
    const user = await asNewUser()
    const a = await createPlatform({ name: "Plateforme A", type: "PEA" })
    const b = await createPlatform({ name: "Plateforme B", type: "CTO" })
    await ensureInvestmentReviewTasks("ignored", true, 10)

    await addDeposit(a, { amount: 100, date: "2026-09-12" })
    await addEntry(a, { capital: 500, date: "2026-08-31" })
    let parent = await parentOf(user.id)
    expect(parent.subTasks.every((s) => s.status === "TODO")).toBe(true)

    await addEntry(a, { capital: 520, date: "2026-09-12" })
    parent = await parentOf(user.id)
    expect(parent.subTasks.find((s) => s.investmentPlatformId === a)!.status).toBe("DONE")
    expect(parent.subTasks.find((s) => s.investmentPlatformId === a)!.completedAt).not.toBeNull()
    expect(parent.status).toBe("TODO")

    await addEntry(b, { capital: 80, date: "2026-09-13" })
    parent = await parentOf(user.id)
    expect(parent.status).toBe("DONE")
    expect(parent.completedAt).not.toBeNull()
  })

  it("backfill : une plateforme ajoutée en cours de mois reçoit sa sous-tâche et rouvre la tâche soldée ; nouveau jour d'échéance appliqué", async () => {
    const user = await asNewUser()
    const a = await createPlatform({ name: "Plateforme A", type: "PEA" })
    await ensureInvestmentReviewTasks("ignored", true, 10)
    await addEntry(a, { capital: 100, date: "2026-09-12" })
    expect((await parentOf(user.id)).status).toBe("DONE")

    const b = await createPlatform({ name: "Plateforme B", type: "CTO" })
    await ensureInvestmentReviewTasks("ignored", true, 20)
    const parent = await parentOf(user.id)
    expect(parent.status).toBe("TODO")
    expect(parent.completedAt).toBeNull()
    expect(zonedDateKey(parent.dueDate!)).toBe("2026-09-20")
    expect(parent.subTasks.map((s) => [s.investmentPlatformId, s.order])).toEqual([[a, 0], [b, 1]])

    // Rien de neuf : ni doublon ni réouverture.
    await ensureInvestmentReviewTasks("ignored", true, 20)
    expect(await prisma.task.count({ where: { userId: user.id } })).toBe(3)
  })

  it("l'identité vient de la session : l'argument userId est ignoré", async () => {
    const victim = await makeUser()
    setTestUser(victim.id)
    await createPlatform({ name: "Plateforme privée", type: "PEA" })

    const caller = await asNewUser()
    await ensureInvestmentReviewTasks(victim.id, true, 10)
    expect(await prisma.task.count()).toBe(0) // l'appelant n'a pas de plateforme
    expect(await prisma.task.count({ where: { userId: caller.id } })).toBe(0)
  })

  // Régression corrigée le 29/09/2026 (src/actions/investissements.ts:185) — échéance construite avec
  // `new Date(y, m, d, 9, 0, 0)` dans le fuseau du PROCESS : en production (UTC)
  // le rappel « 09:00 » tombe à 11:00 (été) / 10:00 (hiver) à Paris. Même famille
  // que periodOf() (getFullYear/getMonth) qui bascule de mois à minuit UTC.
  it("le rappel mensuel est à 09:00 heure de Paris", async () => {
    const user = await asNewUser()
    await createPlatform({ name: "Plateforme", type: "PEA" })
    await ensureInvestmentReviewTasks("ignored", true, 10)
    expect(zonedParts((await parentOf(user.id)).dueDate!).hour).toBe(9)
  })
})
