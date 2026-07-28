"use server"

import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import type { SkillType, SkillStatus, ProjectSkillRole } from "@/generated/prisma/enums"

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

// parentId n'est retenu que s'il appartient à l'utilisateur et n'est pas le nœud
// lui-même (anti-IDOR + anti-cycle direct).
async function ownedParentId(userId: string, parentId?: string | null, selfId?: string): Promise<string | null> {
  if (!parentId || parentId === selfId) return null
  const p = await prisma.skill.findFirst({ where: { id: parentId, userId }, select: { id: true } })
  return p?.id ?? null
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
