import { describe, it, expect } from "vitest"
import {
  addInteraction,
  updateInteraction,
  deleteInteraction,
  addReminder,
  toggleReminder,
  deleteReminder,
} from "@/actions/crm"
import { prisma } from "@/lib/prisma"
import { setTestUser } from "./setup"
import { makeUser, makeClient } from "./helpers/factories"

// ── Interactions ──────────────────────────────────────────────────────────────

describe("addInteraction", () => {
  it("crée une interaction liée au client", async () => {
    const user   = await makeUser()
    const client = await makeClient(user.id)
    setTestUser(user.id)

    await addInteraction(client.id, {
      date:    "2026-05-10",
      channel: "EMAIL",
      summary: "Premier contact par email",
    })

    const interactions = await prisma.interaction.findMany({ where: { clientId: client.id } })
    expect(interactions).toHaveLength(1)
    expect(interactions[0].channel).toBe("EMAIL")
    expect(interactions[0].summary).toBe("Premier contact par email")
    expect(interactions[0].response).toBeNull()
  })

  it("enregistre une réponse facultative", async () => {
    const user   = await makeUser()
    const client = await makeClient(user.id)
    setTestUser(user.id)

    await addInteraction(client.id, {
      date:     "2026-05-11",
      channel:  "CALL",
      summary:  "Appel de suivi",
      response: "RDV pris pour la semaine prochaine",
    })

    const i = await prisma.interaction.findFirst({ where: { clientId: client.id } })
    expect(i?.response).toBe("RDV pris pour la semaine prochaine")
  })

  it("refuse de créer une interaction pour le client d'un autre utilisateur", async () => {
    const owner   = await makeUser()
    const intruder = await makeUser()
    const client  = await makeClient(owner.id)
    setTestUser(intruder.id)

    await expect(
      addInteraction(client.id, { date: "2026-05-01", channel: "EMAIL", summary: "Intrusion" })
    ).rejects.toThrow(/autorisé/i)
  })
})

describe("updateInteraction", () => {
  it("met à jour le canal et le résumé d'une interaction existante", async () => {
    const user   = await makeUser()
    const client = await makeClient(user.id)
    setTestUser(user.id)

    await addInteraction(client.id, { date: "2026-04-01", channel: "EMAIL", summary: "Initial" })
    const before = await prisma.interaction.findFirst({ where: { clientId: client.id } })

    await updateInteraction(before!.id, client.id, {
      date:    "2026-04-02",
      channel: "LINKEDIN",
      summary: "Mise à jour du résumé",
    })

    const after = await prisma.interaction.findUnique({ where: { id: before!.id } })
    expect(after?.channel).toBe("LINKEDIN")
    expect(after?.summary).toBe("Mise à jour du résumé")
    expect(after?.date.toISOString()).toBe("2026-04-02T00:00:00.000Z")
  })

  it("refuse la mise à jour si le client n'appartient pas à l'utilisateur", async () => {
    const owner    = await makeUser()
    const intruder = await makeUser()
    const client   = await makeClient(owner.id)

    setTestUser(owner.id)
    await addInteraction(client.id, { date: "2026-04-01", channel: "EMAIL", summary: "Propriétaire" })
    const interaction = await prisma.interaction.findFirst({ where: { clientId: client.id } })

    setTestUser(intruder.id)
    await expect(
      updateInteraction(interaction!.id, client.id, { date: "2026-04-01", channel: "EMAIL", summary: "Pirate" })
    ).rejects.toThrow(/autorisé/i)
  })
})

describe("deleteInteraction", () => {
  it("supprime l'interaction du client", async () => {
    const user   = await makeUser()
    const client = await makeClient(user.id)
    setTestUser(user.id)

    await addInteraction(client.id, { date: "2026-03-01", channel: "EMAIL", summary: "À supprimer" })
    const i = await prisma.interaction.findFirst({ where: { clientId: client.id } })

    await deleteInteraction(i!.id, client.id)

    const after = await prisma.interaction.findUnique({ where: { id: i!.id } })
    expect(after).toBeNull()
  })

  it("refuse la suppression si l'utilisateur n'est pas propriétaire du client", async () => {
    const owner    = await makeUser()
    const intruder = await makeUser()
    const client   = await makeClient(owner.id)

    setTestUser(owner.id)
    await addInteraction(client.id, { date: "2026-03-01", channel: "EMAIL", summary: "Mine" })
    const i = await prisma.interaction.findFirst({ where: { clientId: client.id } })

    setTestUser(intruder.id)
    await expect(deleteInteraction(i!.id, client.id)).rejects.toThrow(/autorisé/i)

    // Toujours en base
    const still = await prisma.interaction.findUnique({ where: { id: i!.id } })
    expect(still).not.toBeNull()
  })
})

// ── Reminders ─────────────────────────────────────────────────────────────────

describe("addReminder", () => {
  it("crée un rappel avec date d'échéance et note", async () => {
    const user   = await makeUser()
    const client = await makeClient(user.id)
    setTestUser(user.id)

    await addReminder(client.id, { dueDate: "2026-07-01", note: "Relancer pour devis" })

    const reminders = await prisma.reminder.findMany({ where: { clientId: client.id } })
    expect(reminders).toHaveLength(1)
    expect(reminders[0].isDone).toBe(false)
    expect(reminders[0].note).toBe("Relancer pour devis")
    expect(reminders[0].dueDate.toISOString()).toBe("2026-07-01T00:00:00.000Z")
  })

  it("refuse si le client appartient à un autre utilisateur", async () => {
    const owner    = await makeUser()
    const intruder = await makeUser()
    const client   = await makeClient(owner.id)
    setTestUser(intruder.id)

    await expect(
      addReminder(client.id, { dueDate: "2026-08-01" })
    ).rejects.toThrow(/autorisé/i)
  })
})

describe("toggleReminder", () => {
  it("marque un rappel comme fait (isDone true + doneAt)", async () => {
    const user   = await makeUser()
    const client = await makeClient(user.id)
    setTestUser(user.id)

    await addReminder(client.id, { dueDate: "2026-07-15" })
    const reminder = await prisma.reminder.findFirst({ where: { clientId: client.id } })

    await toggleReminder(reminder!.id, client.id, true)

    const after = await prisma.reminder.findUnique({ where: { id: reminder!.id } })
    expect(after?.isDone).toBe(true)
    expect(after?.doneAt).not.toBeNull()
  })

  it("re-ouvre un rappel (isDone false + doneAt null)", async () => {
    const user   = await makeUser()
    const client = await makeClient(user.id)
    setTestUser(user.id)

    await addReminder(client.id, { dueDate: "2026-07-15" })
    const reminder = await prisma.reminder.findFirst({ where: { clientId: client.id } })

    // Marque fait puis re-ouvre
    await toggleReminder(reminder!.id, client.id, true)
    await toggleReminder(reminder!.id, client.id, false)

    const after = await prisma.reminder.findUnique({ where: { id: reminder!.id } })
    expect(after?.isDone).toBe(false)
    expect(after?.doneAt).toBeNull()
  })
})

describe("deleteReminder", () => {
  it("supprime le rappel", async () => {
    const user   = await makeUser()
    const client = await makeClient(user.id)
    setTestUser(user.id)

    await addReminder(client.id, { dueDate: "2026-08-01", note: "À supprimer" })
    const reminder = await prisma.reminder.findFirst({ where: { clientId: client.id } })

    await deleteReminder(reminder!.id, client.id)

    const after = await prisma.reminder.findUnique({ where: { id: reminder!.id } })
    expect(after).toBeNull()
  })

  it("refuse la suppression si le client n'appartient pas à l'utilisateur", async () => {
    const owner    = await makeUser()
    const intruder = await makeUser()
    const client   = await makeClient(owner.id)

    setTestUser(owner.id)
    await addReminder(client.id, { dueDate: "2026-09-01" })
    const reminder = await prisma.reminder.findFirst({ where: { clientId: client.id } })

    setTestUser(intruder.id)
    await expect(deleteReminder(reminder!.id, client.id)).rejects.toThrow(/autorisé/i)

    const still = await prisma.reminder.findUnique({ where: { id: reminder!.id } })
    expect(still).not.toBeNull()
  })
})
