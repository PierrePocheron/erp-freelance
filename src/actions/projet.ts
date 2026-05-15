"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { z } from "zod"

const CreateProjectSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  clientId: z.string().min(1),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  estimatedHours: z.coerce.number().optional(),
})

export async function createProject(userId: string, formData: FormData) {
  const parsed = CreateProjectSchema.parse(Object.fromEntries(formData))
  const project = await prisma.project.create({
    data: {
      userId,
      clientId: parsed.clientId,
      name: parsed.name,
      description: parsed.description,
      startDate: parsed.startDate ? new Date(parsed.startDate) : undefined,
      endDate: parsed.endDate ? new Date(parsed.endDate) : undefined,
      estimatedHours: parsed.estimatedHours,
    },
  })
  revalidatePath("/projets")
  return project
}

export async function updateProjectStatus(
  projectId: string,
  status: "ACTIVE" | "PAUSED" | "COMPLETED" | "ARCHIVED"
) {
  await prisma.project.update({ where: { id: projectId }, data: { status } })
  revalidatePath("/projets")
  revalidatePath(`/projets/${projectId}`)
}

export async function deleteProject(projectId: string, userId: string) {
  await prisma.project.delete({ where: { id: projectId, userId } })
  revalidatePath("/projets")
}

export async function updateProjectInfo(
  projectId: string,
  data: { name?: string; description?: string | null; estimatedHours?: number | null }
) {
  await prisma.project.update({ where: { id: projectId }, data })
  revalidatePath(`/projets/${projectId}`)
  revalidatePath("/projets")
}

export async function updateProjectDates(
  projectId: string,
  data: { startDate?: string; endDate?: string; estimatedHours?: number }
) {
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
  const parsed = TaskSchema.parse(Object.fromEntries(formData))
  const task = await prisma.task.create({
    data: {
      projectId,
      title: parsed.title,
      description: parsed.description,
      milestoneId: parsed.milestoneId || null,
      parentTaskId: parsed.parentTaskId || null,
      estimatedHours: parsed.estimatedHours,
      dueDate: parsed.dueDate ? new Date(parsed.dueDate) : undefined,
    },
  })
  revalidatePath(`/projets/${projectId}`)
  return task
}

export async function startTask(taskId: string, projectId: string) {
  await prisma.task.update({
    where: { id: taskId },
    data: { status: "IN_PROGRESS", startedAt: new Date(), completedAt: null },
  })
  revalidatePath(`/projets/${projectId}`)
}

export async function completeTask(taskId: string, projectId: string) {
  await prisma.task.update({
    where: { id: taskId },
    data: { status: "DONE", completedAt: new Date() },
  })
  revalidatePath(`/projets/${projectId}`)
}

export async function reopenTask(taskId: string, projectId: string) {
  await prisma.task.update({
    where: { id: taskId },
    data: { status: "TODO", startedAt: null, completedAt: null },
  })
  revalidatePath(`/projets/${projectId}`)
}

export async function updateTaskTitle(taskId: string, projectId: string, title: string) {
  if (!title.trim()) return
  await prisma.task.update({ where: { id: taskId }, data: { title: title.trim() } })
  revalidatePath(`/projets/${projectId}`)
}

export async function updateTaskDescription(taskId: string, projectId: string, description: string | null) {
  await prisma.task.update({ where: { id: taskId }, data: { description: description?.trim() || null } })
  revalidatePath(`/projets/${projectId}`)
}

export async function updateTaskEstimatedHours(taskId: string, projectId: string, hours: number | null) {
  await prisma.task.update({ where: { id: taskId }, data: { estimatedHours: hours } })
  revalidatePath(`/projets/${projectId}`)
}

export async function updateTaskDueDate(taskId: string, projectId: string, dueDate: string | null) {
  await prisma.task.update({
    where: { id: taskId },
    data: { dueDate: dueDate ? new Date(dueDate) : null },
  })
  revalidatePath(`/projets/${projectId}`)
}

export async function updateTaskPriority(
  taskId: string,
  projectId: string,
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT"
) {
  await prisma.task.update({ where: { id: taskId }, data: { priority } })
  revalidatePath(`/projets/${projectId}`)
}

export async function reorderTask(taskId: string, projectId: string, direction: "up" | "down") {
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

export async function deleteTask(taskId: string, projectId: string) {
  await prisma.task.delete({ where: { id: taskId } })
  revalidatePath(`/projets/${projectId}`)
}

// ── Milestones ─────────────────────────────────────────────────────────────

export async function createMilestone(projectId: string, formData: FormData) {
  const milestone = await prisma.milestone.create({
    data: {
      projectId,
      name: formData.get("name") as string,
      date: new Date(formData.get("date") as string),
    },
  })
  revalidatePath(`/projets/${projectId}`)
  return milestone
}

export async function updateMilestoneStatus(
  milestoneId: string,
  projectId: string,
  status: "UPCOMING" | "IN_PROGRESS" | "DONE"
) {
  await prisma.milestone.update({ where: { id: milestoneId }, data: { status } })
  revalidatePath(`/projets/${projectId}`)
}

// ── Useful Links ───────────────────────────────────────────────────────────

export async function createUsefulLink(projectId: string, formData: FormData) {
  await prisma.usefulLink.create({
    data: {
      projectId,
      label: formData.get("label") as string,
      url: formData.get("url") as string,
      category: ((formData.get("category") as string) || "OTHER") as import("@/generated/prisma/client").LinkCategory,
    },
  })
  revalidatePath(`/projets/${projectId}`)
}

export async function deleteUsefulLink(linkId: string, projectId: string) {
  await prisma.usefulLink.delete({ where: { id: linkId } })
  revalidatePath(`/projets/${projectId}`)
}

// ── Journal ────────────────────────────────────────────────────────────────

export async function createJournalEntry(projectId: string, formData: FormData) {
  await prisma.journalEntry.create({
    data: { projectId, content: formData.get("content") as string },
  })
  revalidatePath(`/projets/${projectId}`)
}

export async function updateJournalEntry(id: string, projectId: string, content: string) {
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
  const project = await prisma.project.findFirst({ where: { id: projectId, userId: ownerUserId } })
  if (!project) return { error: "Projet introuvable ou accès refusé" }

  const target = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } })
  if (!target) return { error: "Aucun compte trouvé avec cet email" }
  if (target.id === ownerUserId) return { error: "Vous êtes déjà le propriétaire du projet" }

  const existing = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId: target.id } },
  })
  if (existing) return { error: "Cet utilisateur est déjà collaborateur" }

  await prisma.projectMember.create({
    data: { projectId, userId: target.id, role: "MEMBER" },
  })
  revalidatePath(`/projets/${projectId}`)
  return {}
}

export async function removeProjectMember(projectId: string, ownerUserId: string, memberId: string) {
  const project = await prisma.project.findFirst({ where: { id: projectId, userId: ownerUserId } })
  if (!project) return
  await prisma.projectMember.delete({
    where: { projectId_userId: { projectId, userId: memberId } },
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
