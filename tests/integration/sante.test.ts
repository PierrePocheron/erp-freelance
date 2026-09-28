import { describe, it, expect } from "vitest"
import {
  createHealthEvent, resolveHealthEvent, deleteHealthEvent,
  createConsultation, deleteConsultation,
  createReimbursement, markReimbursementReceived, updateReimbursement,
} from "@/actions/sante"
import { prisma } from "@/lib/prisma"
import { setTestUser } from "./setup"
import { makeUser } from "./helpers/factories"

// Module Santé : consultations, coûts et remboursements mutuelle/sécu. Aucun
// test jusqu'ici, et les rattachements (consultation → événement, remboursement
// → consultation) acceptaient un id d'un autre compte.

async function consultation(userId: string, over: Partial<{ cost: number; healthEventId: string }> = {}) {
  setTestUser(userId)
  await createConsultation({
    date: "2026-09-27",
    practitionerName: "Dr Test",
    practitionerType: "OSTEOPATH",
    title: "Séance",
    cost: over.cost ?? 63,
    healthEventId: over.healthEventId ?? null,
  })
  return prisma.healthConsultation.findFirstOrThrow({ where: { userId }, orderBy: { createdAt: "desc" } })
}

describe("module santé", () => {
  it("crée une consultation avec son coût et la rattache à un événement", async () => {
    const user = await makeUser()
    setTestUser(user.id)
    await createHealthEvent({ date: "2026-09-01", type: "INJURY", title: "Dos bloqué" })
    const event = await prisma.healthEvent.findFirstOrThrow({ where: { userId: user.id } })

    const c = await consultation(user.id, { healthEventId: event.id })

    expect(c.cost).toBe(63)
    expect(c.practitionerName).toBe("Dr Test")
    expect(c.healthEventId).toBe(event.id)
  })

  it("suit un remboursement de PENDING à RECEIVED", async () => {
    const user = await makeUser()
    const c = await consultation(user.id)

    await createReimbursement({
      amount: 45, source: "MUTUELLE", status: "PENDING",
      expectedDate: "2026-10-15", consultationId: c.id,
    })
    const pending = await prisma.healthReimbursement.findFirstOrThrow({ where: { userId: user.id } })
    expect([pending.status, pending.amount, pending.receivedAt]).toEqual(["PENDING", 45, null])

    await markReimbursementReceived(pending.id, "2026-10-12")
    const received = await prisma.healthReimbursement.findUniqueOrThrow({ where: { id: pending.id } })
    expect(received.status).toBe("RECEIVED")
    expect(received.receivedAt).not.toBeNull()
  })

  it("marque un événement comme résolu, puis le supprime avec ses consultations", async () => {
    const user = await makeUser()
    setTestUser(user.id)
    await createHealthEvent({ date: "2026-09-01", type: "ILLNESS", title: "Angine" })
    const event = await prisma.healthEvent.findFirstOrThrow({ where: { userId: user.id } })
    await consultation(user.id, { healthEventId: event.id })

    await resolveHealthEvent(event.id, "2026-09-20")
    expect((await prisma.healthEvent.findUniqueOrThrow({ where: { id: event.id } })).resolvedAt).not.toBeNull()

    await deleteHealthEvent(event.id)
    expect(await prisma.healthEvent.count({ where: { id: event.id } })).toBe(0)
  })

  it("refuse de rattacher une consultation à l'événement d'un autre compte", async () => {
    const victim = await makeUser()
    setTestUser(victim.id)
    await createHealthEvent({ date: "2026-09-01", type: "INJURY", title: "Privé" })
    const victimEvent = await prisma.healthEvent.findFirstOrThrow({ where: { userId: victim.id } })

    const intruder = await makeUser()
    setTestUser(intruder.id)
    await expect(
      createConsultation({
        date: "2026-09-27", practitionerName: "X", practitionerType: "OTHER",
        title: "T", healthEventId: victimEvent.id,
      }),
    ).rejects.toThrow(/introuvable/i)
    expect(await prisma.healthConsultation.count({ where: { userId: intruder.id } })).toBe(0)
  })

  it("refuse de rattacher un remboursement à la consultation d'un autre compte", async () => {
    const victim = await makeUser()
    const victimConsult = await consultation(victim.id)

    const intruder = await makeUser()
    setTestUser(intruder.id)
    await expect(
      createReimbursement({ amount: 10, source: "SECU", status: "PENDING", consultationId: victimConsult.id }),
    ).rejects.toThrow(/introuvable/i)
    expect(await prisma.healthReimbursement.count({ where: { userId: intruder.id } })).toBe(0)
  })

  it("ne touche ni la consultation ni le remboursement d'un autre compte", async () => {
    const victim = await makeUser()
    const victimConsult = await consultation(victim.id)
    setTestUser(victim.id)
    await createReimbursement({ amount: 50, source: "MUTUELLE", status: "PENDING", consultationId: victimConsult.id })
    const victimReimb = await prisma.healthReimbursement.findFirstOrThrow({ where: { userId: victim.id } })

    const intruder = await makeUser()
    setTestUser(intruder.id)
    await deleteConsultation(victimConsult.id)
    await markReimbursementReceived(victimReimb.id, "2026-10-01")
    await updateReimbursement(victimReimb.id, { amount: 9999, source: "SECU", status: "RECEIVED" })

    expect(await prisma.healthConsultation.count({ where: { id: victimConsult.id } })).toBe(1)
    const after = await prisma.healthReimbursement.findUniqueOrThrow({ where: { id: victimReimb.id } })
    expect([after.status, after.amount]).toEqual(["PENDING", 50])
  })
})
