import { describe, it, expect } from "vitest"
import {
  createJobApplication,
  updateApplicationStatus,
  updateApplicationNotes,
  toggleApplicationPriority,
  addApplicationEvent,
  cancelApplicationEvent,
  uncancelApplicationEvent,
  setEventOutcome,
  deleteJobApplication,
} from "@/actions/entretien"
import { prisma } from "@/lib/prisma"
import { setTestUser } from "./setup"
import { makeUser, makeJobApplication } from "./helpers/factories"

// ── Candidatures ──────────────────────────────────────────────────────────────

describe("createJobApplication", () => {
  it("crée une candidature en WISHLIST par défaut", async () => {
    const user = await makeUser()
    setTestUser(user.id)

    const app = await createJobApplication({ companyName: "Sogeti", position: "Dev Java" })

    expect(app.status).toBe("WISHLIST")
    expect(app.companyName).toBe("Sogeti")
    expect(app.position).toBe("Dev Java")
    expect(app.closedAt).toBeNull()
  })

  it("définit closedAt quand le statut initial est clos", async () => {
    const user = await makeUser()
    setTestUser(user.id)

    const app = await createJobApplication({
      companyName: "ACME",
      position: "Dev",
      status: "REJECTED",
    })

    expect(app.closedAt).not.toBeNull()
  })

  it("crée un événement initial si fourni", async () => {
    const user = await makeUser()
    setTestUser(user.id)

    const app = await createJobApplication({
      companyName: "Société X",
      position: "CTO",
      initialEvent: { type: "APPLICATION", title: "Envoi CV" },
    })

    const events = await prisma.jobApplicationEvent.findMany({ where: { applicationId: app.id } })
    expect(events).toHaveLength(1)
    expect(events[0].title).toBe("Envoi CV")
    expect(events[0].type).toBe("APPLICATION")
  })

  it("refuse si companyName vide", async () => {
    const user = await makeUser()
    setTestUser(user.id)
    await expect(createJobApplication({ companyName: "  ", position: "Dev" })).rejects.toThrow(/société/i)
  })

  it("refuse si position vide", async () => {
    const user = await makeUser()
    setTestUser(user.id)
    await expect(createJobApplication({ companyName: "X", position: "  " })).rejects.toThrow(/poste/i)
  })
})

describe("updateApplicationStatus", () => {
  it("change le statut et pose closedAt si statut clos", async () => {
    const user = await makeUser()
    setTestUser(user.id)
    const app = await makeJobApplication(user.id, { status: "INTERVIEW" })

    await updateApplicationStatus(app.id, "REJECTED")

    const after = await prisma.jobApplication.findUnique({ where: { id: app.id } })
    expect(after?.status).toBe("REJECTED")
    expect(after?.closedAt).not.toBeNull()
  })

  it("efface closedAt si on revient sur un statut actif", async () => {
    const user = await makeUser()
    setTestUser(user.id)
    const app = await makeJobApplication(user.id, { status: "REJECTED" })

    await updateApplicationStatus(app.id, "INTERVIEW")

    const after = await prisma.jobApplication.findUnique({ where: { id: app.id } })
    expect(after?.status).toBe("INTERVIEW")
    expect(after?.closedAt).toBeNull()
  })

  it("préserve closedAt initial quand on reste sur un statut clos", async () => {
    const user = await makeUser()
    setTestUser(user.id)
    const app = await makeJobApplication(user.id, { status: "REJECTED" })
    // Forcer une closedAt existante
    await prisma.jobApplication.update({ where: { id: app.id }, data: { closedAt: new Date("2026-01-01") } })

    await updateApplicationStatus(app.id, "WITHDRAWN")

    const after = await prisma.jobApplication.findUnique({ where: { id: app.id } })
    // closedAt ne doit PAS être écrasé (c'est la date initiale de clôture)
    expect(after?.closedAt?.toISOString().startsWith("2026-01-01")).toBe(true)
  })
})

describe("updateApplicationNotes", () => {
  it("met à jour les notes", async () => {
    const user = await makeUser()
    setTestUser(user.id)
    const app = await makeJobApplication(user.id)

    await updateApplicationNotes(app.id, "Notes importantes")

    const after = await prisma.jobApplication.findUnique({ where: { id: app.id } })
    expect(after?.notes).toBe("Notes importantes")
  })

  it("sauvegarde null si notes vides", async () => {
    const user = await makeUser()
    setTestUser(user.id)
    const app = await makeJobApplication(user.id)

    await updateApplicationNotes(app.id, "   ")

    const after = await prisma.jobApplication.findUnique({ where: { id: app.id } })
    expect(after?.notes).toBeNull()
  })
})

describe("toggleApplicationPriority", () => {
  it("passe priority de 0 à 1", async () => {
    const user = await makeUser()
    setTestUser(user.id)
    const app = await makeJobApplication(user.id, { priority: 0 })

    await toggleApplicationPriority(app.id)

    const after = await prisma.jobApplication.findUnique({ where: { id: app.id } })
    expect(after?.priority).toBe(1)
  })

  it("repasse priority de 1 à 0", async () => {
    const user = await makeUser()
    setTestUser(user.id)
    const app = await makeJobApplication(user.id, { priority: 1 })

    await toggleApplicationPriority(app.id)

    const after = await prisma.jobApplication.findUnique({ where: { id: app.id } })
    expect(after?.priority).toBe(0)
  })
})

describe("deleteJobApplication", () => {
  it("supprime la candidature et ses événements en cascade", async () => {
    const user = await makeUser()
    setTestUser(user.id)
    const app = await makeJobApplication(user.id)
    await prisma.jobApplicationEvent.create({
      data: { userId: user.id, applicationId: app.id, date: new Date(), type: "CALL", title: "Appel" },
    })

    await deleteJobApplication(app.id)

    const after = await prisma.jobApplication.findUnique({ where: { id: app.id } })
    expect(after).toBeNull()
    const events = await prisma.jobApplicationEvent.findMany({ where: { applicationId: app.id } })
    expect(events).toHaveLength(0)
  })
})

// ── Événements ────────────────────────────────────────────────────────────────

describe("addApplicationEvent", () => {
  it("crée un événement attaché à la candidature", async () => {
    const user = await makeUser()
    setTestUser(user.id)
    const app = await makeJobApplication(user.id)

    await addApplicationEvent(app.id, {
      date: "2026-07-01T10:00",
      type: "VIDEO",
      title: "Entretien technique",
      notes: "Prépa algo",
    })

    const events = await prisma.jobApplicationEvent.findMany({ where: { applicationId: app.id } })
    expect(events).toHaveLength(1)
    expect(events[0].type).toBe("VIDEO")
    expect(events[0].title).toBe("Entretien technique")
    expect(events[0].notes).toBe("Prépa algo")
  })

  it("refuse si la candidature appartient à un autre utilisateur", async () => {
    const owner = await makeUser()
    const other = await makeUser()
    const app = await makeJobApplication(owner.id)
    setTestUser(other.id)

    await expect(addApplicationEvent(app.id, { date: "2026-07-01", type: "CALL", title: "x" }))
      .rejects.toThrow(/autorisé/i)
  })
})

describe("cancelApplicationEvent / uncancelApplicationEvent", () => {
  it("pose et efface cancelledAt sur un événement", async () => {
    const user = await makeUser()
    setTestUser(user.id)
    const app = await makeJobApplication(user.id)
    const ev = await prisma.jobApplicationEvent.create({
      data: { userId: user.id, applicationId: app.id, date: new Date(), type: "CALL", title: "Appel init" },
    })

    await cancelApplicationEvent(ev.id)
    const cancelled = await prisma.jobApplicationEvent.findUnique({ where: { id: ev.id } })
    expect(cancelled?.cancelledAt).not.toBeNull()

    await uncancelApplicationEvent(ev.id)
    const restored = await prisma.jobApplicationEvent.findUnique({ where: { id: ev.id } })
    expect(restored?.cancelledAt).toBeNull()
  })
})

describe("setEventOutcome", () => {
  it("enregistre le compte rendu d'un événement", async () => {
    const user = await makeUser()
    setTestUser(user.id)
    const app = await makeJobApplication(user.id)
    const ev = await prisma.jobApplicationEvent.create({
      data: { userId: user.id, applicationId: app.id, date: new Date(), type: "VIDEO", title: "Visio" },
    })

    await setEventOutcome(ev.id, "Bon échange, relance dans 2 semaines.")

    const after = await prisma.jobApplicationEvent.findUnique({ where: { id: ev.id } })
    expect(after?.outcome).toBe("Bon échange, relance dans 2 semaines.")
  })
})
