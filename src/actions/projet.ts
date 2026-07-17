"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { auth } from "@/lib/auth"
import {
  syncTaskGoogleState, removeTaskFromGoogle,
  syncMilestoneGoogleState, removeMilestoneFromGoogle,
} from "@/lib/google-task-sync"
import { sendPushToUser } from "@/lib/push"

async function requireAuth(): Promise<string> {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Non autorisé")
  return session.user.id
}

// ── ProjectIdeas ──────────────────────────────────────────────────────────────

export async function createProjectIdea(_userId: string, title: string) {
  const userId = await requireAuth()
  const idea = await prisma.projectIdea.create({
    data: { userId, title, content: "" },
  })
  revalidatePath("/projets")
  return idea
}

export async function updateProjectIdea(ideaId: string, _userId: string, data: { title?: string; content?: string }) {
  const userId = await requireAuth()
  await prisma.projectIdea.update({
    where: { id: ideaId, userId },
    data,
  })
  revalidatePath("/projets")
}

export async function deleteProjectIdea(ideaId: string, _userId: string) {
  const userId = await requireAuth()
  await prisma.projectIdea.delete({ where: { id: ideaId, userId } })
  revalidatePath("/projets")
}

export async function convertIdeaToProject(
  ideaId: string,
  _userId: string,
  companyId: string | null,
  deleteIdea: boolean
) {
  const userId = await requireAuth()
  const idea = await prisma.projectIdea.findUnique({ where: { id: ideaId, userId } })
  if (!idea) throw new Error("Idée introuvable")

  const project = await prisma.project.create({
    data: {
      userId,
      companyId: companyId || null,
      name: idea.title,
      description: idea.content ? idea.content.slice(0, 300) : null,
    },
  })

  if (deleteIdea) {
    await prisma.projectIdea.delete({ where: { id: ideaId } })
  }

  revalidatePath("/projets")
  return project
}

// ── Projects ──────────────────────────────────────────────────────────────────

const CreateProjectSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  companyId: z.string().optional(),
  contactId: z.string().optional(),
  category: z.enum(["DEV", "ETUDE", "EVENEMENTIEL", "FORMATION", "PROSPECTION", "AUTRE"]).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  estimatedHours: z.coerce.number().optional(),
})

export async function createProject(_userId: string, formData: FormData) {
  const userId = await requireAuth()
  const parsed = CreateProjectSchema.parse(Object.fromEntries(formData))
  const contactId = parsed.contactId || null
  const project = await prisma.project.create({
    data: {
      userId,
      companyId: parsed.companyId || null,
      // clientId conservé pour compat facturation (Phase 2 le retirera)
      clientId: contactId,
      name: parsed.name,
      description: parsed.description,
      category: parsed.category ?? "AUTRE",
      startDate: parsed.startDate ? new Date(parsed.startDate) : undefined,
      endDate: parsed.endDate ? new Date(parsed.endDate) : undefined,
      estimatedHours: parsed.estimatedHours,
      // Crée le lien M2M si un contact est fourni
      ...(contactId ? {
        contactLinks: { create: { clientId: contactId, role: "CLIENT" } },
      } : {}),
    },
  })
  revalidatePath("/projets")
  return project
}

export async function updateProjectCompany(projectId: string, companyId: string | null) {
  const userId = await requireAuth()
  if (companyId) {
    const co = await prisma.company.findFirst({ where: { id: companyId, userId }, select: { id: true } })
    if (!co) throw new Error("Société introuvable")
  }
  await prisma.project.findFirstOrThrow({ where: { id: projectId, userId } })
  await prisma.project.update({ where: { id: projectId }, data: { companyId } })
  revalidatePath(`/projets/${projectId}`)
  revalidatePath("/projets")
}

/**
 * Ajoute un contact au projet avec un rôle et un label optionnel.
 * Si le contact est déjà lié, met à jour son rôle/label.
 */
export async function addProjectContact(
  projectId: string,
  clientId: string,
  role: "CLIENT" | "COLLEAGUE" | "PARTNER" | "SUPPLIER" | "OTHER" = "OTHER",
  label?: string,
) {
  const userId = await requireAuth()
  await prisma.project.findFirstOrThrow({ where: { id: projectId, userId } })
  const contact = await prisma.client.findFirst({ where: { id: clientId, userId }, select: { id: true } })
  if (!contact) throw new Error("Contact introuvable")

  await prisma.projectContact.upsert({
    where: { projectId_clientId: { projectId, clientId } },
    create: { projectId, clientId, role, label: label || null },
    update: { role, label: label || null },
  })
  revalidatePath(`/projets/${projectId}`)
}

/**
 * Retire un contact du projet.
 */
export async function removeProjectContact(projectId: string, clientId: string) {
  const userId = await requireAuth()
  await prisma.project.findFirstOrThrow({ where: { id: projectId, userId } })
  await prisma.projectContact.deleteMany({ where: { projectId, clientId } })
  revalidatePath(`/projets/${projectId}`)
}

/** @deprecated Utiliser addProjectContact / removeProjectContact */
export async function updateProjectContact(projectId: string, contactId: string | null) {
  if (contactId) {
    await addProjectContact(projectId, contactId, "CLIENT")
  } else {
    // Retire tous les contacts de rôle CLIENT si on efface
    const userId = await requireAuth()
    await prisma.project.findFirstOrThrow({ where: { id: projectId, userId } })
    await prisma.projectContact.deleteMany({ where: { projectId, role: "CLIENT" } })
    revalidatePath(`/projets/${projectId}`)
  }
}

export async function updateProjectStatus(
  projectId: string,
  status: "ACTIVE" | "PAUSED" | "COMPLETED" | "ARCHIVED"
) {
  const userId = await requireAuth()
  await prisma.project.findFirstOrThrow({ where: { id: projectId, userId } })
  await prisma.project.update({ where: { id: projectId }, data: { status } })
  revalidatePath("/projets")
  revalidatePath(`/projets/${projectId}`)
}

export async function updateProjectCategory(
  projectId: string,
  category: "DEV" | "ETUDE" | "EVENEMENTIEL" | "FORMATION" | "PROSPECTION" | "AUTRE"
) {
  const userId = await requireAuth()
  await prisma.project.findFirstOrThrow({ where: { id: projectId, userId } })
  await prisma.project.update({ where: { id: projectId }, data: { category } })
  revalidatePath("/projets")
  revalidatePath(`/projets/${projectId}`)
}

export async function updateProjectPriority(
  projectId: string,
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT"
) {
  const userId = await requireAuth()
  await prisma.project.findFirstOrThrow({ where: { id: projectId, userId } })
  await prisma.project.update({ where: { id: projectId }, data: { priority } })
  revalidatePath("/projets")
  revalidatePath(`/projets/${projectId}`)
}

export async function deleteProject(projectId: string, _userId: string) {
  const userId = await requireAuth()
  await prisma.project.delete({ where: { id: projectId, userId } })
  revalidatePath("/projets")
}

export async function updateProjectInfo(
  projectId: string,
  data: { name?: string; description?: string | null; estimatedHours?: number | null }
) {
  const userId = await requireAuth()
  await prisma.project.findFirstOrThrow({ where: { id: projectId, userId } })
  await prisma.project.update({ where: { id: projectId }, data })
  revalidatePath(`/projets/${projectId}`)
  revalidatePath("/projets")
}

export async function updateProjectDates(
  projectId: string,
  data: { startDate?: string; endDate?: string; estimatedHours?: number }
) {
  const userId = await requireAuth()
  await prisma.project.findFirstOrThrow({ where: { id: projectId, userId } })
  await prisma.project.update({
    where: { id: projectId },
    data: {
      startDate: data.startDate ? new Date(data.startDate) : undefined,
      endDate: data.endDate ? new Date(data.endDate) : undefined,
      estimatedHours: data.estimatedHours,
    },
  })
  revalidatePath(`/projets/${projectId}`)
}

// ── Tasks ──────────────────────────────────────────────────────────────────

const TaskSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  milestoneId: z.string().optional(),
  parentTaskId: z.string().optional(),
  estimatedHours: z.coerce.number().optional(),
  dueDate: z.string().optional(),
})

export async function createTask(projectId: string, formData: FormData) {
  const userId = await requireAuth()
  const proj = await prisma.project.findFirst({ where: { id: projectId, userId }, select: { id: true } })
  if (!proj) throw new Error("Projet introuvable")
  const parsed = TaskSchema.parse(Object.fromEntries(formData))
  const task = await prisma.task.create({
    data: {
      userId,
      projectId,
      title: parsed.title,
      description: parsed.description,
      milestoneId: parsed.milestoneId || null,
      parentTaskId: parsed.parentTaskId || null,
      estimatedHours: parsed.estimatedHours,
      dueDate: parsed.dueDate ? new Date(parsed.dueDate) : undefined,
    },
  })
  await syncTaskGoogleState(userId, task.id)
  revalidatePath(`/projets/${projectId}`)
  revalidatePath("/taches")
  return task
}

/** Tâche autonome liée à un client (ou sans contexte si clientId est null) */
export async function createClientTask(
  clientId: string | null,
  title: string,
  dueDate?: string | null,
  priority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT"
) {
  const userId = await requireAuth()
  if (clientId) {
    const client = await prisma.client.findFirst({ where: { id: clientId, userId }, select: { id: true } })
    if (!client) throw new Error("Client introuvable")
  }
  const task = await prisma.task.create({
    data: {
      userId,
      clientId: clientId || null,
      title: title.trim(),
      dueDate: dueDate ? new Date(dueDate) : null,
      ...(priority ? { priority } : {}),
    },
  })
  await syncTaskGoogleState(userId, task.id)
  revalidatePath("/taches")
  if (clientId) revalidatePath(`/contacts/${clientId}`)
  return task
}

/** Helper d'ownership universel : projet OU userId direct */
async function requireTaskOwnership(taskId: string, userId: string) {
  const task = await prisma.task.findFirst({
    where: {
      id: taskId,
      OR: [{ project: { userId } }, { userId }],
    },
    select: { id: true },
  })
  if (!task) throw new Error("Tâche introuvable")
  return task
}

export async function startTask(taskId: string, projectId: string) {
  const userId = await requireAuth()
  await requireTaskOwnership(taskId, userId)
  await prisma.task.update({
    where: { id: taskId },
    data: { status: "IN_PROGRESS", startedAt: new Date(), completedAt: null },
  })
  revalidatePath(`/projets/${projectId}`)
}

export async function completeTask(taskId: string, projectId: string) {
  const userId = await requireAuth()
  await requireTaskOwnership(taskId, userId)
  await prisma.task.update({
    where: { id: taskId },
    data: { status: "DONE", completedAt: new Date() },
  })
  revalidatePath(`/projets/${projectId}`)
}

export async function completeTaskGlobal(taskId: string) {
  const userId = await requireAuth()
  await requireTaskOwnership(taskId, userId)
  await prisma.task.update({
    where: { id: taskId },
    data: { status: "DONE", completedAt: new Date() },
  })
  revalidatePath("/")
  revalidatePath("/taches")
}

export async function reopenTask(taskId: string, projectId: string) {
  const userId = await requireAuth()
  await requireTaskOwnership(taskId, userId)
  await prisma.task.update({
    where: { id: taskId },
    data: { status: "TODO", startedAt: null, completedAt: null },
  })
  revalidatePath(`/projets/${projectId}`)
}

/** Marque une tâche comme annulée, avec une raison optionnelle en note libre. */
export async function cancelTask(taskId: string, projectId?: string, reason?: string) {
  const userId = await requireAuth()
  await requireTaskOwnership(taskId, userId)
  await prisma.task.update({
    where: { id: taskId },
    data: { status: "CANCELLED", outcome: reason?.trim() || null },
  })
  if (projectId) revalidatePath(`/projets/${projectId}`)
  revalidatePath("/")
  revalidatePath("/taches")
}

/** Annule l'annulation d'une tâche : la repasse à faire. */
export async function uncancelTask(taskId: string, projectId?: string) {
  const userId = await requireAuth()
  await requireTaskOwnership(taskId, userId)
  await prisma.task.update({
    where: { id: taskId },
    data: { status: "TODO", outcome: null },
  })
  if (projectId) revalidatePath(`/projets/${projectId}`)
  revalidatePath("/")
  revalidatePath("/taches")
}

export async function updateTaskTitle(taskId: string, projectId: string, title: string) {
  const userId = await requireAuth()
  await requireTaskOwnership(taskId, userId)
  if (!title.trim()) return
  await prisma.task.update({ where: { id: taskId }, data: { title: title.trim() } })
  revalidatePath(`/projets/${projectId}`)
}

export async function updateTaskDescription(taskId: string, projectId: string, description: string | null) {
  const userId = await requireAuth()
  await requireTaskOwnership(taskId, userId)
  await prisma.task.update({ where: { id: taskId }, data: { description: description?.trim() || null } })
  revalidatePath(`/projets/${projectId}`)
}

export async function updateTaskEstimatedHours(taskId: string, projectId: string, hours: number | null) {
  const userId = await requireAuth()
  await requireTaskOwnership(taskId, userId)
  await prisma.task.update({ where: { id: taskId }, data: { estimatedHours: hours } })
  revalidatePath(`/projets/${projectId}`)
}

export async function updateTaskDueDate(taskId: string, projectId: string, dueDate: string | null) {
  const userId = await requireAuth()
  await requireTaskOwnership(taskId, userId)
  await prisma.task.update({
    where: { id: taskId },
    data: { dueDate: dueDate ? new Date(dueDate) : null },
  })
  await syncTaskGoogleState(userId, taskId)
  revalidatePath(`/projets/${projectId}`)
}

export async function updateTaskCompletedAt(taskId: string, projectId: string, completedAt: string | null) {
  const userId = await requireAuth()
  await requireTaskOwnership(taskId, userId)
  await prisma.task.update({
    where: { id: taskId },
    data: { completedAt: completedAt ? new Date(completedAt) : null },
  })
  revalidatePath(`/projets/${projectId}`)
}

export async function updateTaskPriority(
  taskId: string,
  projectId: string,
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT"
) {
  const userId = await requireAuth()
  await requireTaskOwnership(taskId, userId)
  await prisma.task.update({ where: { id: taskId }, data: { priority } })
  revalidatePath(`/projets/${projectId}`)
}

export async function updateTaskImportance(taskId: string, projectId: string, importance: number) {
  const userId = await requireAuth()
  await requireTaskOwnership(taskId, userId)
  await prisma.task.update({
    where: { id: taskId },
    data: { importance: Math.max(1, Math.min(4, importance)) },
  })
  revalidatePath(`/projets/${projectId}`)
}

// ── TaskTags ──────────────────────────────────────────────────────────────────

export async function createTaskTag(projectId: string, name: string, color: string) {
  const userId = await requireAuth()
  const proj = await prisma.project.findFirst({ where: { id: projectId, userId }, select: { id: true } })
  if (!proj) throw new Error("Projet introuvable")
  await prisma.taskTag.upsert({
    where: { projectId_name: { projectId, name } },
    create: { projectId, name, color },
    update: { color },
  })
  revalidatePath(`/projets/${projectId}`)
}

export async function deleteTaskTag(tagId: string, projectId: string) {
  const userId = await requireAuth()
  const proj = await prisma.project.findFirst({ where: { id: projectId, userId }, select: { id: true } })
  if (!proj) throw new Error("Projet introuvable")
  await prisma.taskTag.delete({ where: { id: tagId, projectId } })
  revalidatePath(`/projets/${projectId}`)
}

export async function updateTaskTagColor(tagId: string, projectId: string, color: string) {
  const userId = await requireAuth()
  const proj = await prisma.project.findFirst({ where: { id: projectId, userId }, select: { id: true } })
  if (!proj) throw new Error("Projet introuvable")
  await prisma.taskTag.update({ where: { id: tagId }, data: { color } })
  revalidatePath(`/projets/${projectId}`)
}

export async function addTagToTask(taskId: string, tagId: string, projectId: string) {
  const userId = await requireAuth()
  const proj = await prisma.project.findFirst({ where: { id: projectId, userId }, select: { id: true } })
  if (!proj) throw new Error("Projet introuvable")
  await prisma.task.update({
    where: { id: taskId },
    data: { taskTags: { connect: { id: tagId } } },
  })
  revalidatePath(`/projets/${projectId}`)
}

export async function removeTagFromTask(taskId: string, tagId: string, projectId: string) {
  const userId = await requireAuth()
  const proj = await prisma.project.findFirst({ where: { id: projectId, userId }, select: { id: true } })
  if (!proj) throw new Error("Projet introuvable")
  await prisma.task.update({
    where: { id: taskId },
    data: { taskTags: { disconnect: { id: tagId } } },
  })
  revalidatePath(`/projets/${projectId}`)
}

/** Migration one-shot : convertit les anciennes tâches-groupe en TaskTags */
export async function migrateGroupsToTags(projectId: string) {
  const userId = await requireAuth()
  const proj = await prisma.project.findFirst({ where: { id: projectId, userId }, select: { id: true } })
  if (!proj) throw new Error("Projet introuvable")
  const groups = await prisma.task.findMany({
    where: { projectId, isGroup: true },
    include: { subTasks: { select: { id: true } } },
  })
  if (groups.length === 0) return

  for (const g of groups) {
    const tag = await prisma.taskTag.upsert({
      where: { projectId_name: { projectId, name: g.title } },
      create: { projectId, name: g.title, color: g.color ?? "#6366f1" },
      update: {},
    })
    // Détacher les sous-tâches et leur assigner le tag
    for (const sub of g.subTasks) {
      await prisma.task.update({
        where: { id: sub.id },
        data: { parentTaskId: null, taskTags: { connect: { id: tag.id } } },
      })
    }
    // Supprimer le groupe (deleteMany est idempotent — pas d'erreur si déjà supprimé)
    await prisma.task.deleteMany({ where: { id: g.id, isGroup: true } })
  }
  revalidatePath(`/projets/${projectId}`)
}

export async function reorderTasks(projectId: string, orderedTaskIds: string[]) {
  const userId = await requireAuth()
  const proj = await prisma.project.findFirst({ where: { id: projectId, userId }, select: { id: true } })
  if (!proj) throw new Error("Projet introuvable")
  if (orderedTaskIds.length === 0) return
  await prisma.$transaction(
    orderedTaskIds.map((id, index) =>
      prisma.task.update({ where: { id }, data: { order: index * 10 } })
    )
  )
  revalidatePath(`/projets/${projectId}`)
}

// Kept for subtask reordering (parentTaskId still used for real subtasks)
export async function reorderTasksInContainer(
  projectId: string,
  parentTaskId: string | null,
  orderedTaskIds: string[]
) {
  const userId = await requireAuth()
  const proj = await prisma.project.findFirst({ where: { id: projectId, userId }, select: { id: true } })
  if (!proj) throw new Error("Projet introuvable")
  if (orderedTaskIds.length === 0) return
  await prisma.$transaction(
    orderedTaskIds.map((id, index) =>
      prisma.task.update({ where: { id }, data: { order: index * 10, parentTaskId } })
    )
  )
  revalidatePath(`/projets/${projectId}`)
}

export async function reorderTask(taskId: string, projectId: string, direction: "up" | "down") {
  const userId = await requireAuth()
  const proj = await prisma.project.findFirst({ where: { id: projectId, userId }, select: { id: true } })
  if (!proj) throw new Error("Projet introuvable")
  const task = await prisma.task.findUnique({ where: { id: taskId } })
  if (!task) return
  const siblings = await prisma.task.findMany({
    where: { projectId, parentTaskId: task.parentTaskId },
    orderBy: { order: "asc" },
  })
  const idx = siblings.findIndex((t) => t.id === taskId)
  const swapIdx = direction === "up" ? idx - 1 : idx + 1
  if (swapIdx < 0 || swapIdx >= siblings.length) return
  await Promise.all([
    prisma.task.update({ where: { id: task.id }, data: { order: siblings[swapIdx].order } }),
    prisma.task.update({ where: { id: siblings[swapIdx].id }, data: { order: task.order } }),
  ])
  revalidatePath(`/projets/${projectId}`)
}

export async function updateTaskFields(
  taskId: string,
  fields: {
    title?: string
    description?: string | null
    dueDate?: string | null
    priority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT"
    importance?: number
    estimatedHours?: number | null
  }
) {
  const userId = await requireAuth()
  await requireTaskOwnership(taskId, userId)
  const data: Record<string, unknown> = {}
  if (fields.title !== undefined && fields.title.trim()) data.title = fields.title.trim()
  if ("description" in fields) data.description = fields.description?.trim() || null
  if ("dueDate" in fields) data.dueDate = fields.dueDate ? new Date(fields.dueDate) : null
  if (fields.priority) data.priority = fields.priority
  if (fields.importance !== undefined) data.importance = Math.max(1, Math.min(4, fields.importance))
  if ("estimatedHours" in fields) data.estimatedHours = fields.estimatedHours ?? null
  await prisma.task.update({ where: { id: taskId }, data })
  if ("dueDate" in fields) await syncTaskGoogleState(userId, taskId)
  revalidatePath("/taches")
}

export async function deleteTask(taskId: string, projectId?: string) {
  const userId = await requireAuth()
  await requireTaskOwnership(taskId, userId)
  await removeTaskFromGoogle(userId, taskId)
  await prisma.task.delete({ where: { id: taskId } })
  if (projectId) revalidatePath(`/projets/${projectId}`)
  revalidatePath("/taches")
}

// ── Milestones ─────────────────────────────────────────────────────────────

export type MilestoneInput = {
  name: string
  date: Date
  endDate?: Date | null
  type?: string
  status?: "UPCOMING" | "IN_PROGRESS" | "DONE" | "CANCELLED"
}

export async function createMilestone(projectId: string, data: MilestoneInput) {
  const userId = await requireAuth()
  const proj = await prisma.project.findFirst({ where: { id: projectId, userId }, select: { id: true } })
  if (!proj) throw new Error("Projet introuvable")
  const milestone = await prisma.milestone.create({
    data: {
      projectId,
      name: data.name,
      date: data.date,
      endDate: data.endDate ?? null,
      type: (data.type ?? "OTHER") as never,
      status: data.status ?? "UPCOMING",
    },
  })
  await syncMilestoneGoogleState(userId, milestone.id)
  revalidatePath(`/projets/${projectId}`)
  revalidatePath(`/projets/${projectId}/dev`)
  return milestone
}

export async function updateMilestone(milestoneId: string, projectId: string, data: MilestoneInput) {
  const userId = await requireAuth()
  const proj = await prisma.project.findFirst({ where: { id: projectId, userId }, select: { id: true } })
  if (!proj) throw new Error("Projet introuvable")
  await prisma.milestone.update({
    where: { id: milestoneId },
    data: {
      name: data.name,
      date: data.date,
      endDate: data.endDate ?? null,
      type: (data.type ?? "OTHER") as never,
      ...(data.status ? { status: data.status } : {}),
    },
  })
  await syncMilestoneGoogleState(userId, milestoneId)
  revalidatePath(`/projets/${projectId}`)
  revalidatePath(`/projets/${projectId}/dev`)
}

export async function deleteMilestone(milestoneId: string, projectId: string) {
  const userId = await requireAuth()
  const proj = await prisma.project.findFirst({ where: { id: projectId, userId }, select: { id: true } })
  if (!proj) throw new Error("Projet introuvable")
  await removeMilestoneFromGoogle(userId, milestoneId)
  await prisma.milestone.delete({ where: { id: milestoneId } })
  revalidatePath(`/projets/${projectId}`)
  revalidatePath(`/projets/${projectId}/dev`)
}

export async function updateMilestoneStatus(
  milestoneId: string,
  projectId: string,
  status: "UPCOMING" | "IN_PROGRESS" | "DONE" | "CANCELLED",
  reason?: string
) {
  const userId = await requireAuth()
  const proj = await prisma.project.findFirst({ where: { id: projectId, userId }, select: { id: true } })
  if (!proj) throw new Error("Projet introuvable")
  await prisma.milestone.update({
    where: { id: milestoneId },
    data: {
      status,
      ...(status === "CANCELLED" ? { outcome: reason?.trim() || null } : {}),
      ...(status !== "CANCELLED" ? { outcome: null } : {}),
    },
  })
  revalidatePath(`/projets/${projectId}`)
}

// ── Useful Links ───────────────────────────────────────────────────────────

export type UsefulLinkInput = { label: string; url: string; category?: string }

export async function createUsefulLink(projectId: string, data: UsefulLinkInput) {
  const userId = await requireAuth()
  const proj = await prisma.project.findFirst({ where: { id: projectId, userId }, select: { id: true } })
  if (!proj) throw new Error("Projet introuvable")
  await prisma.usefulLink.create({
    data: {
      projectId,
      label: data.label,
      url: data.url,
      category: (data.category || "OTHER") as import("@/generated/prisma/client").LinkCategory,
    },
  })
  revalidatePath(`/projets/${projectId}`)
  revalidatePath(`/projets/${projectId}/dev`)
}

export async function updateUsefulLink(linkId: string, projectId: string, data: UsefulLinkInput) {
  const userId = await requireAuth()
  const link = await prisma.usefulLink.findFirst({ where: { id: linkId, project: { userId } }, select: { id: true } })
  if (!link) throw new Error("Lien introuvable")
  await prisma.usefulLink.update({
    where: { id: linkId },
    data: {
      label: data.label,
      url: data.url,
      category: (data.category || "OTHER") as import("@/generated/prisma/client").LinkCategory,
    },
  })
  revalidatePath(`/projets/${projectId}`)
  revalidatePath(`/projets/${projectId}/dev`)
}

export async function deleteUsefulLink(linkId: string, projectId: string) {
  const userId = await requireAuth()
  const link = await prisma.usefulLink.findFirst({
    where: { id: linkId, project: { userId } },
    select: { id: true },
  })
  if (!link) throw new Error("Lien introuvable")
  await prisma.usefulLink.delete({ where: { id: linkId } })
  revalidatePath(`/projets/${projectId}`)
  revalidatePath(`/projets/${projectId}/dev`)
}

// ── Journal ────────────────────────────────────────────────────────────────

export async function createJournalEntry(projectId: string, formData: FormData) {
  const userId = await requireAuth()
  const proj = await prisma.project.findFirst({ where: { id: projectId, userId }, select: { id: true } })
  if (!proj) throw new Error("Projet introuvable")
  await prisma.journalEntry.create({
    data: { projectId, content: formData.get("content") as string },
  })
  revalidatePath(`/projets/${projectId}`)
}

export async function updateJournalEntry(id: string, projectId: string, content: string) {
  const userId = await requireAuth()
  const entry = await prisma.journalEntry.findFirst({
    where: { id, project: { userId } },
    select: { id: true },
  })
  if (!entry) throw new Error("Entrée introuvable")
  await prisma.journalEntry.update({ where: { id }, data: { content } })
  revalidatePath(`/projets/${projectId}`)
}

export async function deleteJournalEntry(id: string, projectId: string) {
  await prisma.journalEntry.delete({ where: { id } })
  revalidatePath(`/projets/${projectId}`)
}

// ── Deliverables ───────────────────────────────────────────────────────────

export async function createDeliverable(projectId: string, formData: FormData) {
  await prisma.deliverable.create({
    data: {
      projectId,
      name: formData.get("name") as string,
      dueDate: formData.get("dueDate")
        ? new Date(formData.get("dueDate") as string)
        : undefined,
    },
  })
  revalidatePath(`/projets/${projectId}`)
}

export async function updateDeliverableStatus(
  deliverableId: string,
  projectId: string,
  status: "TO_DELIVER" | "DELIVERED" | "VALIDATED"
) {
  await prisma.deliverable.update({ where: { id: deliverableId }, data: { status } })
  revalidatePath(`/projets/${projectId}`)
}

// ── Collaborateurs ─────────────────────────────────────────────────────────────

export async function addProjectMember(
  projectId: string,
  ownerUserId: string,
  email: string
): Promise<{ error?: string }> {
  const project = await prisma.project.findFirst({
    where: { id: projectId, userId: ownerUserId },
    include: { client: { select: { name: true, company: true } }, user: { select: { name: true } } },
  })
  if (!project) return { error: "Projet introuvable ou accès refusé" }

  const target = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } })
  if (!target) return { error: "Aucun compte trouvé avec cet email" }
  if (target.id === ownerUserId) return { error: "Vous êtes déjà le propriétaire du projet" }

  const existing = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId: target.id } },
  })
  if (existing) return { error: "Cet utilisateur est déjà collaborateur" }

  const clientLabel = project.client?.company ?? project.client?.name ?? project.name
  const ownerName = project.user.name ?? "Un utilisateur"

  await prisma.$transaction([
    prisma.projectMember.create({
      data: { projectId, userId: target.id, role: "MEMBER" },
    }),
    prisma.notification.create({
      data: {
        userId: target.id,
        type: "PROJECT_INVITE",
        title: "Invitation à collaborer",
        body: `${ownerName} vous invite à collaborer sur le projet « ${project.name} » (${clientLabel}).`,
        href: `/projets/${projectId}`,
      },
    }),
  ])
  // Push mobile (best-effort, jamais bloquant)
  await sendPushToUser(target.id, {
    title: "Invitation à collaborer",
    body: `${ownerName} vous invite sur « ${project.name} »`,
    url: `/projets/${projectId}`,
  })
  revalidatePath(`/projets/${projectId}`)
  return {}
}

export async function removeProjectMember(projectId: string, ownerUserId: string, memberId: string) {
  const project = await prisma.project.findFirst({
    where: { id: projectId, userId: ownerUserId },
    include: {
      user: { select: { name: true } },
      client: { select: { name: true, company: true } },
    },
  })
  if (!project) return

  const ownerName = project.user.name ?? "Le propriétaire du projet"
  const clientLabel = project.client?.company ?? project.client?.name ?? project.name

  await prisma.$transaction([
    prisma.projectMember.delete({
      where: { projectId_userId: { projectId, userId: memberId } },
    }),
    prisma.notification.create({
      data: {
        userId: memberId,
        type: "PROJECT_INVITE",
        title: "Retiré d'un projet",
        body: `${ownerName} vous a retiré du projet « ${project.name} » (${clientLabel}).`,
        href: `/projets`,
      },
    }),
  ])
  await sendPushToUser(memberId, {
    title: "Retiré d'un projet",
    body: `${ownerName} vous a retiré de « ${project.name} »`,
    url: "/projets",
  })
  revalidatePath(`/projets/${projectId}`)
}

export async function updateProjectMemberRole(
  projectId: string,
  ownerUserId: string,
  memberId: string,
  role: "MEMBER" | "VIEWER"
) {
  const project = await prisma.project.findFirst({ where: { id: projectId, userId: ownerUserId } })
  if (!project) return
  await prisma.projectMember.update({
    where: { projectId_userId: { projectId, userId: memberId } },
    data: { role },
  })
  revalidatePath(`/projets/${projectId}`)
}
