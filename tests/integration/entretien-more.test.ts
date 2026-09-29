import { describe, it, expect, vi } from "vitest"
import {
  createJobApplication,
  updateJobApplication,
  updateApplicationStatus,
  deleteJobApplication,
  updateApplicationNotes,
  toggleApplicationPriority,
  addApplicationEvent,
  completeNextAction,
  deleteApplicationEvent,
  cancelApplicationEvent,
  uncancelApplicationEvent,
  setEventOutcome,
  updateApplicationEvent,
  getInterviewAnswers,
  setAnswerApplications,
  createInterviewAnswer,
  updateInterviewAnswer,
  deleteInterviewAnswer,
  toggleInterviewAnswerPinned,
} from "@/actions/entretien"
import { prisma } from "@/lib/prisma"
import { zonedDateKey, isZonedAllDay } from "@/lib/dates"
import { setTestUser } from "./setup"
import { makeUser, makeClient, makeCompany, makeJobApplication } from "./helpers/factories"

// Aucune synchro Google réelle depuis les tests.
vi.mock("@/lib/google-task-sync", () => ({
  syncTaskGoogleState: vi.fn(async () => {}),
  syncJobApplicationGoogleState: vi.fn(async () => {}),
  removeJobApplicationFromGoogle: vi.fn(async () => {}),
}))

async function asNewUser() {
  const user = await makeUser()
  setTestUser(user.id)
  return user
}

const appOf = (id: string) => prisma.jobApplication.findUniqueOrThrow({ where: { id } })
const evOf = (id: string) => prisma.jobApplicationEvent.findUniqueOrThrow({ where: { id } })

describe("candidatures — société et champs", () => {
  it("société : réutilise l'id possédé, sinon le même nom (casse ignorée), sinon la crée ; id d'autrui ignoré", async () => {
    const user = await asNewUser()
    const owned = await makeCompany(user.id, { name: "Société Alpha" })
    const foreign = await makeCompany((await makeUser()).id, { name: "Société Privée" })

    const a = await createJobApplication({ companyName: "Libellé libre", companyId: owned.id, position: "Dev" })
    expect(a.companyId).toBe(owned.id)

    const b = await createJobApplication({ companyName: "  société alpha ", position: "Dev" })
    expect(b.companyId).toBe(owned.id)
    expect(b.companyName).toBe("société alpha")

    const c = await createJobApplication({ companyName: "Société Beta", companyId: foreign.id, position: "Dev" })
    expect(c.companyId).not.toBe(foreign.id)
    const created = await prisma.company.findUniqueOrThrow({ where: { id: c.companyId! } })
    expect(created).toMatchObject({ userId: user.id, name: "Société Beta" })
    expect(await prisma.company.count({ where: { userId: user.id } })).toBe(2)
  })

  it("tous les champs optionnels sont nettoyés (trim / vide → null) ; événement initial sans date = maintenant", async () => {
    await asNewUser()
    const before = Date.now()
    const app = await createJobApplication({
      companyName: "Société Gamma", position: "  Lead dev ", location: "  Ville ", workMode: " ", source: " Site ",
      url: "  https://exemple.test/offre ", salaryMin: 40000, salaryMax: 50000, salaryNote: "  brut ", notes: "",
      appliedAt: "2026-09-01T10:00:00Z", nextActionLabel: "  Relancer ", nextActionFormat: " VIDEO ",
      competencyDossierValidated: true, competencyDossierUrl: " https://exemple.test/dossier ",
      initialEvent: { type: "APPLICATION", title: "  Candidature ", notes: "  " },
    })
    expect(app).toMatchObject({
      position: "Lead dev", location: "Ville", workMode: null, source: "Site", url: "https://exemple.test/offre",
      salaryMin: 40000, salaryMax: 50000, salaryNote: "brut", notes: null, nextActionAt: null,
      nextActionLabel: "Relancer", nextActionFormat: "VIDEO", competencyDossierValidated: true,
      competencyDossierUrl: "https://exemple.test/dossier", closedAt: null,
    })
    expect(app.appliedAt!.toISOString()).toBe("2026-09-01T10:00:00.000Z")
    const ev = await prisma.jobApplicationEvent.findFirstOrThrow({ where: { applicationId: app.id } })
    expect(ev).toMatchObject({ title: "Candidature", notes: null, type: "APPLICATION" })
    expect(ev.date.getTime()).toBeGreaterThanOrEqual(before)

    // Titre d'événement initial vide → aucun événement.
    const other = await createJobApplication({
      companyName: "Société Gamma", position: "Dev", initialEvent: { type: "CALL", title: "   " },
    })
    expect(await prisma.jobApplicationEvent.count({ where: { applicationId: other.id } })).toBe(0)
  })

  // Régression corrigée le 29/09/2026 (src/actions/entretien.ts:55) — buildData recopie `contactId` tel quel :
  // contrairement aux événements (ownedContactId), une candidature peut être
  // rattachée au CONTACT D'UN AUTRE COMPTE (create comme update) — fiche
  // recruteur d'autrui ensuite affichée sur la candidature.
  it("une candidature n'accepte pas le contact d'un autre compte", async () => {
    const victimContact = await makeClient((await makeUser()).id, { name: "Recruteur privé" })
    await asNewUser()
    const app = await createJobApplication({ companyName: "Société", position: "Dev", contactId: victimContact.id })
    expect(app.contactId).toBeNull()
  })

  // Régression corrigée le 29/09/2026 (src/actions/entretien.ts:56-57) — dates saisies en `type="date"`
  // ("2026-10-05") parsées par `new Date()` → minuit UTC (02:00 à Paris) au lieu
  // de minuit Paris (parseCivilDate) : le prochain point n'est plus une journée
  // entière et s'affiche comme un créneau de nuit.
  it("le prochain point saisi en date seule est une journée entière (minuit Paris)", async () => {
    await asNewUser()
    const app = await createJobApplication({ companyName: "Société", position: "Dev", nextActionAt: "2026-10-05" })
    expect(zonedDateKey(app.nextActionAt!)).toBe("2026-10-05")
    expect(isZonedAllDay(app.nextActionAt!)).toBe(true)
  })
})

describe("updateJobApplication", () => {
  it("met à jour, pose closedAt au passage en clos, le conserve si l'on reste clos, l'efface à la réouverture", async () => {
    const user = await asNewUser()
    const app = await makeJobApplication(user.id, { companyName: "Société Delta" })

    await updateJobApplication(app.id, { companyName: "Société Delta", position: "Architecte", status: "REJECTED", notes: " refus " })
    const closed = await appOf(app.id)
    expect(closed).toMatchObject({ position: "Architecte", status: "REJECTED", notes: "refus" })
    expect(closed.closedAt).not.toBeNull()
    expect(closed.companyId).not.toBeNull()

    await prisma.jobApplication.update({ where: { id: app.id }, data: { closedAt: new Date("2026-01-01T12:00:00Z") } })
    await updateJobApplication(app.id, { companyName: "Société Delta", position: "Architecte", status: "GHOSTED" })
    expect((await appOf(app.id)).closedAt!.toISOString()).toBe("2026-01-01T12:00:00.000Z")

    await updateJobApplication(app.id, { companyName: "", position: "Architecte", status: "INTERVIEW" })
    const reopened = await appOf(app.id)
    expect(reopened).toMatchObject({ status: "INTERVIEW", closedAt: null, companyId: null })
  })

  it("candidature d'un autre compte : aucune modification (update, statut, notes, priorité, suppression)", async () => {
    const owner = await makeUser()
    const app = await makeJobApplication(owner.id, { companyName: "Société Privée", position: "Dev", priority: 0 })
    await asNewUser()

    await updateJobApplication(app.id, { companyName: "Société Privée", position: "pwn", status: "REJECTED" })
    await updateApplicationStatus(app.id, "ACCEPTED")
    await updateApplicationNotes(app.id, "pwn")
    await expect(toggleApplicationPriority(app.id)).rejects.toThrow(/Non autorisé/)
    await deleteJobApplication(app.id)

    expect(await appOf(app.id)).toMatchObject({ position: "Dev", status: "WISHLIST", notes: null, priority: 0, closedAt: null })
  })
})

describe("événements de candidature", () => {
  it("addApplicationEvent : contact possédé retenu, contact d'autrui ignoré ; notes nettoyées", async () => {
    const user = await asNewUser()
    const app = await makeJobApplication(user.id)
    const mine = await makeClient(user.id, { name: "Recruteuse Fictive" })
    const theirs = await makeClient((await makeUser()).id)

    await addApplicationEvent(app.id, { date: "2026-09-10T08:00:00Z", type: "CALL", title: "  Appel ", notes: " ok ", contactId: mine.id })
    await addApplicationEvent(app.id, { date: "2026-09-11T08:00:00Z", type: "EMAIL", title: "Mail", contactId: theirs.id })

    const evs = await prisma.jobApplicationEvent.findMany({ where: { applicationId: app.id }, orderBy: { date: "asc" } })
    expect(evs[0]).toMatchObject({ title: "Appel", notes: "ok", contactId: mine.id, type: "CALL" })
    expect(evs[1]).toMatchObject({ contactId: null, notes: null })
  })

  it("completeNextAction : historise le prochain point (contact principal par défaut) puis l'efface", async () => {
    const user = await asNewUser()
    const recruiter = await makeClient(user.id, { name: "Recruteur Fictif" })
    const app = await createJobApplication({
      companyName: "Société Epsilon", position: "Dev", contactId: recruiter.id,
      nextActionAt: "2026-10-01T14:00:00Z", nextActionLabel: "Entretien technique",
    })

    await completeNextAction(app.id, "TECHNICAL_TEST")
    const ev = await prisma.jobApplicationEvent.findFirstOrThrow({ where: { applicationId: app.id } })
    expect(ev).toMatchObject({ type: "TECHNICAL_TEST", title: "Entretien technique", contactId: recruiter.id })
    expect(ev.date.toISOString()).toBe("2026-10-01T14:00:00.000Z")
    expect(await appOf(app.id)).toMatchObject({ nextActionAt: null, nextActionLabel: null })

    await expect(completeNextAction(app.id)).rejects.toThrow(/Aucun prochain point/)

    // Libellé absent → « Rendez-vous », type OTHER, contact explicite prioritaire.
    const other = await makeClient(user.id, { name: "Autre contact" })
    await prisma.jobApplication.update({ where: { id: app.id }, data: { nextActionAt: new Date("2026-10-08T09:00:00Z") } })
    await completeNextAction(app.id, undefined, other.id)
    const ev2 = await prisma.jobApplicationEvent.findFirstOrThrow({ where: { applicationId: app.id, title: "Rendez-vous" } })
    expect(ev2).toMatchObject({ type: "OTHER", contactId: other.id })
  })

  it("completeNextAction refuse la candidature d'un autre compte", async () => {
    const owner = await makeUser()
    const app = await makeJobApplication(owner.id)
    await prisma.jobApplication.update({ where: { id: app.id }, data: { nextActionAt: new Date("2026-10-01T09:00:00Z") } })
    await asNewUser()
    await expect(completeNextAction(app.id)).rejects.toThrow(/Non autorisé/)
    expect((await appOf(app.id)).nextActionAt).not.toBeNull()
    expect(await prisma.jobApplicationEvent.count()).toBe(0)
  })

  it("updateApplicationEvent : mise à jour partielle (date, type, titre, notes, contact possédé) puis suppression", async () => {
    const user = await asNewUser()
    const app = await makeJobApplication(user.id)
    const mine = await makeClient(user.id)
    const theirs = await makeClient((await makeUser()).id)
    await addApplicationEvent(app.id, { date: "2026-09-10T08:00:00Z", type: "CALL", title: "Appel", notes: "n" })
    const ev = await prisma.jobApplicationEvent.findFirstOrThrow({ where: { applicationId: app.id } })

    await updateApplicationEvent(ev.id, { title: "  Visio ", type: "VIDEO", contactId: mine.id })
    expect(await evOf(ev.id)).toMatchObject({ title: "Visio", type: "VIDEO", notes: "n", contactId: mine.id })

    await updateApplicationEvent(ev.id, { date: "2026-09-12T09:30:00Z", notes: "  ", contactId: theirs.id })
    const saved = await evOf(ev.id)
    expect(saved).toMatchObject({ title: "Visio", notes: null, contactId: null })
    expect(saved.date.toISOString()).toBe("2026-09-12T09:30:00.000Z")

    await updateApplicationEvent(ev.id, { title: "" })
    expect((await evOf(ev.id)).title).toBe("")

    await deleteApplicationEvent(ev.id)
    expect(await prisma.jobApplicationEvent.count()).toBe(0)
  })

  it("événement d'un autre compte : annulation, compte rendu, modification refusés ; suppression sans effet", async () => {
    const owner = await asNewUser()
    const app = await makeJobApplication(owner.id)
    await addApplicationEvent(app.id, { date: "2026-09-10T08:00:00Z", type: "CALL", title: "Appel" })
    const ev = await prisma.jobApplicationEvent.findFirstOrThrow()

    await asNewUser()
    await expect(cancelApplicationEvent(ev.id)).rejects.toThrow(/Non autorisé/)
    await expect(uncancelApplicationEvent(ev.id)).rejects.toThrow(/Non autorisé/)
    await expect(setEventOutcome(ev.id, "pwn")).rejects.toThrow(/Non autorisé/)
    await expect(updateApplicationEvent(ev.id, { title: "pwn" })).rejects.toThrow(/Non autorisé/)
    await deleteApplicationEvent(ev.id)

    expect(await evOf(ev.id)).toMatchObject({ title: "Appel", outcome: null, cancelledAt: null })
  })

  it("setEventOutcome : un compte rendu vide efface, et lève une annulation", async () => {
    const user = await asNewUser()
    const app = await makeJobApplication(user.id)
    await addApplicationEvent(app.id, { date: "2026-09-10T08:00:00Z", type: "CALL", title: "Appel" })
    const ev = await prisma.jobApplicationEvent.findFirstOrThrow()
    await cancelApplicationEvent(ev.id)
    await setEventOutcome(ev.id, "   ")
    expect(await evOf(ev.id)).toMatchObject({ outcome: null, cancelledAt: null })
  })
})

describe("FAQ d'entretien", () => {
  it("création validée, liste ordonnée (épinglées d'abord), mise à jour, épinglage, suppression", async () => {
    const user = await asNewUser()
    await expect(createInterviewAnswer({ question: " ", answer: "x" })).rejects.toThrow(/question est requise/)
    await expect(createInterviewAnswer({ question: "x", answer: " " })).rejects.toThrow(/réponse est requise/)

    const a = await createInterviewAnswer({ question: "  Parlez-moi de vous ", answer: " Réponse A ", category: "  " })
    const b = await createInterviewAnswer({ question: "Pourquoi nous ?", answer: "Réponse B", category: " Motivation " })
    expect(await prisma.interviewAnswer.findUniqueOrThrow({ where: { id: a } })).toMatchObject({
      userId: user.id, question: "Parlez-moi de vous", answer: "Réponse A", category: null,
    })

    await toggleInterviewAnswerPinned(b)
    let list = await getInterviewAnswers()
    expect(list.map((x) => x.id)).toEqual([b, a])
    expect(list[0]).toMatchObject({ pinned: true, category: "Motivation", applications: [] })

    await toggleInterviewAnswerPinned(b)
    expect((await prisma.interviewAnswer.findUniqueOrThrow({ where: { id: b } })).pinned).toBe(false)

    await updateInterviewAnswer(a, { question: " Q ", answer: " R ", category: " Cat " })
    expect(await prisma.interviewAnswer.findUniqueOrThrow({ where: { id: a } })).toMatchObject({ question: "Q", answer: "R", category: "Cat" })

    await deleteInterviewAnswer(a)
    list = await getInterviewAnswers()
    expect(list.map((x) => x.id)).toEqual([b])
  })

  it("setAnswerApplications ne relie que ses propres candidatures, et remplace l'ensemble", async () => {
    const user = await asNewUser()
    const mine1 = await makeJobApplication(user.id, { companyName: "Société 1" })
    const mine2 = await makeJobApplication(user.id, { companyName: "Société 2" })
    const theirs = await makeJobApplication((await makeUser()).id)
    const a = await createInterviewAnswer({ question: "Q", answer: "R" })

    await setAnswerApplications(a, [mine1.id, theirs.id])
    let [ans] = await getInterviewAnswers()
    expect(ans.applications.map((x) => x.id)).toEqual([mine1.id])

    await setAnswerApplications(a, [mine2.id])
    ;[ans] = await getInterviewAnswers()
    expect(ans.applications.map((x) => x.id)).toEqual([mine2.id])
  })

  it("réponse d'un autre compte : invisible, non modifiable, non épinglable, non supprimable", async () => {
    await asNewUser()
    const a = await createInterviewAnswer({ question: "Q privée", answer: "R privée" })

    const intruder = await asNewUser()
    const app = await makeJobApplication(intruder.id)
    expect(await getInterviewAnswers()).toEqual([])
    await expect(updateInterviewAnswer(a, { question: "pwn", answer: "pwn" })).rejects.toThrow(/Non autorisé/)
    await expect(toggleInterviewAnswerPinned(a)).rejects.toThrow(/Non autorisé/)
    await expect(setAnswerApplications(a, [app.id])).rejects.toThrow(/Non autorisé/)
    await deleteInterviewAnswer(a)

    const saved = await prisma.interviewAnswer.findUniqueOrThrow({ where: { id: a }, include: { applications: true } })
    expect(saved).toMatchObject({ question: "Q privée", pinned: false, applications: [] })
  })
})
