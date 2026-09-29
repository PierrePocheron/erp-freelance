import { describe, it, expect } from "vitest"
import {
  createProjectIdea, updateProjectIdea, deleteProjectIdea, convertIdeaToProject,
  createProject, updateProjectJobApplication, updateProjectCompany,
  addProjectContact, removeProjectContact, updateProjectContact,
  updateProjectStatus, updateProjectPriority, deleteProject, updateProjectInfo, updateProjectDates,
  createTask, completeTaskGlobal, startTask, completeTask, reopenTask, cancelTask, uncancelTask,
  updateTaskTitle, updateTaskDescription, updateTaskEstimatedHours, updateTaskDueDate,
  updateTaskCompletedAt, updateTaskPriority, updateTaskImportance, updateTaskFields, deleteTask,
  createTaskTag, deleteTaskTag, updateTaskTagColor, addTagToTask, removeTagFromTask,
  migrateGroupsToTags, reorderTasks, reorderTask,
  createMilestone, updateMilestone, deleteMilestone, updateMilestoneStatus,
  createUsefulLink, updateUsefulLink, deleteUsefulLink,
  createProjectEvent, updateProjectEvent, deleteProjectEvent,
  createJournalEntry, updateJournalEntry, deleteJournalEntry,
  createDeliverable, updateDeliverableStatus,
  addProjectMember, removeProjectMember, updateProjectMemberRole,
} from "@/actions/projet"
import { prisma } from "@/lib/prisma"
import { parseCivilDate, zonedDateKey } from "@/lib/dates"
import { setTestUser } from "./setup"
import { makeUser, makeClient, makeCompany, makeProject, makeJobApplication } from "./helpers/factories"

// Actions du module Projets (hors catégorie / createClientTask, déjà couverts par
// projet.test.ts). Chaque action qui reçoit un id est aussi testée côté anti-IDOR :
// un autre utilisateur ne peut ni lire ni modifier la donnée — elle reste intacte.

/** Propriétaire connecté + un contact + un projet. */
async function owner() {
  const user = await makeUser()
  const client = await makeClient(user.id)
  const project = await makeProject(user.id, client.id)
  setTestUser(user.id)
  return { user, client, project }
}

/** Bascule la session sur un nouvel utilisateur (l'intrus). */
async function asIntruder() {
  const intruder = await makeUser()
  setTestUser(intruder.id)
  return intruder
}

function task(userId: string, projectId: string | null, data: Record<string, unknown> = {}) {
  return prisma.task.create({ data: { userId, projectId, title: "Tâche", ...data } })
}

function fd(entries: Record<string, string>) {
  const f = new FormData()
  for (const [k, v] of Object.entries(entries)) f.set(k, v)
  return f
}

// ── Idées ────────────────────────────────────────────────────────────────────

describe("idées de projet", () => {
  it("crée une idée pour l'utilisateur de session (l'argument userId est ignoré)", async () => {
    const { user } = await owner()
    const idea = await createProjectIdea("autre-id", "Appli de covoiturage")
    const row = await prisma.projectIdea.findUniqueOrThrow({ where: { id: idea.id } })
    expect(row.userId).toBe(user.id)
    expect(row.title).toBe("Appli de covoiturage")
    expect(row.content).toBe("")
  })

  it("met à jour puis supprime une idée", async () => {
    const { user } = await owner()
    const idea = await prisma.projectIdea.create({ data: { userId: user.id, title: "A" } })

    await updateProjectIdea(idea.id, "ignored", { title: "B", content: "détails" })
    const row = await prisma.projectIdea.findUniqueOrThrow({ where: { id: idea.id } })
    expect(row.title).toBe("B")
    expect(row.content).toBe("détails")

    await deleteProjectIdea(idea.id, "ignored")
    expect(await prisma.projectIdea.count()).toBe(0)
  })

  it("un autre utilisateur ne peut ni modifier ni supprimer l'idée (anti-IDOR)", async () => {
    const { user } = await owner()
    const idea = await prisma.projectIdea.create({ data: { userId: user.id, title: "Secret" } })
    await asIntruder()

    await expect(updateProjectIdea(idea.id, user.id, { title: "Piraté" })).rejects.toThrow()
    await expect(deleteProjectIdea(idea.id, user.id)).rejects.toThrow()

    const row = await prisma.projectIdea.findUniqueOrThrow({ where: { id: idea.id } })
    expect(row.title).toBe("Secret")
  })
})

describe("convertIdeaToProject", () => {
  it("crée un projet à partir de l'idée (description tronquée à 300) et supprime l'idée", async () => {
    const { user } = await owner()
    const company = await makeCompany(user.id)
    const idea = await prisma.projectIdea.create({
      data: { userId: user.id, title: "SaaS compta", content: "x".repeat(500) },
    })

    const project = await convertIdeaToProject(idea.id, "ignored", company.id, true)

    const row = await prisma.project.findUniqueOrThrow({ where: { id: project.id } })
    expect(row.userId).toBe(user.id)
    expect(row.name).toBe("SaaS compta")
    expect(row.companyId).toBe(company.id)
    expect(row.description).toHaveLength(300)
    expect(await prisma.projectIdea.count()).toBe(0)
  })

  it("conserve l'idée si deleteIdea=false ; contenu vide → description null", async () => {
    const { user } = await owner()
    const idea = await prisma.projectIdea.create({ data: { userId: user.id, title: "Blog" } })

    const project = await convertIdeaToProject(idea.id, "ignored", null, false)

    const row = await prisma.project.findUniqueOrThrow({ where: { id: project.id } })
    expect(row.description).toBeNull()
    expect(row.companyId).toBeNull()
    expect(await prisma.projectIdea.count()).toBe(1)
  })

  it("refuse l'idée d'un autre utilisateur (anti-IDOR)", async () => {
    const { user } = await owner()
    const idea = await prisma.projectIdea.create({ data: { userId: user.id, title: "Secret" } })
    const before = await prisma.project.count()
    await asIntruder()

    await expect(convertIdeaToProject(idea.id, user.id, null, true)).rejects.toThrow(/introuvable/i)
    expect(await prisma.project.count()).toBe(before)
    expect(await prisma.projectIdea.count()).toBe(1)
  })

  // Régression corrigée le 29/09/2026 (src/actions/projet.ts:54) : companyId n'est pas vérifié → un projet de
  // l'intrus peut être rattaché à la société d'un autre utilisateur.
  it("n'accepte pas la société d'un autre utilisateur", async () => {
    const { user } = await owner()
    const victimCompany = await makeCompany(user.id)
    const intruder = await asIntruder()
    const idea = await prisma.projectIdea.create({ data: { userId: intruder.id, title: "Mon idée" } })

    const project = await convertIdeaToProject(idea.id, intruder.id, victimCompany.id, false).catch(() => null)
    if (project) {
      const row = await prisma.project.findUniqueOrThrow({ where: { id: project.id } })
      expect(row.companyId).toBeNull()
    }
  })
})

// ── Projets ──────────────────────────────────────────────────────────────────

describe("createProject (champs complémentaires)", () => {
  it("contact → clientId + lien CLIENT ; entretien, dates et heures estimées persistés", async () => {
    const user = await makeUser()
    const contact = await makeClient(user.id)
    const company = await makeCompany(user.id)
    const app = await makeJobApplication(user.id)
    setTestUser(user.id)

    const project = await createProject("ignored", fd({
      name: "Challenge technique",
      description: "Exercice",
      contactId: contact.id,
      companyId: company.id,
      jobApplicationId: app.id,
      startDate: "2026-09-01",
      endDate: "2026-09-30",
      estimatedHours: "12.5",
    }))

    const row = await prisma.project.findUniqueOrThrow({
      where: { id: project.id },
      include: { contactLinks: true },
    })
    expect(row.clientId).toBe(contact.id)
    expect(row.companyId).toBe(company.id)
    expect(row.jobApplicationId).toBe(app.id)
    expect(row.description).toBe("Exercice")
    expect(row.estimatedHours).toBe(12.5)
    expect(zonedDateKey(row.startDate!)).toBe("2026-09-01")
    expect(zonedDateKey(row.endDate!)).toBe("2026-09-30")
    expect(row.contactLinks).toHaveLength(1)
    expect(row.contactLinks[0]).toMatchObject({ clientId: contact.id, role: "CLIENT" })
  })

  it("ignore l'entretien d'un autre utilisateur (anti-IDOR)", async () => {
    const victim = await makeUser()
    const app = await makeJobApplication(victim.id)
    await asIntruder()

    const project = await createProject("ignored", fd({ name: "Projet", jobApplicationId: app.id }))
    const row = await prisma.project.findUniqueOrThrow({ where: { id: project.id } })
    expect(row.jobApplicationId).toBeNull()
  })

  it("refuse un nom vide (validation zod)", async () => {
    await owner()
    const before = await prisma.project.count()
    await expect(createProject("ignored", fd({ name: "" }))).rejects.toThrow()
    expect(await prisma.project.count()).toBe(before)
  })

  // Régression corrigée le 29/09/2026 (src/actions/projet.ts:95, 98, 107) : companyId et contactId ne sont pas
  // vérifiés (contrairement à jobApplicationId) → l'intrus rattache son projet à
  // la société ET au contact d'un autre utilisateur, et crée un ProjectContact
  // pointant vers ce contact (dont les données s'affichent ensuite sur sa fiche projet).
  it("n'accepte ni la société ni le contact d'un autre utilisateur", async () => {
    const victim = await makeUser()
    const victimContact = await makeClient(victim.id)
    const victimCompany = await makeCompany(victim.id)
    await asIntruder()

    const project = await createProject("ignored", fd({
      name: "Projet", contactId: victimContact.id, companyId: victimCompany.id,
    })).catch(() => null)

    if (project) {
      const row = await prisma.project.findUniqueOrThrow({ where: { id: project.id } })
      expect(row.clientId).toBeNull()
      expect(row.companyId).toBeNull()
    }
    expect(await prisma.projectContact.count({ where: { clientId: victimContact.id } })).toBe(0)
  })
})

describe("updateProjectJobApplication", () => {
  it("rattache puis détache un entretien", async () => {
    const { user, project } = await owner()
    const app = await makeJobApplication(user.id)

    await updateProjectJobApplication(project.id, app.id)
    expect((await prisma.project.findUniqueOrThrow({ where: { id: project.id } })).jobApplicationId).toBe(app.id)

    await updateProjectJobApplication(project.id, null)
    expect((await prisma.project.findUniqueOrThrow({ where: { id: project.id } })).jobApplicationId).toBeNull()
  })

  it("refuse l'entretien d'un autre utilisateur", async () => {
    const { project } = await owner()
    const other = await makeUser()
    const foreignApp = await makeJobApplication(other.id)

    await expect(updateProjectJobApplication(project.id, foreignApp.id)).rejects.toThrow(/Entretien introuvable/)
    expect((await prisma.project.findUniqueOrThrow({ where: { id: project.id } })).jobApplicationId).toBeNull()
  })

  it("refuse le projet d'un autre utilisateur (anti-IDOR)", async () => {
    const { project } = await owner()
    const intruder = await asIntruder()
    const app = await makeJobApplication(intruder.id)

    await expect(updateProjectJobApplication(project.id, app.id)).rejects.toThrow()
    expect((await prisma.project.findUniqueOrThrow({ where: { id: project.id } })).jobApplicationId).toBeNull()
  })
})

describe("updateProjectCompany", () => {
  it("rattache puis détache une société", async () => {
    const { user, project } = await owner()
    const company = await makeCompany(user.id)

    await updateProjectCompany(project.id, company.id)
    expect((await prisma.project.findUniqueOrThrow({ where: { id: project.id } })).companyId).toBe(company.id)

    await updateProjectCompany(project.id, null)
    expect((await prisma.project.findUniqueOrThrow({ where: { id: project.id } })).companyId).toBeNull()
  })

  it("refuse la société d'un autre utilisateur", async () => {
    const { project } = await owner()
    const other = await makeUser()
    const foreign = await makeCompany(other.id)

    await expect(updateProjectCompany(project.id, foreign.id)).rejects.toThrow(/Société introuvable/)
    expect((await prisma.project.findUniqueOrThrow({ where: { id: project.id } })).companyId).toBeNull()
  })

  it("refuse le projet d'un autre utilisateur (anti-IDOR)", async () => {
    const { project } = await owner()
    const intruder = await asIntruder()
    const company = await makeCompany(intruder.id)

    await expect(updateProjectCompany(project.id, company.id)).rejects.toThrow()
    expect((await prisma.project.findUniqueOrThrow({ where: { id: project.id } })).companyId).toBeNull()
  })
})

// ── Contacts du projet ───────────────────────────────────────────────────────

describe("contacts du projet", () => {
  it("ajoute un contact (rôle + label) puis met à jour le lien existant (upsert)", async () => {
    const { user, project } = await owner()
    const dev = await makeClient(user.id, { name: "Lead dev" })

    await addProjectContact(project.id, dev.id, "COLLEAGUE", "Lead dev")
    await addProjectContact(project.id, dev.id, "PARTNER", "")

    const links = await prisma.projectContact.findMany({ where: { projectId: project.id } })
    expect(links).toHaveLength(1)
    expect(links[0]).toMatchObject({ clientId: dev.id, role: "PARTNER", label: null })
  })

  it("rôle par défaut : OTHER", async () => {
    const { user, project } = await owner()
    const c = await makeClient(user.id)
    await addProjectContact(project.id, c.id)
    const link = await prisma.projectContact.findFirstOrThrow({ where: { projectId: project.id } })
    expect(link.role).toBe("OTHER")
  })

  it("refuse le contact d'un autre utilisateur", async () => {
    const { project } = await owner()
    const other = await makeUser()
    const foreign = await makeClient(other.id)

    await expect(addProjectContact(project.id, foreign.id, "CLIENT")).rejects.toThrow(/Contact introuvable/)
    expect(await prisma.projectContact.count()).toBe(0)
  })

  it("un intrus ne peut ni ajouter ni retirer de contact sur le projet d'autrui (anti-IDOR)", async () => {
    const { client, project } = await owner()
    await prisma.projectContact.create({ data: { projectId: project.id, clientId: client.id, role: "CLIENT" } })
    const intruder = await asIntruder()
    const mine = await makeClient(intruder.id)

    await expect(addProjectContact(project.id, mine.id, "OTHER")).rejects.toThrow()
    await expect(removeProjectContact(project.id, client.id)).rejects.toThrow()
    await expect(updateProjectContact(project.id, null)).rejects.toThrow()

    const links = await prisma.projectContact.findMany({ where: { projectId: project.id } })
    expect(links).toHaveLength(1)
    expect(links[0].clientId).toBe(client.id)
  })

  it("retire un contact du projet", async () => {
    const { client, project } = await owner()
    await prisma.projectContact.create({ data: { projectId: project.id, clientId: client.id } })

    await removeProjectContact(project.id, client.id)
    expect(await prisma.projectContact.count()).toBe(0)
  })

  it("updateProjectContact (déprécié) : ajoute en CLIENT, et null retire seulement les CLIENT", async () => {
    const { user, client, project } = await owner()
    const partner = await makeClient(user.id, { name: "Partenaire" })
    await prisma.projectContact.create({ data: { projectId: project.id, clientId: partner.id, role: "PARTNER" } })

    await updateProjectContact(project.id, client.id)
    expect(await prisma.projectContact.count({ where: { projectId: project.id, role: "CLIENT" } })).toBe(1)

    await updateProjectContact(project.id, null)
    const left = await prisma.projectContact.findMany({ where: { projectId: project.id } })
    expect(left.map((l) => l.clientId)).toEqual([partner.id])
  })
})

// ── Champs du projet ─────────────────────────────────────────────────────────

describe("champs du projet", () => {
  it("statut, priorité, infos et dates sont mis à jour", async () => {
    const { project } = await owner()

    await updateProjectStatus(project.id, "PAUSED")
    await updateProjectPriority(project.id, "URGENT")
    await updateProjectInfo(project.id, { name: "Refonte", description: null, estimatedHours: 40 })
    await updateProjectDates(project.id, { startDate: "2026-10-01", endDate: "2026-12-15", estimatedHours: 35 })

    const row = await prisma.project.findUniqueOrThrow({ where: { id: project.id } })
    expect(row.status).toBe("PAUSED")
    expect(row.priority).toBe("URGENT")
    expect(row.name).toBe("Refonte")
    expect(row.description).toBeNull()
    expect(row.estimatedHours).toBe(35)
    expect(zonedDateKey(row.startDate!)).toBe("2026-10-01")
    expect(zonedDateKey(row.endDate!)).toBe("2026-12-15")
  })

  it("updateProjectDates : un champ absent n'écrase pas la valeur existante", async () => {
    const { project } = await owner()
    await updateProjectDates(project.id, { startDate: "2026-10-01", endDate: "2026-12-15" })
    await updateProjectDates(project.id, { endDate: "2027-01-31" })

    const row = await prisma.project.findUniqueOrThrow({ where: { id: project.id } })
    expect(zonedDateKey(row.startDate!)).toBe("2026-10-01")
    expect(zonedDateKey(row.endDate!)).toBe("2027-01-31")
  })

  it("un intrus ne peut modifier aucun champ du projet d'autrui (anti-IDOR)", async () => {
    const { project } = await owner()
    await asIntruder()

    await expect(updateProjectStatus(project.id, "CANCELLED")).rejects.toThrow()
    await expect(updateProjectPriority(project.id, "LOW")).rejects.toThrow()
    await expect(updateProjectInfo(project.id, { name: "Piraté" })).rejects.toThrow()
    await expect(updateProjectDates(project.id, { startDate: "2020-01-01" })).rejects.toThrow()

    const row = await prisma.project.findUniqueOrThrow({ where: { id: project.id } })
    expect(row).toMatchObject({ status: "ACTIVE", priority: "MEDIUM", name: "Site web", startDate: null })
  })
})

describe("deleteProject", () => {
  it("supprime le projet et ses tâches (cascade)", async () => {
    const { user, project } = await owner()
    await task(user.id, project.id)

    await deleteProject(project.id, "ignored")
    expect(await prisma.project.count()).toBe(0)
    expect(await prisma.task.count()).toBe(0)
  })

  it("refuse le projet d'un autre utilisateur (anti-IDOR)", async () => {
    const { project } = await owner()
    await asIntruder()

    await expect(deleteProject(project.id, "ignored")).rejects.toThrow()
    expect(await prisma.project.findUnique({ where: { id: project.id } })).not.toBeNull()
  })
})

// ── Tâches ───────────────────────────────────────────────────────────────────

describe("createTask", () => {
  it("crée une tâche complète (jalon, parent, heures, échéance)", async () => {
    const { user, project } = await owner()
    const milestone = await prisma.milestone.create({ data: { projectId: project.id, name: "MEP", date: new Date() } })
    const parent = await task(user.id, project.id, { title: "Parent" })

    const t = await createTask(project.id, fd({
      title: "Sous-tâche",
      description: "Détail",
      milestoneId: milestone.id,
      parentTaskId: parent.id,
      estimatedHours: "3",
      dueDate: "2026-10-15",
    }))

    const row = await prisma.task.findUniqueOrThrow({ where: { id: t.id } })
    expect(row).toMatchObject({
      userId: user.id, projectId: project.id, title: "Sous-tâche", description: "Détail",
      milestoneId: milestone.id, parentTaskId: parent.id, estimatedHours: 3, status: "TODO",
    })
    expect(zonedDateKey(row.dueDate!)).toBe("2026-10-15")
  })

  it("champs optionnels vides → null", async () => {
    const { project } = await owner()
    const t = await createTask(project.id, fd({ title: "Simple", milestoneId: "", parentTaskId: "" }))
    const row = await prisma.task.findUniqueOrThrow({ where: { id: t.id } })
    expect(row.milestoneId).toBeNull()
    expect(row.parentTaskId).toBeNull()
    expect(row.dueDate).toBeNull()
  })

  it("refuse le projet d'un autre utilisateur (anti-IDOR)", async () => {
    const { project } = await owner()
    await asIntruder()

    await expect(createTask(project.id, fd({ title: "Intrusion" }))).rejects.toThrow(/Projet introuvable/)
    expect(await prisma.task.count()).toBe(0)
  })

  // Régression corrigée le 29/09/2026 (src/actions/projet.ts:276-277) : parentTaskId / milestoneId ne sont pas
  // vérifiés → l'intrus crée, dans SON projet, une sous-tâche rattachée à la tâche
  // (ou au jalon) d'un autre utilisateur ; elle apparaît dans les subTasks de la victime.
  it("n'accepte pas une tâche parente ou un jalon d'autrui", async () => {
    const { user, project } = await owner()
    const victimTask = await task(user.id, project.id)
    const victimMilestone = await prisma.milestone.create({ data: { projectId: project.id, name: "MEP", date: new Date() } })
    const intruder = await asIntruder()
    const mine = await makeProject(intruder.id, (await makeClient(intruder.id)).id)

    await createTask(mine.id, fd({ title: "Injectée", parentTaskId: victimTask.id, milestoneId: victimMilestone.id })).catch(() => null)

    expect(await prisma.task.count({ where: { parentTaskId: victimTask.id } })).toBe(0)
    expect(await prisma.task.count({ where: { milestoneId: victimMilestone.id } })).toBe(0)
  })
})

describe("statuts de tâche", () => {
  it("start → complete → reopen", async () => {
    const { user, project } = await owner()
    const t = await task(user.id, project.id)

    await startTask(t.id, project.id)
    let row = await prisma.task.findUniqueOrThrow({ where: { id: t.id } })
    expect(row.status).toBe("IN_PROGRESS")
    expect(row.startedAt).not.toBeNull()
    expect(row.completedAt).toBeNull()

    await completeTask(t.id, project.id)
    row = await prisma.task.findUniqueOrThrow({ where: { id: t.id } })
    expect(row.status).toBe("DONE")
    expect(row.completedAt).not.toBeNull()

    await reopenTask(t.id, project.id)
    row = await prisma.task.findUniqueOrThrow({ where: { id: t.id } })
    expect(row).toMatchObject({ status: "TODO", startedAt: null, completedAt: null })
  })

  it("une tâche projet historique (userId null) reste pilotable via la propriété du projet", async () => {
    const { project } = await owner()
    const legacy = await prisma.task.create({ data: { projectId: project.id, title: "Ancienne" } })

    await startTask(legacy.id, project.id)
    expect((await prisma.task.findUniqueOrThrow({ where: { id: legacy.id } })).status).toBe("IN_PROGRESS")
  })

  it("completeTaskGlobal termine une tâche client hors projet", async () => {
    const { user, client } = await owner()
    const t = await prisma.task.create({ data: { userId: user.id, clientId: client.id, title: "Relancer" } })

    await completeTaskGlobal(t.id)
    const row = await prisma.task.findUniqueOrThrow({ where: { id: t.id } })
    expect(row.status).toBe("DONE")
    expect(row.completedAt).not.toBeNull()
  })

  it("annule avec raison (trim), puis dés-annule", async () => {
    const { user, project } = await owner()
    const t = await task(user.id, project.id)

    await cancelTask(t.id, project.id, "  Client injoignable  ")
    let row = await prisma.task.findUniqueOrThrow({ where: { id: t.id } })
    expect(row).toMatchObject({ status: "CANCELLED", outcome: "Client injoignable" })

    await uncancelTask(t.id, project.id)
    row = await prisma.task.findUniqueOrThrow({ where: { id: t.id } })
    expect(row).toMatchObject({ status: "TODO", outcome: null })
  })

  it("annulation sans raison ni projet → outcome null", async () => {
    const { user } = await owner()
    const t = await task(user.id, null)
    await cancelTask(t.id)
    await uncancelTask(t.id)
    await cancelTask(t.id, undefined, "   ")
    const row = await prisma.task.findUniqueOrThrow({ where: { id: t.id } })
    expect(row).toMatchObject({ status: "CANCELLED", outcome: null })
  })

  it("un intrus ne peut changer le statut d'aucune tâche d'autrui (anti-IDOR)", async () => {
    const { user, project } = await owner()
    const t = await task(user.id, project.id)
    await asIntruder()

    for (const call of [
      () => startTask(t.id, project.id),
      () => completeTask(t.id, project.id),
      () => completeTaskGlobal(t.id),
      () => reopenTask(t.id, project.id),
      () => cancelTask(t.id, project.id, "x"),
      () => uncancelTask(t.id, project.id),
    ]) {
      await expect(call()).rejects.toThrow(/Tâche introuvable/)
    }

    const row = await prisma.task.findUniqueOrThrow({ where: { id: t.id } })
    expect(row).toMatchObject({ status: "TODO", startedAt: null, completedAt: null, outcome: null })
  })
})

describe("champs de tâche (édition unitaire)", () => {
  it("titre (trim, vide ignoré), description, heures, priorité, importance bornée", async () => {
    const { user, project } = await owner()
    const t = await task(user.id, project.id, { title: "Avant" })

    await updateTaskTitle(t.id, project.id, "  Après  ")
    await updateTaskTitle(t.id, project.id, "   ")
    await updateTaskDescription(t.id, project.id, "  Notes  ")
    await updateTaskEstimatedHours(t.id, project.id, 2.5)
    await updateTaskPriority(t.id, project.id, "HIGH")
    await updateTaskImportance(t.id, project.id, 9)

    let row = await prisma.task.findUniqueOrThrow({ where: { id: t.id } })
    expect(row).toMatchObject({
      title: "Après", description: "Notes", estimatedHours: 2.5, priority: "HIGH", importance: 4,
    })

    await updateTaskDescription(t.id, project.id, "  ")
    await updateTaskEstimatedHours(t.id, project.id, null)
    await updateTaskImportance(t.id, project.id, 0)
    row = await prisma.task.findUniqueOrThrow({ where: { id: t.id } })
    expect(row).toMatchObject({ description: null, estimatedHours: null, importance: 1 })
  })

  it("échéance stockée à minuit Paris, puis effacée", async () => {
    const { user, project } = await owner()
    const t = await task(user.id, project.id)

    await updateTaskDueDate(t.id, project.id, "2026-10-31")
    let row = await prisma.task.findUniqueOrThrow({ where: { id: t.id } })
    expect(row.dueDate).toEqual(parseCivilDate("2026-10-31"))
    expect(zonedDateKey(row.dueDate!)).toBe("2026-10-31")

    await updateTaskDueDate(t.id, project.id, null)
    row = await prisma.task.findUniqueOrThrow({ where: { id: t.id } })
    expect(row.dueDate).toBeNull()
  })

  it("date de réalisation modifiable puis effaçable", async () => {
    const { user, project } = await owner()
    const t = await task(user.id, project.id, { status: "DONE", completedAt: new Date() })

    await updateTaskCompletedAt(t.id, project.id, "2026-09-10")
    let row = await prisma.task.findUniqueOrThrow({ where: { id: t.id } })
    expect(zonedDateKey(row.completedAt!)).toBe("2026-09-10")

    await updateTaskCompletedAt(t.id, project.id, null)
    row = await prisma.task.findUniqueOrThrow({ where: { id: t.id } })
    expect(row.completedAt).toBeNull()
  })

  it("un intrus ne peut modifier aucun champ de la tâche d'autrui (anti-IDOR)", async () => {
    const { user, project } = await owner()
    const t = await task(user.id, project.id, { title: "Original" })
    await asIntruder()

    for (const call of [
      () => updateTaskTitle(t.id, project.id, "Piraté"),
      () => updateTaskDescription(t.id, project.id, "Piraté"),
      () => updateTaskEstimatedHours(t.id, project.id, 99),
      () => updateTaskDueDate(t.id, project.id, "2030-01-01"),
      () => updateTaskCompletedAt(t.id, project.id, "2030-01-01"),
      () => updateTaskPriority(t.id, project.id, "URGENT"),
      () => updateTaskImportance(t.id, project.id, 4),
      () => updateTaskFields(t.id, { title: "Piraté" }),
    ]) {
      await expect(call()).rejects.toThrow(/Tâche introuvable/)
    }

    const row = await prisma.task.findUniqueOrThrow({ where: { id: t.id } })
    expect(row).toMatchObject({
      title: "Original", description: null, estimatedHours: null, dueDate: null,
      completedAt: null, priority: "LOW", importance: 1,
    })
  })
})

describe("updateTaskFields", () => {
  it("met à jour plusieurs champs d'un coup, en ignorant un titre vide", async () => {
    const { user } = await owner()
    const t = await task(user.id, null, { title: "Garder", description: "old", estimatedHours: 5 })

    await updateTaskFields(t.id, {
      title: "  ",
      description: "  nouvelle  ",
      dueDate: "2026-11-02",
      priority: "MEDIUM",
      importance: -3,
      estimatedHours: null,
    })

    const row = await prisma.task.findUniqueOrThrow({ where: { id: t.id } })
    expect(row).toMatchObject({
      title: "Garder", description: "nouvelle", priority: "MEDIUM", importance: 1, estimatedHours: null,
    })
    expect(zonedDateKey(row.dueDate!)).toBe("2026-11-02")
  })

  it("seuls les champs fournis sont touchés ; dueDate null efface", async () => {
    const { user } = await owner()
    const t = await task(user.id, null, { title: "T", description: "garde", dueDate: new Date(), estimatedHours: 1 })

    await updateTaskFields(t.id, { title: "Nouveau", dueDate: null })

    const row = await prisma.task.findUniqueOrThrow({ where: { id: t.id } })
    expect(row).toMatchObject({ title: "Nouveau", description: "garde", dueDate: null, estimatedHours: 1 })
  })

  // BUG mineur (src/actions/projet.ts:592, idem createTask:279) : la date « jour »
  // est parsée avec `new Date("YYYY-MM-DD")` → minuit UTC, alors que
  // updateTaskDueDate (l.422) et la convention de l'app stockent minuit Paris
  // (parseCivilDate). La même échéance saisie depuis deux écrans donne deux instants.
  it("l'échéance est stockée à minuit Paris comme updateTaskDueDate", async () => {
    const { user } = await owner()
    const t = await task(user.id, null)
    await updateTaskFields(t.id, { dueDate: "2026-08-01" })
    const row = await prisma.task.findUniqueOrThrow({ where: { id: t.id } })
    expect(row.dueDate).toEqual(parseCivilDate("2026-08-01"))
  })
})

describe("deleteTask", () => {
  it("supprime la tâche et détache ses sous-tâches", async () => {
    const { user, project } = await owner()
    const parent = await task(user.id, project.id, { title: "Parent" })
    const child = await task(user.id, project.id, { title: "Enfant", parentTaskId: parent.id })

    await deleteTask(parent.id, project.id)

    expect(await prisma.task.findUnique({ where: { id: parent.id } })).toBeNull()
    const orphan = await prisma.task.findUniqueOrThrow({ where: { id: child.id } })
    expect(orphan.parentTaskId).toBeNull()
  })

  it("supprime une tâche hors projet (sans projectId)", async () => {
    const { user } = await owner()
    const t = await task(user.id, null)
    await deleteTask(t.id)
    expect(await prisma.task.count()).toBe(0)
  })

  it("refuse la tâche d'un autre utilisateur (anti-IDOR)", async () => {
    const { user, project } = await owner()
    const t = await task(user.id, project.id)
    await asIntruder()

    await expect(deleteTask(t.id, project.id)).rejects.toThrow(/Tâche introuvable/)
    expect(await prisma.task.findUnique({ where: { id: t.id } })).not.toBeNull()
  })
})

// ── Tags de tâche ────────────────────────────────────────────────────────────

describe("tags de tâche", () => {
  it("crée un tag, le recrée avec le même nom (upsert → couleur mise à jour), le recolore et le supprime", async () => {
    const { project } = await owner()

    await createTaskTag(project.id, "Front", "#111111")
    await createTaskTag(project.id, "Front", "#222222")
    let tags = await prisma.taskTag.findMany({ where: { projectId: project.id } })
    expect(tags).toHaveLength(1)
    expect(tags[0].color).toBe("#222222")

    await updateTaskTagColor(tags[0].id, project.id, "#333333")
    expect((await prisma.taskTag.findUniqueOrThrow({ where: { id: tags[0].id } })).color).toBe("#333333")

    await deleteTaskTag(tags[0].id, project.id)
    tags = await prisma.taskTag.findMany({ where: { projectId: project.id } })
    expect(tags).toHaveLength(0)
  })

  it("associe puis dissocie un tag d'une tâche", async () => {
    const { user, project } = await owner()
    const t = await task(user.id, project.id)
    const tag = await prisma.taskTag.create({ data: { projectId: project.id, name: "Back" } })

    await addTagToTask(t.id, tag.id, project.id)
    let row = await prisma.task.findUniqueOrThrow({ where: { id: t.id }, include: { taskTags: true } })
    expect(row.taskTags.map((x) => x.id)).toEqual([tag.id])

    await removeTagFromTask(t.id, tag.id, project.id)
    row = await prisma.task.findUniqueOrThrow({ where: { id: t.id }, include: { taskTags: true } })
    expect(row.taskTags).toHaveLength(0)
  })

  it("un intrus ne peut toucher aux tags du projet d'autrui (anti-IDOR, projectId de la victime)", async () => {
    const { user, project } = await owner()
    const t = await task(user.id, project.id)
    const tag = await prisma.taskTag.create({ data: { projectId: project.id, name: "Back", color: "#000000" } })
    await prisma.task.update({ where: { id: t.id }, data: { taskTags: { connect: { id: tag.id } } } })
    await asIntruder()

    for (const call of [
      () => createTaskTag(project.id, "Intrus", "#ff0000"),
      () => deleteTaskTag(tag.id, project.id),
      () => updateTaskTagColor(tag.id, project.id, "#ff0000"),
      () => addTagToTask(t.id, tag.id, project.id),
      () => removeTagFromTask(t.id, tag.id, project.id),
    ]) {
      await expect(call()).rejects.toThrow(/Projet introuvable/)
    }

    const tags = await prisma.taskTag.findMany({ where: { projectId: project.id }, include: { tasks: true } })
    expect(tags).toHaveLength(1)
    expect(tags[0].color).toBe("#000000")
    expect(tags[0].tasks.map((x) => x.id)).toEqual([t.id])
  })

  it("deleteTaskTag via son propre projet ne supprime pas le tag d'autrui (anti-IDOR)", async () => {
    const { project } = await owner()
    const tag = await prisma.taskTag.create({ data: { projectId: project.id, name: "Back" } })
    const intruder = await asIntruder()
    const mine = await makeProject(intruder.id, (await makeClient(intruder.id)).id)

    await expect(deleteTaskTag(tag.id, mine.id)).rejects.toThrow()
    expect(await prisma.taskTag.findUnique({ where: { id: tag.id } })).not.toBeNull()
  })

  // Régression corrigée le 29/09/2026 (src/actions/projet.ts:485) : seul le projet passé en paramètre est
  // vérifié ; l'update se fait sur `{ id: tagId }` sans scope projet → l'intrus
  // passe SON projectId et recolore le tag d'un autre utilisateur.
  it("updateTaskTagColor via son propre projet ne modifie pas le tag d'autrui", async () => {
    const { project } = await owner()
    const tag = await prisma.taskTag.create({ data: { projectId: project.id, name: "Back", color: "#000000" } })
    const intruder = await asIntruder()
    const mine = await makeProject(intruder.id, (await makeClient(intruder.id)).id)

    await updateTaskTagColor(tag.id, mine.id, "#ff0000").catch(() => {})
    expect((await prisma.taskTag.findUniqueOrThrow({ where: { id: tag.id } })).color).toBe("#000000")
  })

  // Régression corrigée le 29/09/2026 (src/actions/projet.ts:493-496 et 504-507) : ni la tâche ni le tag ne
  // sont scopés au projet vérifié → l'intrus passe SON projectId et ajoute (ou
  // retire) des tags sur la tâche d'un autre utilisateur.
  it("addTagToTask/removeTagFromTask via son propre projet ne touchent pas la tâche d'autrui", async () => {
    const { user, project } = await owner()
    const victimTask = await task(user.id, project.id)
    const victimTag = await prisma.taskTag.create({ data: { projectId: project.id, name: "Back" } })
    await prisma.task.update({ where: { id: victimTask.id }, data: { taskTags: { connect: { id: victimTag.id } } } })
    const intruder = await asIntruder()
    const mine = await makeProject(intruder.id, (await makeClient(intruder.id)).id)
    const myTag = await prisma.taskTag.create({ data: { projectId: mine.id, name: "Spam" } })

    await addTagToTask(victimTask.id, myTag.id, mine.id).catch(() => {})
    await removeTagFromTask(victimTask.id, victimTag.id, mine.id).catch(() => {})

    const row = await prisma.task.findUniqueOrThrow({ where: { id: victimTask.id }, include: { taskTags: true } })
    expect(row.taskTags.map((x) => x.id)).toEqual([victimTag.id])
  })
})

describe("migrateGroupsToTags", () => {
  it("convertit chaque tâche-groupe en tag, rattache et détache ses sous-tâches, supprime le groupe", async () => {
    const { user, project } = await owner()
    const group = await task(user.id, project.id, { title: "Design", isGroup: true, color: "#ff00ff" })
    const noColor = await task(user.id, project.id, { title: "Infra", isGroup: true })
    const sub = await task(user.id, project.id, { title: "Maquette", parentTaskId: group.id })
    const loose = await task(user.id, project.id, { title: "Libre" })

    await migrateGroupsToTags(project.id)

    expect(await prisma.task.findUnique({ where: { id: group.id } })).toBeNull()
    expect(await prisma.task.findUnique({ where: { id: noColor.id } })).toBeNull()
    const tags = await prisma.taskTag.findMany({ where: { projectId: project.id }, orderBy: { name: "asc" } })
    expect(tags.map((t) => [t.name, t.color])).toEqual([["Design", "#ff00ff"], ["Infra", "#6366f1"]])

    const moved = await prisma.task.findUniqueOrThrow({ where: { id: sub.id }, include: { taskTags: true } })
    expect(moved.parentTaskId).toBeNull()
    expect(moved.taskTags.map((t) => t.name)).toEqual(["Design"])
    const untouched = await prisma.task.findUniqueOrThrow({ where: { id: loose.id }, include: { taskTags: true } })
    expect(untouched.taskTags).toHaveLength(0)
  })

  it("sans groupe → aucun tag créé", async () => {
    const { user, project } = await owner()
    await task(user.id, project.id)
    await migrateGroupsToTags(project.id)
    expect(await prisma.taskTag.count()).toBe(0)
  })

  it("refuse le projet d'un autre utilisateur (anti-IDOR)", async () => {
    const { user, project } = await owner()
    const group = await task(user.id, project.id, { title: "Design", isGroup: true })
    await asIntruder()

    await expect(migrateGroupsToTags(project.id)).rejects.toThrow(/Projet introuvable/)
    expect(await prisma.task.findUnique({ where: { id: group.id } })).not.toBeNull()
    expect(await prisma.taskTag.count()).toBe(0)
  })
})

// ── Ordre des tâches ─────────────────────────────────────────────────────────

describe("reorderTasks", () => {
  it("applique l'ordre (pas de 10) et ignore un id de tâche étranger", async () => {
    const { user, project } = await owner()
    const a = await task(user.id, project.id, { title: "A" })
    const b = await task(user.id, project.id, { title: "B" })
    const other = await makeUser()
    const foreignProject = await makeProject(other.id, (await makeClient(other.id)).id)
    const foreign = await task(other.id, foreignProject.id, { order: 7 })

    await reorderTasks(project.id, [b.id, foreign.id, a.id])

    expect((await prisma.task.findUniqueOrThrow({ where: { id: b.id } })).order).toBe(0)
    expect((await prisma.task.findUniqueOrThrow({ where: { id: a.id } })).order).toBe(20)
    expect((await prisma.task.findUniqueOrThrow({ where: { id: foreign.id } })).order).toBe(7)
  })

  it("liste vide → rien ne change", async () => {
    const { user, project } = await owner()
    const a = await task(user.id, project.id, { order: 3 })
    await reorderTasks(project.id, [])
    expect((await prisma.task.findUniqueOrThrow({ where: { id: a.id } })).order).toBe(3)
  })

  it("refuse le projet d'un autre utilisateur (anti-IDOR)", async () => {
    const { user, project } = await owner()
    const a = await task(user.id, project.id, { order: 3 })
    await asIntruder()

    await expect(reorderTasks(project.id, [a.id])).rejects.toThrow(/Projet introuvable/)
    expect((await prisma.task.findUniqueOrThrow({ where: { id: a.id } })).order).toBe(3)
  })
})

describe("reorderTask", () => {
  it("échange avec la voisine (haut / bas) ; bornes et id inconnu sans effet", async () => {
    const { user, project } = await owner()
    const a = await task(user.id, project.id, { title: "A", order: 0 })
    const b = await task(user.id, project.id, { title: "B", order: 10 })
    const order = async () =>
      (await prisma.task.findMany({ where: { projectId: project.id }, orderBy: { order: "asc" } })).map((t) => t.title)

    await reorderTask(b.id, project.id, "up")
    expect(await order()).toEqual(["B", "A"])

    await reorderTask(b.id, project.id, "up") // déjà en tête
    await reorderTask(a.id, project.id, "down") // déjà en queue
    await reorderTask("inexistant", project.id, "down")
    expect(await order()).toEqual(["B", "A"])

    await reorderTask(b.id, project.id, "down")
    expect(await order()).toEqual(["A", "B"])
  })

  it("refuse le projet d'un autre utilisateur (anti-IDOR)", async () => {
    const { user, project } = await owner()
    const a = await task(user.id, project.id, { order: 0 })
    await task(user.id, project.id, { order: 10 })
    await asIntruder()

    await expect(reorderTask(a.id, project.id, "down")).rejects.toThrow(/Projet introuvable/)
    expect((await prisma.task.findUniqueOrThrow({ where: { id: a.id } })).order).toBe(0)
  })

  // Régression corrigée le 29/09/2026 (src/actions/projet.ts:560 et 570) : la tâche est lue par `findUnique({ id })`
  // sans scope projet ; avec SON projectId, l'intrus fait "down" sur la tâche d'autrui
  // (idx = -1 → swapIdx = 0) et l'ordre de la tâche de la victime est réécrit.
  it("reorderTask via son propre projet ne réordonne pas la tâche d'autrui", async () => {
    const { user, project } = await owner()
    const victimTask = await task(user.id, project.id, { order: 50 })
    const intruder = await asIntruder()
    const mine = await makeProject(intruder.id, (await makeClient(intruder.id)).id)
    await task(intruder.id, mine.id, { order: 999 })

    await reorderTask(victimTask.id, mine.id, "down").catch(() => {})
    expect((await prisma.task.findUniqueOrThrow({ where: { id: victimTask.id } })).order).toBe(50)
  })
})

// ── Jalons ───────────────────────────────────────────────────────────────────

describe("jalons", () => {
  it("création avec valeurs par défaut (OTHER / UPCOMING / sans fin)", async () => {
    const { project } = await owner()
    const date = new Date("2026-10-20T08:00:00Z")
    const m = await createMilestone(project.id, { name: "Kick-off", date })

    const row = await prisma.milestone.findUniqueOrThrow({ where: { id: m.id } })
    expect(row).toMatchObject({ projectId: project.id, name: "Kick-off", type: "OTHER", status: "UPCOMING", endDate: null })
    expect(row.date).toEqual(date)
  })

  it("mise à jour : type, fin, statut ; statut omis → conservé", async () => {
    const { project } = await owner()
    const m = await createMilestone(project.id, {
      name: "Démo", date: new Date("2026-10-20T08:00:00Z"), type: "MEETING", status: "IN_PROGRESS",
    })
    const end = new Date("2026-10-20T09:00:00Z")

    await updateMilestone(m.id, project.id, { name: "Démo client", date: new Date("2026-10-21T08:00:00Z"), endDate: end, type: "CALL" })

    const row = await prisma.milestone.findUniqueOrThrow({ where: { id: m.id } })
    expect(row).toMatchObject({ name: "Démo client", type: "CALL", status: "IN_PROGRESS", endDate: end })

    await updateMilestone(m.id, project.id, { name: "Démo client", date: row.date, status: "DONE" })
    const after = await prisma.milestone.findUniqueOrThrow({ where: { id: m.id } })
    expect(after).toMatchObject({ status: "DONE", type: "OTHER", endDate: null })
  })

  it("statut : raison conservée à l'annulation, effacée ensuite", async () => {
    const { project } = await owner()
    const m = await createMilestone(project.id, { name: "Livraison", date: new Date() })

    await updateMilestoneStatus(m.id, project.id, "CANCELLED", "  Report client  ")
    expect(await prisma.milestone.findUniqueOrThrow({ where: { id: m.id } })).toMatchObject({
      status: "CANCELLED", outcome: "Report client",
    })

    await updateMilestoneStatus(m.id, project.id, "DONE")
    expect(await prisma.milestone.findUniqueOrThrow({ where: { id: m.id } })).toMatchObject({
      status: "DONE", outcome: null,
    })
  })

  it("suppression : les tâches liées perdent leur jalon mais restent", async () => {
    const { user, project } = await owner()
    const m = await createMilestone(project.id, { name: "MEP", date: new Date() })
    const t = await task(user.id, project.id, { milestoneId: m.id })

    await deleteMilestone(m.id, project.id)

    expect(await prisma.milestone.count()).toBe(0)
    expect((await prisma.task.findUniqueOrThrow({ where: { id: t.id } })).milestoneId).toBeNull()
  })

  it("un intrus ne peut ni créer, ni modifier, ni supprimer un jalon d'autrui (anti-IDOR)", async () => {
    const { project } = await owner()
    const m = await prisma.milestone.create({ data: { projectId: project.id, name: "MEP", date: new Date("2026-10-01T00:00:00Z") } })
    const intruder = await asIntruder()
    const mine = await makeProject(intruder.id, (await makeClient(intruder.id)).id)

    await expect(createMilestone(project.id, { name: "Intrus", date: new Date() })).rejects.toThrow(/Projet introuvable/)
    // Même en passant SON projectId, le jalon d'autrui reste inaccessible.
    await expect(updateMilestone(m.id, mine.id, { name: "Piraté", date: new Date() })).rejects.toThrow(/Jalon introuvable/)
    await expect(updateMilestoneStatus(m.id, mine.id, "CANCELLED", "x")).rejects.toThrow(/Jalon introuvable/)
    await expect(deleteMilestone(m.id, mine.id)).rejects.toThrow(/Jalon introuvable/)

    const rows = await prisma.milestone.findMany({ where: { projectId: project.id } })
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ name: "MEP", status: "UPCOMING", outcome: null })
  })
})

// ── Liens utiles ─────────────────────────────────────────────────────────────

describe("liens utiles", () => {
  it("crée (catégorie OTHER par défaut), met à jour et supprime", async () => {
    const { project } = await owner()

    await createUsefulLink(project.id, { label: "Repo", url: "https://github.com/x/y" })
    const link = await prisma.usefulLink.findFirstOrThrow({ where: { projectId: project.id } })
    expect(link).toMatchObject({ label: "Repo", url: "https://github.com/x/y", category: "OTHER" })

    await updateUsefulLink(link.id, project.id, { label: "Dépôt", url: "https://github.com/x/z", category: "GITHUB" })
    expect(await prisma.usefulLink.findUniqueOrThrow({ where: { id: link.id } })).toMatchObject({
      label: "Dépôt", url: "https://github.com/x/z", category: "GITHUB",
    })

    await deleteUsefulLink(link.id, project.id)
    expect(await prisma.usefulLink.count()).toBe(0)
  })

  it("un intrus ne peut ni créer, ni modifier, ni supprimer un lien d'autrui (anti-IDOR)", async () => {
    const { project } = await owner()
    const link = await prisma.usefulLink.create({ data: { projectId: project.id, label: "Prod", url: "https://prod" } })
    await asIntruder()

    await expect(createUsefulLink(project.id, { label: "x", url: "https://x" })).rejects.toThrow(/Projet introuvable/)
    await expect(updateUsefulLink(link.id, project.id, { label: "Piraté", url: "https://evil" })).rejects.toThrow(/Lien introuvable/)
    await expect(deleteUsefulLink(link.id, project.id)).rejects.toThrow(/Lien introuvable/)

    const rows = await prisma.usefulLink.findMany()
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ label: "Prod", url: "https://prod" })
  })
})

// ── Frise chronologique ──────────────────────────────────────────────────────

describe("événements de frise", () => {
  it("création : trim, description vide → null, lien externe refusé", async () => {
    const { project } = await owner()
    const date = new Date("2026-09-15T10:00:00Z")

    const ev = await createProjectEvent(project.id, {
      kind: "MEETING", title: "  Réunion  ", description: "   ", date, href: "https://evil.example",
    })

    const row = await prisma.projectEvent.findUniqueOrThrow({ where: { id: ev.id } })
    expect(row).toMatchObject({ kind: "MEETING", title: "Réunion", description: null, href: null, date })
  })

  it("mise à jour avec un lien interne conservé, puis suppression", async () => {
    const { project } = await owner()
    const ev = await createProjectEvent(project.id, { kind: "NOTE", title: "Note", date: new Date() })

    await updateProjectEvent(ev.id, {
      kind: "PAYMENT", title: "Acompte reçu", description: " 30 % ", date: new Date("2026-09-20T00:00:00Z"), href: " /factures/abc ",
    })
    expect(await prisma.projectEvent.findUniqueOrThrow({ where: { id: ev.id } })).toMatchObject({
      kind: "PAYMENT", title: "Acompte reçu", description: "30 %", href: "/factures/abc",
    })

    await deleteProjectEvent(ev.id)
    expect(await prisma.projectEvent.count()).toBe(0)
  })

  it("un intrus ne peut ni créer, ni modifier, ni supprimer un événement d'autrui (anti-IDOR)", async () => {
    const { project } = await owner()
    const ev = await prisma.projectEvent.create({ data: { projectId: project.id, title: "Original", date: new Date() } })
    await asIntruder()

    await expect(createProjectEvent(project.id, { kind: "NOTE", title: "x", date: new Date() })).rejects.toThrow(/Projet introuvable/)
    await expect(updateProjectEvent(ev.id, { kind: "LEGAL", title: "Piraté", date: new Date() })).rejects.toThrow(/Événement introuvable/)
    await deleteProjectEvent(ev.id) // silencieux (deleteMany scopé)

    const rows = await prisma.projectEvent.findMany()
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ title: "Original", kind: "NOTE" })
  })
})

// ── Journal ──────────────────────────────────────────────────────────────────

describe("journal", () => {
  it("crée, modifie et supprime une entrée", async () => {
    const { project } = await owner()

    await createJournalEntry(project.id, fd({ content: "Premier jet" }))
    const entry = await prisma.journalEntry.findFirstOrThrow({ where: { projectId: project.id } })
    expect(entry.content).toBe("Premier jet")

    await updateJournalEntry(entry.id, project.id, "Version finale")
    expect((await prisma.journalEntry.findUniqueOrThrow({ where: { id: entry.id } })).content).toBe("Version finale")

    await deleteJournalEntry(entry.id, project.id)
    expect(await prisma.journalEntry.count()).toBe(0)
  })

  it("un intrus ne peut ni écrire, ni modifier, ni supprimer une entrée d'autrui (anti-IDOR)", async () => {
    const { project } = await owner()
    const entry = await prisma.journalEntry.create({ data: { projectId: project.id, content: "Privé" } })
    await asIntruder()

    await expect(createJournalEntry(project.id, fd({ content: "x" }))).rejects.toThrow(/Projet introuvable/)
    await expect(updateJournalEntry(entry.id, project.id, "Piraté")).rejects.toThrow(/Entrée introuvable/)
    await deleteJournalEntry(entry.id, project.id) // silencieux (deleteMany scopé)

    const rows = await prisma.journalEntry.findMany()
    expect(rows).toHaveLength(1)
    expect(rows[0].content).toBe("Privé")
  })
})

// ── Livrables ────────────────────────────────────────────────────────────────

describe("livrables", () => {
  it("crée avec ou sans échéance puis change le statut", async () => {
    const { project } = await owner()

    await createDeliverable(project.id, fd({ name: "Maquettes", dueDate: "2026-10-10" }))
    await createDeliverable(project.id, fd({ name: "Recette" }))
    const [withDate, without] = await prisma.deliverable.findMany({ where: { projectId: project.id }, orderBy: { name: "asc" } })
    expect(withDate.name).toBe("Maquettes")
    expect(zonedDateKey(withDate.dueDate!)).toBe("2026-10-10")
    expect(without).toMatchObject({ name: "Recette", dueDate: null, status: "TO_DELIVER" })

    await updateDeliverableStatus(withDate.id, project.id, "VALIDATED")
    expect((await prisma.deliverable.findUniqueOrThrow({ where: { id: withDate.id } })).status).toBe("VALIDATED")
  })

  it("un intrus ne peut ni créer ni modifier un livrable d'autrui (anti-IDOR)", async () => {
    const { project } = await owner()
    const d = await prisma.deliverable.create({ data: { projectId: project.id, name: "Maquettes" } })
    await asIntruder()

    await expect(createDeliverable(project.id, fd({ name: "x" }))).rejects.toThrow(/Projet introuvable/)
    await expect(updateDeliverableStatus(d.id, project.id, "DELIVERED")).rejects.toThrow(/Livrable introuvable/)

    const rows = await prisma.deliverable.findMany()
    expect(rows).toHaveLength(1)
    expect(rows[0].status).toBe("TO_DELIVER")
  })
})

// ── Collaborateurs ───────────────────────────────────────────────────────────

describe("collaborateurs", () => {
  it("invite par email (normalisé) : membre MEMBER + notification au collaborateur", async () => {
    const { user, project } = await owner()
    const guest = await makeUser()

    const res = await addProjectMember(project.id, "ignored", `  ${guest.email.toUpperCase()} `)

    expect(res).toEqual({})
    const member = await prisma.projectMember.findUniqueOrThrow({
      where: { projectId_userId: { projectId: project.id, userId: guest.id } },
    })
    expect(member.role).toBe("MEMBER")
    const notif = await prisma.notification.findFirstOrThrow({ where: { userId: guest.id } })
    expect(notif).toMatchObject({ type: "PROJECT_INVITE", title: "Invitation à collaborer", href: `/projets/${project.id}` })
    expect(notif.body).toContain(user.name!)
    expect(notif.body).toContain("« Site web » (ACME)")
  })

  it("renvoie une erreur explicite : email inconnu, soi-même, déjà membre", async () => {
    const { user, project } = await owner()
    const guest = await makeUser()

    expect(await addProjectMember(project.id, "ignored", "personne@test.local")).toEqual({ error: "Aucun compte trouvé avec cet email" })
    expect(await addProjectMember(project.id, "ignored", user.email!)).toEqual({ error: "Vous êtes déjà le propriétaire du projet" })
    await addProjectMember(project.id, "ignored", guest.email!)
    expect(await addProjectMember(project.id, "ignored", guest.email!)).toEqual({ error: "Cet utilisateur est déjà collaborateur" })

    expect(await prisma.projectMember.count()).toBe(1)
    expect(await prisma.notification.count()).toBe(1)
  })

  it("change le rôle puis retire le membre (notification de retrait)", async () => {
    const { project } = await owner()
    const guest = await makeUser()
    await prisma.projectMember.create({ data: { projectId: project.id, userId: guest.id } })

    await updateProjectMemberRole(project.id, "ignored", guest.id, "VIEWER")
    expect((await prisma.projectMember.findFirstOrThrow()).role).toBe("VIEWER")

    await removeProjectMember(project.id, "ignored", guest.id)
    expect(await prisma.projectMember.count()).toBe(0)
    const notif = await prisma.notification.findFirstOrThrow({ where: { userId: guest.id } })
    expect(notif).toMatchObject({ title: "Retiré d'un projet", href: "/projets" })
  })

  it("un intrus ne peut ni inviter, ni changer le rôle, ni retirer un membre du projet d'autrui (anti-IDOR)", async () => {
    const { project } = await owner()
    const guest = await makeUser()
    await prisma.projectMember.create({ data: { projectId: project.id, userId: guest.id } })
    const intruder = await asIntruder()
    const accomplice = await makeUser()

    expect(await addProjectMember(project.id, intruder.id, accomplice.email!)).toEqual({
      error: "Projet introuvable ou accès refusé",
    })
    await updateProjectMemberRole(project.id, intruder.id, guest.id, "VIEWER") // no-op silencieux
    await removeProjectMember(project.id, intruder.id, guest.id) // no-op silencieux

    const members = await prisma.projectMember.findMany()
    expect(members).toHaveLength(1)
    expect(members[0]).toMatchObject({ userId: guest.id, role: "MEMBER" })
    expect(await prisma.notification.count()).toBe(0)
  })
})
