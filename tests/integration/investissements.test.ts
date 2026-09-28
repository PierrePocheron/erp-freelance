import { describe, it, expect } from "vitest"
import {
  createPlatform, updatePlatform, deletePlatform,
  addEntry, addDeposit, updateEntry, deleteEntry,
} from "@/actions/investissements"
import { prisma } from "@/lib/prisma"
import { setTestUser } from "./setup"
import { makeUser } from "./helpers/factories"

// Module Investissements : les calculs purs sont bien couverts, les ACTIONS ne
// l'étaient pas. Or c'est là que se décide ce qui entre en base — et la règle
// du module est qu'un relevé (valorisation) et un dépôt (flux) sont deux choses
// différentes : les confondre transforme un apport en bénéfice.

async function platform(userId: string, name = "Robo") {
  setTestUser(userId)
  return createPlatform({ name, type: "CROWDLENDING" })
}

describe("plateformes d'investissement", () => {
  it("crée, renomme et supprime une plateforme avec ses relevés", async () => {
    const user = await makeUser()
    const id = await platform(user.id)

    await addEntry(id, { capital: 1000, contribution: 1000, date: "2026-01-31" })
    await updatePlatform(id, { name: "Plateforme A", type: "CROWDLENDING", url: "https://plateforme-a.test" })

    const p = await prisma.investmentPlatform.findUniqueOrThrow({ where: { id }, include: { entries: true } })
    expect(p.name).toBe("Plateforme A")
    expect(p.url).toBe("https://plateforme-a.test")
    expect(p.entries).toHaveLength(1)

    await deletePlatform(id)
    expect(await prisma.investmentPlatform.count({ where: { id } })).toBe(0)
    expect(await prisma.investmentEntry.count({ where: { platformId: id } })).toBe(0)
  })

  it("distingue un relevé (capital) d'un dépôt (flux sans valorisation)", async () => {
    const user = await makeUser()
    const id = await platform(user.id)

    await addEntry(id, { capital: 1000, contribution: 1000, date: "2026-01-31" })
    await addDeposit(id, { amount: 500, date: "2026-02-15" })
    await addEntry(id, { capital: 1560, contribution: 0, date: "2026-02-28" })

    const entries = await prisma.investmentEntry.findMany({ where: { platformId: id }, orderBy: { date: "asc" } })
    expect(entries.map((e) => [e.capital, e.contribution])).toEqual([[1000, 1000], [null, 500], [1560, 0]])
  })

  it("accepte un retrait (montant négatif) mais refuse un dépôt nul", async () => {
    const user = await makeUser()
    const id = await platform(user.id)

    await addDeposit(id, { amount: -300, date: "2026-02-10" })
    expect((await prisma.investmentEntry.findFirstOrThrow({ where: { platformId: id } })).contribution).toBe(-300)

    await expect(addDeposit(id, { amount: 0 })).rejects.toThrow(/invalide/i)
    await expect(addDeposit(id, { amount: Number.NaN })).rejects.toThrow(/invalide/i)
  })

  it("refuse un capital ou une date invalides", async () => {
    const user = await makeUser()
    const id = await platform(user.id)

    await expect(addEntry(id, { capital: Number.NaN, contribution: 0 })).rejects.toThrow(/invalide/i)
    await expect(addEntry(id, { capital: 100, contribution: 0, date: "pas-une-date" })).rejects.toThrow(/invalide/i)
    expect(await prisma.investmentEntry.count({ where: { platformId: id } })).toBe(0)
  })

  it("modifie puis supprime un relevé", async () => {
    const user = await makeUser()
    const id = await platform(user.id)
    await addEntry(id, { capital: 1000, contribution: 0, date: "2026-01-31" })
    const entry = await prisma.investmentEntry.findFirstOrThrow({ where: { platformId: id } })

    await updateEntry(entry.id, { capital: 1200, contribution: 50, date: "2026-02-01" })
    const updated = await prisma.investmentEntry.findUniqueOrThrow({ where: { id: entry.id } })
    expect([updated.capital, updated.contribution]).toEqual([1200, 50])

    await deleteEntry(entry.id)
    expect(await prisma.investmentEntry.count({ where: { id: entry.id } })).toBe(0)
  })

  it("ne touche à rien chez un autre compte (anti-IDOR)", async () => {
    const victim = await makeUser()
    const victimPlatform = await platform(victim.id, "Privée")
    await addEntry(victimPlatform, { capital: 5000, contribution: 5000, date: "2026-01-31" })
    const victimEntry = await prisma.investmentEntry.findFirstOrThrow({ where: { platformId: victimPlatform } })

    const intruder = await makeUser()
    setTestUser(intruder.id)

    await expect(addEntry(victimPlatform, { capital: 1, contribution: 0 })).rejects.toThrow(/introuvable/i)
    await expect(addDeposit(victimPlatform, { amount: 10 })).rejects.toThrow(/introuvable/i)
    await expect(updatePlatform(victimPlatform, { name: "pwned", type: "AUTRE" })).rejects.toThrow()
    await expect(updateEntry(victimEntry.id, { capital: 0, contribution: 0 })).rejects.toThrow()
    await expect(deleteEntry(victimEntry.id)).rejects.toThrow()
    // `deleteMany({ id, userId })` ne lève pas : il ne supprime simplement rien.
    await deletePlatform(victimPlatform)

    const p = await prisma.investmentPlatform.findUniqueOrThrow({ where: { id: victimPlatform }, include: { entries: true } })
    expect(p.name).toBe("Privée")
    expect(p.entries).toHaveLength(1)
    expect(p.entries[0].capital).toBe(5000)
  })
})
