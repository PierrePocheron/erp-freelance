import { describe, it, expect, vi } from "vitest"
import {
  createSkill,
  updateSkill,
  deleteSkill,
  moveSkill,
  patchSkill,
  setProjectSkill,
  removeProjectSkill,
  linkOrCreateProjectSkill,
  linkOrCreateJobApplicationSkill,
  removeJobApplicationSkill,
  createInterviewQuestion,
  updateInterviewQuestion,
  deleteInterviewQuestion,
  setQuestionStatus,
  scheduleSkillWork,
} from "@/actions/competences"
import { prisma } from "@/lib/prisma"
import { zonedDateKey, zonedParts } from "@/lib/dates"
import { setTestUser } from "./setup"
import { makeUser, makeClient, makeProject, makeJobApplication } from "./helpers/factories"

// Aucune synchro Google réelle depuis les tests.
vi.mock("@/lib/google-task-sync", () => ({
  syncTaskGoogleState: vi.fn(async () => {}),
  syncJobApplicationGoogleState: vi.fn(async () => {}),
  removeJobApplicationFromGoogle: vi.fn(async () => {}),
}))

const base = { type: "HARD" as const, level: 0, status: "TO_ACQUIRE" as const }
const skill = (id: string) => prisma.skill.findUniqueOrThrow({ where: { id } })

async function asNewUser() {
  const user = await makeUser()
  setTestUser(user.id)
  return user
}

describe("compétences — validations et champs", () => {
  it("nom requis, niveau borné 0–5 et arrondi, champs optionnels nettoyés", async () => {
    await asNewUser()
    await expect(createSkill({ ...base, name: "   " })).rejects.toThrow(/Nom de compétence requis/)

    const id = await createSkill({
      ...base, name: "  TypeScript ", level: 7.6, targetVersion: "  5.x ", yearsExperience: 3, notes: "  strict ",
    })
    expect(await skill(id)).toMatchObject({ name: "TypeScript", level: 5, targetVersion: "5.x", yearsExperience: 3, notes: "strict" })

    await updateSkill(id, { ...base, name: "TS", level: -3, targetVersion: "  ", notes: "" })
    expect(await skill(id)).toMatchObject({ name: "TS", level: 0, targetVersion: null, yearsExperience: null, notes: null })
    await expect(updateSkill(id, { ...base, name: "" })).rejects.toThrow(/requis/)
  })

  it("patchSkill : statut, niveau, famille, renommage partiels ; patch vide sans effet ; autre compte refusé", async () => {
    const owner = await asNewUser()
    const id = await createSkill({ ...base, name: "Docker", level: 2 })

    await patchSkill(id, { status: "LEARNING" })
    await patchSkill(id, { level: 9 })
    await patchSkill(id, { family: "DEVOPS", name: "  Docker Compose " })
    expect(await skill(id)).toMatchObject({ status: "LEARNING", level: 5, family: "DEVOPS", name: "Docker Compose" })

    await patchSkill(id, { family: null })
    expect((await skill(id)).family).toBeNull()
    await expect(patchSkill(id, { name: "  " })).rejects.toThrow(/requis/)
    await patchSkill(id, {}) // rien à écrire → retour silencieux

    await asNewUser()
    await expect(patchSkill(id, { level: 1 })).rejects.toThrow(/introuvable/)
    await expect(patchSkill(id, {})).resolves.toBeUndefined()
    expect(await skill(id)).toMatchObject({ level: 5, name: "Docker Compose" })
    expect((await skill(id)).userId).toBe(owner.id)
  })

  it("moveSkill : racine avec null, soi-même comme parent ignoré, id inconnu ou d'autrui refusé", async () => {
    await asNewUser()
    const root = await createSkill({ ...base, name: "Web" })
    const child = await createSkill({ ...base, name: "CSS", parentId: root })

    await moveSkill(child, null)
    expect((await skill(child)).parentId).toBeNull()
    await moveSkill(child, child)
    expect((await skill(child)).parentId).toBeNull()
    await expect(moveSkill("inexistant", root)).rejects.toThrow(/introuvable/)

    await asNewUser()
    await expect(moveSkill(child, null)).rejects.toThrow(/introuvable/)
  })

  it("anti-cycle profond : un nœud ne descend pas sous son petit-enfant", async () => {
    await asNewUser()
    const a = await createSkill({ ...base, name: "A" })
    const b = await createSkill({ ...base, name: "B", parentId: a })
    const c = await createSkill({ ...base, name: "C", parentId: b })
    await expect(moveSkill(a, c)).rejects.toThrow(/cycle/)
    await expect(updateSkill(a, { ...base, name: "A", parentId: c })).rejects.toThrow(/cycle/)
    expect((await skill(a)).parentId).toBeNull()

    // Déplacement légitime dans une chaîne déjà profonde.
    const d = await createSkill({ ...base, name: "D" })
    await moveSkill(d, c)
    expect((await skill(d)).parentId).toBe(c)
  })

  it("supprimer un parent remonte ses enfants en racine ; suppression d'autrui sans effet", async () => {
    const owner = await asNewUser()
    const parent = await createSkill({ ...base, name: "Back" })
    const child = await createSkill({ ...base, name: "Node", parentId: parent })

    await asNewUser()
    await deleteSkill(parent)
    expect(await prisma.skill.count()).toBe(2)

    setTestUser(owner.id)
    await deleteSkill(parent)
    expect(await prisma.skill.findUnique({ where: { id: parent } })).toBeNull()
    expect((await skill(child)).parentId).toBeNull()
  })
})

describe("compétences ↔ projets", () => {
  it("setProjectSkill : création avec valeurs par défaut puis mises à jour partielles ; removeProjectSkill", async () => {
    const user = await asNewUser()
    const project = await makeProject(user.id, (await makeClient(user.id)).id)
    const s = await createSkill({ ...base, name: "Next.js" })

    await setProjectSkill(project.id, s, {})
    const key = { projectId_skillId: { projectId: project.id, skillId: s } }
    expect(await prisma.projectSkill.findUniqueOrThrow({ where: key })).toMatchObject({ version: null, role: "USED", core: false, note: null })

    await setProjectSkill(project.id, s, { role: "TO_ACQUIRE", note: "  à creuser " })
    await setProjectSkill(project.id, s, { role: undefined })
    expect(await prisma.projectSkill.findUniqueOrThrow({ where: key })).toMatchObject({ role: "USED", note: "à creuser" })

    await setProjectSkill(project.id, s, { version: "  ", note: null })
    expect(await prisma.projectSkill.findUniqueOrThrow({ where: key })).toMatchObject({ version: null, note: null })

    await removeProjectSkill(project.id, s)
    expect(await prisma.projectSkill.count()).toBe(0)
  })

  it("removeProjectSkill sur le projet d'un autre compte : la liaison reste", async () => {
    const owner = await asNewUser()
    const project = await makeProject(owner.id, (await makeClient(owner.id)).id)
    const s = await createSkill({ ...base, name: "Go" })
    await setProjectSkill(project.id, s, { version: "1.22" })

    await asNewUser()
    await removeProjectSkill(project.id, s)
    expect(await prisma.projectSkill.count()).toBe(1)
  })

  it("linkOrCreateProjectSkill : nom vide ignoré, famille devinée, choisie ou complétée, version conservée", async () => {
    const user = await asNewUser()
    const project = await makeProject(user.id, (await makeClient(user.id)).id)

    await linkOrCreateProjectSkill(project.id, "   ")
    expect(await prisma.skill.count()).toBe(0)

    // Famille choisie explicitement : prioritaire, même sur une compétence existante.
    const existing = await createSkill({ ...base, name: "Outil Maison" })
    await linkOrCreateProjectSkill(project.id, "outil maison", { family: "TOOL", version: " 2 ", core: true })
    expect((await skill(existing)).family).toBe("TOOL")
    const link = await prisma.projectSkill.findFirstOrThrow({ where: { skillId: existing } })
    expect(link).toMatchObject({ version: "2", core: true, role: "USED" })

    // Relier à nouveau SANS version : la version existante est conservée.
    await linkOrCreateProjectSkill(project.id, "Outil Maison")
    expect((await prisma.projectSkill.findFirstOrThrow({ where: { skillId: existing } })).version).toBe("2")
    // Version explicite vide → effacée.
    await linkOrCreateProjectSkill(project.id, "Outil Maison", { version: null })
    expect((await prisma.projectSkill.findFirstOrThrow({ where: { skillId: existing } })).version).toBeNull()

    // Compétence existante sans famille + nom reconnu → la famille devinée comble le trou.
    const pg = await createSkill({ ...base, name: "PostgreSQL" })
    expect((await skill(pg)).family).toBeNull()
    await linkOrCreateProjectSkill(project.id, "postgresql")
    expect((await skill(pg)).family).not.toBeNull()
    expect(await prisma.skill.count({ where: { userId: user.id } })).toBe(2)
  })

  it("linkOrCreateProjectSkill refuse le projet d'un autre compte sans créer de compétence", async () => {
    const owner = await asNewUser()
    const project = await makeProject(owner.id, (await makeClient(owner.id)).id)
    await asNewUser()
    await expect(linkOrCreateProjectSkill(project.id, "Rust")).rejects.toThrow(/Projet introuvable/)
    expect(await prisma.skill.count()).toBe(0)
  })
})

describe("compétences ↔ entretiens", () => {
  it("lie par nom (création à la volée, insensible à la casse, idempotent) puis délie", async () => {
    const user = await asNewUser()
    const app = await makeJobApplication(user.id)
    const kotlin = await createSkill({ ...base, name: "Kotlin" })

    await linkOrCreateJobApplicationSkill(app.id, "   ")
    await linkOrCreateJobApplicationSkill(app.id, "kotlin")
    await linkOrCreateJobApplicationSkill(app.id, "KOTLIN")
    await linkOrCreateJobApplicationSkill(app.id, "Spring Boot")

    const links = await prisma.jobApplicationSkill.findMany({ where: { applicationId: app.id }, include: { skill: true } })
    expect(links.map((l) => l.skill.name).sort()).toEqual(["Kotlin", "Spring Boot"])
    expect(links.find((l) => l.skill.name === "Kotlin")!.skillId).toBe(kotlin)
    expect((await prisma.skill.findFirstOrThrow({ where: { name: "Spring Boot" } })).status).toBe("TO_ACQUIRE")

    await removeJobApplicationSkill(app.id, kotlin)
    expect(await prisma.jobApplicationSkill.count({ where: { applicationId: app.id } })).toBe(1)
  })

  it("entretien d'un autre compte : ni liaison ni déliaison", async () => {
    const owner = await asNewUser()
    const app = await makeJobApplication(owner.id)
    await linkOrCreateJobApplicationSkill(app.id, "Java")
    const java = await prisma.skill.findFirstOrThrow({ where: { name: "Java" } })

    await asNewUser()
    await expect(linkOrCreateJobApplicationSkill(app.id, "Scala")).rejects.toThrow(/Entretien introuvable/)
    await removeJobApplicationSkill(app.id, java.id)
    expect(await prisma.jobApplicationSkill.count()).toBe(1)
    expect(await prisma.skill.count()).toBe(1)
  })
})

describe("questions techniques", () => {
  it("création avec compétences (dédoublonnées, créées à la volée) et entretien possédé ; mise à jour et suppression", async () => {
    const user = await asNewUser()
    const app = await makeJobApplication(user.id)
    const react = await createSkill({ ...base, name: "React" })

    const qid = await createInterviewQuestion({
      question: "  Qu'est-ce qu'un hook ? ",
      answer: "  Une fonction ",
      difficulty: 2,
      applicationId: app.id,
      skillNames: ["react", " React ", "", "Hooks"],
    })
    let q = await prisma.interviewQuestion.findUniqueOrThrow({ where: { id: qid }, include: { skills: true } })
    expect(q).toMatchObject({ question: "Qu'est-ce qu'un hook ?", answer: "Une fonction", difficulty: 2, status: "TO_REVIEW", applicationId: app.id })
    expect(q.skills.map((s) => s.skillId)).toContain(react)
    expect(q.skills).toHaveLength(2)

    // skillNames absent → liens intacts ; entretien d'un autre compte → ignoré (null).
    const foreign = await makeJobApplication((await makeUser()).id)
    await updateInterviewQuestion(qid, { question: "Hook ?", status: "REVIEWED", applicationId: foreign.id })
    q = await prisma.interviewQuestion.findUniqueOrThrow({ where: { id: qid }, include: { skills: true } })
    expect(q).toMatchObject({ question: "Hook ?", answer: null, difficulty: null, status: "REVIEWED", applicationId: null })
    expect(q.skills).toHaveLength(2)

    // Liste vide → tous les liens retirés.
    await updateInterviewQuestion(qid, { question: "Hook ?", skillNames: [] })
    expect(await prisma.questionSkill.count({ where: { questionId: qid } })).toBe(0)

    await setQuestionStatus(qid, "REVIEWED")
    expect((await prisma.interviewQuestion.findUniqueOrThrow({ where: { id: qid } })).status).toBe("REVIEWED")

    await expect(createInterviewQuestion({ question: "  " })).rejects.toThrow(/Question requise/)
    await expect(updateInterviewQuestion(qid, { question: "" })).rejects.toThrow(/Question requise/)

    await deleteInterviewQuestion(qid)
    expect(await prisma.interviewQuestion.count()).toBe(0)
  })

  it("question d'un autre compte : ni modifiée, ni re-statuée, ni supprimée", async () => {
    await asNewUser()
    const qid = await createInterviewQuestion({ question: "Q privée", skillNames: ["SQL"] })

    await asNewUser()
    await expect(updateInterviewQuestion(qid, { question: "pwn", skillNames: [] })).rejects.toThrow(/introuvable/)
    await setQuestionStatus(qid, "REVIEWED")
    await deleteInterviewQuestion(qid)

    const q = await prisma.interviewQuestion.findUniqueOrThrow({ where: { id: qid }, include: { skills: true } })
    expect(q).toMatchObject({ question: "Q privée", status: "TO_REVIEW" })
    expect(q.skills).toHaveLength(1)
  })
})

describe("scheduleSkillWork", () => {
  it("crée une tâche datée liée à la compétence ; durée depuis le créneau ; libellé en suffixe", async () => {
    const user = await asNewUser()
    const s = await createSkill({ ...base, name: "Kubernetes" })

    await scheduleSkillWork(s, { date: "2026-10-05", startTime: "09:00", endTime: "10:30", label: "  chapitre 3 " })
    await scheduleSkillWork(s, { date: "2026-10-06" })
    await scheduleSkillWork(s, { date: "2026-10-07", startTime: "14:00", endTime: "13:00" })

    const tasks = await prisma.task.findMany({ where: { skillId: s }, orderBy: { dueDate: "asc" } })
    expect(tasks).toHaveLength(3)
    expect(tasks[0]).toMatchObject({ userId: user.id, title: "Travailler : Kubernetes — chapitre 3", status: "TODO", priority: "MEDIUM", estimatedHours: 1.5 })
    expect(zonedDateKey(tasks[0].dueDate!)).toBe("2026-10-05")
    expect(tasks[1]).toMatchObject({ title: "Travailler : Kubernetes", estimatedHours: null })
    expect(zonedDateKey(tasks[1].dueDate!)).toBe("2026-10-06")
    expect(tasks[2].estimatedHours).toBeNull() // fin avant début → pas de durée
  })

  it("refuse une date invalide et la compétence d'un autre compte", async () => {
    await asNewUser()
    const s = await createSkill({ ...base, name: "Rust" })
    await expect(scheduleSkillWork(s, { date: "pas-une-date" })).rejects.toThrow(/Date invalide/)

    await asNewUser()
    await expect(scheduleSkillWork(s, { date: "2026-10-05" })).rejects.toThrow(/Compétence introuvable/)
    expect(await prisma.task.count()).toBe(0)
  })

  // Régression corrigée le 29/09/2026 (src/actions/competences.ts:370) — `new Date("2026-10-05T09:00:00")` est
  // lu dans le fuseau du PROCESS : en production (UTC) le créneau « 09:00 » est
  // stocké à 09:00 UTC, soit 11:00 à Paris. Il faudrait parseCivilDate/zonedInstant.
  it("le créneau 09:00 est à 09:00 heure de Paris", async () => {
    await asNewUser()
    const s = await createSkill({ ...base, name: "Terraform" })
    await scheduleSkillWork(s, { date: "2026-10-05", startTime: "09:00" })
    const task = await prisma.task.findFirstOrThrow({ where: { skillId: s } })
    expect(zonedParts(task.dueDate!).hour).toBe(9)
  })
})
