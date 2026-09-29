import { describe, it, expect } from "vitest"
import { searchGlobal } from "@/actions/search"
import { prisma } from "@/lib/prisma"
import { setTestUser } from "./setup"
import { makeUser, makeClient, makeCompany, makeProject, makeInvoice, makeQuote } from "./helpers/factories"

// La recherche globale (⌘K) interroge une quinzaine d'entités en parallèle : une
// seule sous-requête qui oublie `userId` expose les données d'un autre compte, et
// rien ne le signalerait. Aucun test ne la couvrait.

async function seedZorglub(userId: string) {
  const client = await makeClient(userId, { name: "Zorglub Industries" })
  const company = await makeCompany(userId, { name: "Zorglub SARL" })
  const project = await makeProject(userId, client.id, "Refonte Zorglub")
  await makeInvoice(userId, client.id, { number: "ZORGLUB-1", status: "SENT", totalHT: 60 })
  await makeQuote(userId, client.id, { number: "ZORGLUB-2", lines: [{ description: "L", quantity: 1, unitPrice: 10, taxRate: 0 }] })
  await prisma.task.create({ data: { userId, projectId: project.id, title: "Tâche Zorglub" } })
  await prisma.expense.create({ data: { userId, label: "Dépense Zorglub", amount: 12, date: new Date(2026, 5, 1) } })
  await prisma.revenue.create({ data: { userId, type: "OTHER", label: "Revenu Zorglub", amount: 34, status: "RECEIVED" } })
  return { client, company, project }
}

describe("recherche globale", () => {
  it("ne renvoie jamais une entité d'un autre compte", async () => {
    const victim = await makeUser()
    await seedZorglub(victim.id)

    const other = await makeUser()
    setTestUser(other.id)
    expect(await searchGlobal("Zorglub")).toEqual([])

    setTestUser(victim.id)
    const mine = await searchGlobal("Zorglub")
    expect(mine.length).toBeGreaterThanOrEqual(6)
    expect(new Set(mine.map((r) => r.type)).size).toBeGreaterThanOrEqual(5)
  })

  it("ignore une requête de moins de deux caractères", async () => {
    const user = await makeUser()
    await seedZorglub(user.id)
    setTestUser(user.id)

    expect(await searchGlobal("Z")).toEqual([])
    expect(await searchGlobal("")).toEqual([])
  })

  it("trouve indépendamment de la casse", async () => {
    const user = await makeUser()
    await seedZorglub(user.id)
    setTestUser(user.id)

    expect((await searchGlobal("zorglub")).length).toBeGreaterThan(0)
    expect((await searchGlobal("ZORGLUB")).length).toBeGreaterThan(0)
  })
})

describe("recherche globale — calendrier et URSSAF (#22)", () => {
  it("trouve un événement par son titre et une déclaration URSSAF, jamais ceux d'un autre compte", async () => {
    const victim = await makeUser()
    await prisma.calendarEvent.create({ data: { userId: victim.id, title: "Réunion Quetzal secrète", startDate: new Date() } })
    const user = await makeUser()
    setTestUser(user.id)
    await prisma.calendarEvent.create({ data: { userId: user.id, title: "Réunion Quetzal", startDate: new Date() } })
    await prisma.urssafDeclaration.create({
      data: { userId: user.id, period: "2026-T3", periodStart: new Date(2026, 6, 1), periodEnd: new Date(2026, 8, 30), dueDate: new Date(2026, 9, 31) },
    })

    const events = await searchGlobal("Quetzal")
    expect(events.filter((r) => r.type === "calendar_event").map((r) => r.label)).toEqual(["Réunion Quetzal"])

    const decl = await searchGlobal("urssaf")
    expect(decl.find((r) => r.type === "urssaf_declaration")?.href).toBe("/impots")
    expect(await searchGlobal("Quetzal", ["contacts"])).toEqual([]) // module calendrier inactif
  })
})
