"use server"

import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import type { SkillType, SkillStatus, ProjectSkillRole, QuestionStatus, SkillFamily } from "@/generated/prisma/enums"
import { suggestFamily } from "@/lib/tech-icons"
import { syncTaskGoogleState } from "@/lib/google-task-sync"

async function requireAuth() {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Non authentifié")
  return session.user.id
}

function revalidateSkillPaths() {
  revalidatePath("/competences")
  revalidatePath("/graph")
}

const clampLevel = (n?: number | null) => Math.max(0, Math.min(5, Math.round(n ?? 0)))

export type SkillInput = {
  name: string
  type: SkillType
  parentId?: string | null
  level: number
  targetVersion?: string | null
  status: SkillStatus
  yearsExperience?: number | null
  notes?: string | null
}

// parentId n'est retenu que s'il appartient à l'utilisateur (anti-IDOR) et ne crée pas
// de cycle : ni le nœud lui-même, ni un de ses descendants ne peut devenir son parent
// (sinon le sous-arbre deviendrait orphelin/invisible).
async function ownedParentId(userId: string, parentId?: string | null, selfId?: string): Promise<string | null> {
  if (!parentId || parentId === selfId) return null
  const p = await prisma.skill.findFirst({ where: { id: parentId, userId }, select: { id: true } })
  if (!p) return null
  if (selfId) {
    // Remonte la chaîne des parents depuis `parentId` ; si on retombe sur `selfId`,
    // alors `parentId` est un descendant de `selfId` → cycle interdit.
    const all = await prisma.skill.findMany({ where: { userId }, select: { id: true, parentId: true } })
    const parentOf = new Map(all.map((s) => [s.id, s.parentId]))
    const seen = new Set<string>()
    let cur: string | null | undefined = parentId
    while (cur) {
      if (cur === selfId) throw new Error("Déplacement impossible : cycle")
      if (seen.has(cur)) break
      seen.add(cur)
      cur = parentOf.get(cur)
    }
  }
  return p.id
}

export async function createSkill(input: SkillInput): Promise<string> {
  const userId = await requireAuth()
  const name = input.name.trim()
  if (!name) throw new Error("Nom de compétence requis")
  const skill = await prisma.skill.create({
    data: {
      userId, name,
      parentId: await ownedParentId(userId, input.parentId),
      type: input.type,
      level: clampLevel(input.level),
      targetVersion: input.targetVersion?.trim() || null,
      status: input.status,
      yearsExperience: input.yearsExperience ?? null,
      notes: input.notes?.trim() || null,
    },
  })
  revalidateSkillPaths()
  return skill.id
}

export async function updateSkill(id: string, input: SkillInput): Promise<void> {
  const userId = await requireAuth()
  const name = input.name.trim()
  if (!name) throw new Error("Nom de compétence requis")
  const { count } = await prisma.skill.updateMany({
    where: { id, userId },
    data: {
      name,
      parentId: await ownedParentId(userId, input.parentId, id),
      type: input.type,
      level: clampLevel(input.level),
      targetVersion: input.targetVersion?.trim() || null,
      status: input.status,
      yearsExperience: input.yearsExperience ?? null,
      notes: input.notes?.trim() || null,
    },
  })
  if (count === 0) throw new Error("Compétence introuvable")
  revalidateSkillPaths()
}

export async function deleteSkill(id: string): Promise<void> {
  const userId = await requireAuth()
  // Les enfants ne sont PAS supprimés : la FK parentId est en SetNull → ils
  // remontent en racine (on ne perd pas un sous-arbre en supprimant une catégorie).
  await prisma.skill.deleteMany({ where: { id, userId } })
  revalidateSkillPaths()
}

/**
 * Reparente une compétence sans repasser par le formulaire complet (déplacement
 * rapide dans l'arbre). Scopé userId (anti-IDOR) + anti-cycle profond via ownedParentId.
 */
export async function moveSkill(id: string, parentId: string | null): Promise<void> {
  const userId = await requireAuth()
  const validParent = await ownedParentId(userId, parentId, id)
  const { count } = await prisma.skill.updateMany({ where: { id, userId }, data: { parentId: validParent } })
  if (count === 0) throw new Error("Compétence introuvable")
  revalidateSkillPaths()
}

/**
 * Modification partielle pour les quick-actions inline (statut / niveau / renommage)
 * sans réécrire tout l'objet. Scopé userId (anti-IDOR).
 */
export async function patchSkill(
  id: string,
  patch: { status?: SkillStatus; level?: number; name?: string; family?: SkillFamily | null },
): Promise<void> {
  const userId = await requireAuth()
  const data: Record<string, unknown> = {}
  if (patch.status) data.status = patch.status
  if (patch.level !== undefined) data.level = clampLevel(patch.level)
  if (patch.family !== undefined) data.family = patch.family
  if (patch.name !== undefined) {
    const n = patch.name.trim()
    if (!n) throw new Error("Nom de compétence requis")
    data.name = n
  }
  if (Object.keys(data).length === 0) return
  const { count } = await prisma.skill.updateMany({ where: { id, userId }, data })
  if (count === 0) throw new Error("Compétence introuvable")
  revalidateSkillPaths()
}

// ── Liaison Projet ↔ Compétence ──────────────────────────────────────────────

export async function setProjectSkill(
  projectId: string,
  skillId: string,
  opts: { version?: string | null; role?: ProjectSkillRole; note?: string | null },
): Promise<void> {
  const userId = await requireAuth()
  const [proj, skill] = await Promise.all([
    prisma.project.findFirst({ where: { id: projectId, userId }, select: { id: true } }),
    prisma.skill.findFirst({ where: { id: skillId, userId }, select: { id: true } }),
  ])
  if (!proj || !skill) throw new Error("Projet ou compétence introuvable")
  await prisma.projectSkill.upsert({
    where: { projectId_skillId: { projectId, skillId } },
    create: { projectId, skillId, version: opts.version?.trim() || null, role: opts.role ?? "USED", note: opts.note?.trim() || null },
    update: { version: opts.version?.trim() || null, role: opts.role ?? "USED", note: opts.note?.trim() || null },
  })
  revalidateSkillPaths()
  revalidatePath(`/projets/${projectId}`)
}

export async function removeProjectSkill(projectId: string, skillId: string): Promise<void> {
  const userId = await requireAuth()
  // Scopé par propriétaire via la relation project.userId (anti-IDOR).
  await prisma.projectSkill.deleteMany({ where: { projectId, skillId, project: { userId } } })
  revalidateSkillPaths()
  revalidatePath(`/projets/${projectId}`)
}

/**
 * Lie une compétence à un projet par son NOM — la crée si elle n'existe pas (type
 * HARD par défaut). Réutilise findOrCreateSkillId ; ne réécrase pas une liaison
 * existante (version conservée). Scopé userId via le projet (anti-IDOR).
 */
export async function linkOrCreateProjectSkill(projectId: string, name: string, opts?: { version?: string | null }): Promise<void> {
  const userId = await requireAuth()
  const trimmed = name.trim()
  if (!trimmed) return
  const proj = await prisma.project.findFirst({ where: { id: projectId, userId }, select: { id: true } })
  if (!proj) throw new Error("Projet introuvable")
  // Résolution de la compétence par nom, en renseignant la famille (front/back/devops…)
  // à la création — ou sur une compétence existante encore non classée.
  const fam = suggestFamily(trimmed)
  let existing = await prisma.skill.findFirst({
    where: { userId, name: { equals: trimmed, mode: "insensitive" } },
    select: { id: true, family: true },
  })
  if (!existing) {
    existing = await prisma.skill.create({
      data: { userId, name: trimmed, type: "HARD", status: "TO_ACQUIRE", family: fam ?? undefined },
      select: { id: true, family: true },
    })
  } else if (!existing.family && fam) {
    await prisma.skill.update({ where: { id: existing.id }, data: { family: fam } })
  }
  const skillId = existing.id
  await prisma.projectSkill.upsert({
    where: { projectId_skillId: { projectId, skillId } },
    create: { projectId, skillId, version: opts?.version?.trim() || null, role: "USED" },
    update: opts?.version !== undefined ? { version: opts.version?.trim() || null } : {},
  })
  revalidateSkillPaths()
  revalidatePath(`/projets/${projectId}`)
}

// ── Liaison Entretien ↔ Compétence (stack demandée par le poste) ──────────────

/** Lie une compétence à un entretien par son NOM — la crée si elle n'existe pas encore. */
export async function linkOrCreateJobApplicationSkill(applicationId: string, name: string): Promise<void> {
  const userId = await requireAuth()
  const trimmed = name.trim()
  if (!trimmed) return
  const app = await prisma.jobApplication.findFirst({ where: { id: applicationId, userId }, select: { id: true } })
  if (!app) throw new Error("Entretien introuvable")
  let skill = await prisma.skill.findFirst({
    where: { userId, name: { equals: trimmed, mode: "insensitive" } },
    select: { id: true },
  })
  if (!skill) {
    skill = await prisma.skill.create({
      data: { userId, name: trimmed, type: "HARD", status: "TO_ACQUIRE" },
      select: { id: true },
    })
  }
  await prisma.jobApplicationSkill.upsert({
    where: { applicationId_skillId: { applicationId, skillId: skill.id } },
    create: { applicationId, skillId: skill.id },
    update: {},
  })
  revalidateSkillPaths()
  revalidatePath(`/entretiens/${applicationId}`)
}

export async function removeJobApplicationSkill(applicationId: string, skillId: string): Promise<void> {
  const userId = await requireAuth()
  await prisma.jobApplicationSkill.deleteMany({ where: { applicationId, skillId, application: { userId } } })
  revalidateSkillPaths()
  revalidatePath(`/entretiens/${applicationId}`)
}

// ── Questions techniques (d'entretien / de culture) ───────────────────────────

async function findOrCreateSkillId(userId: string, name: string): Promise<string> {
  const trimmed = name.trim()
  const existing = await prisma.skill.findFirst({
    where: { userId, name: { equals: trimmed, mode: "insensitive" } },
    select: { id: true },
  })
  if (existing) return existing.id
  const created = await prisma.skill.create({
    data: { userId, name: trimmed, type: "HARD", status: "TO_ACQUIRE" },
    select: { id: true },
  })
  return created.id
}

// Remplace les compétences liées à une question par la liste fournie (par nom,
// création à la volée). `undefined` = ne touche pas aux liens existants.
async function syncQuestionSkills(userId: string, questionId: string, skillNames?: string[]) {
  if (skillNames === undefined) return
  const names = [...new Set(skillNames.map((n) => n.trim()).filter(Boolean))]
  await prisma.questionSkill.deleteMany({ where: { questionId } })
  const skillIds = new Set<string>()
  for (const name of names) skillIds.add(await findOrCreateSkillId(userId, name))
  if (skillIds.size) {
    await prisma.questionSkill.createMany({
      data: [...skillIds].map((skillId) => ({ questionId, skillId })),
      skipDuplicates: true,
    })
  }
}

async function ownedApplicationId(userId: string, applicationId?: string | null): Promise<string | null> {
  if (!applicationId) return null
  const a = await prisma.jobApplication.findFirst({ where: { id: applicationId, userId }, select: { id: true } })
  return a?.id ?? null
}

export type QuestionInput = {
  question: string
  answer?: string | null
  difficulty?: number | null   // 1 facile · 2 moyen · 3 difficile
  status?: QuestionStatus
  applicationId?: string | null
  skillNames?: string[]
}

export async function createInterviewQuestion(input: QuestionInput): Promise<string> {
  const userId = await requireAuth()
  const question = input.question.trim()
  if (!question) throw new Error("Question requise")
  const created = await prisma.interviewQuestion.create({
    data: {
      userId, question,
      answer: input.answer?.trim() || null,
      difficulty: input.difficulty ?? null,
      status: input.status ?? "TO_REVIEW",
      applicationId: await ownedApplicationId(userId, input.applicationId),
    },
    select: { id: true },
  })
  await syncQuestionSkills(userId, created.id, input.skillNames)
  revalidateSkillPaths()
  revalidatePath("/competences/questions")
  if (input.applicationId) revalidatePath(`/entretiens/${input.applicationId}`)
  return created.id
}

export async function updateInterviewQuestion(id: string, input: QuestionInput): Promise<void> {
  const userId = await requireAuth()
  const question = input.question.trim()
  if (!question) throw new Error("Question requise")
  const { count } = await prisma.interviewQuestion.updateMany({
    where: { id, userId },
    data: {
      question,
      answer: input.answer?.trim() || null,
      difficulty: input.difficulty ?? null,
      status: input.status ?? "TO_REVIEW",
      applicationId: await ownedApplicationId(userId, input.applicationId),
    },
  })
  if (count === 0) throw new Error("Question introuvable")
  await syncQuestionSkills(userId, id, input.skillNames)
  revalidateSkillPaths()
  revalidatePath("/competences/questions")
}

export async function deleteInterviewQuestion(id: string): Promise<void> {
  const userId = await requireAuth()
  await prisma.interviewQuestion.deleteMany({ where: { id, userId } })
  revalidateSkillPaths()
  revalidatePath("/competences/questions")
}

export async function setQuestionStatus(id: string, status: QuestionStatus): Promise<void> {
  const userId = await requireAuth()
  await prisma.interviewQuestion.updateMany({ where: { id, userId }, data: { status } })
  revalidatePath("/competences/questions")
}

// ── « Travailler cette compétence » : crée un créneau (tâche datée) ────────────

/**
 * Programme un créneau de travail sur une compétence : crée une tâche datée
 * (liée à la compétence) qui remonte dans les tâches, le calendrier et l'agenda
 * Google (best-effort). `startTime`/`endTime` au format "HH:mm".
 */
export async function scheduleSkillWork(
  skillId: string,
  opts: { date: string; startTime?: string; endTime?: string; label?: string },
): Promise<void> {
  const userId = await requireAuth()
  const skill = await prisma.skill.findFirst({ where: { id: skillId, userId }, select: { id: true, name: true } })
  if (!skill) throw new Error("Compétence introuvable")

  const start = new Date(`${opts.date}T${(opts.startTime || "09:00")}:00`)
  if (Number.isNaN(start.getTime())) throw new Error("Date invalide")
  // Durée estimée si un créneau de fin est fourni.
  let estimatedHours: number | null = null
  if (opts.startTime && opts.endTime) {
    const [sh, sm] = opts.startTime.split(":").map(Number)
    const [eh, em] = opts.endTime.split(":").map(Number)
    const mins = (eh * 60 + em) - (sh * 60 + sm)
    if (mins > 0) estimatedHours = Math.round((mins / 60) * 100) / 100
  }

  const suffix = opts.label?.trim() ? ` — ${opts.label.trim()}` : ""
  const task = await prisma.task.create({
    data: {
      userId, skillId,
      title: `Travailler : ${skill.name}${suffix}`,
      status: "TODO", priority: "MEDIUM",
      dueDate: start, estimatedHours,
    },
    select: { id: true },
  })

  // Synchro Google best-effort (ne bloque jamais).
  try { await syncTaskGoogleState(userId, task.id) } catch { /* best-effort */ }

  revalidatePath("/competences")
  revalidatePath(`/competences/${skillId}`)
  revalidatePath("/taches")
  revalidatePath("/calendrier")
}
