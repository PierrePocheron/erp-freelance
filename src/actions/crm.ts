"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"

// ── Client CRUD ───────────────────────────────────────────────────────────────

export async function createQuickClient(
  userId: string,
  data: { name: string; company?: string; email?: string }
) {
  const client = await prisma.client.create({
    data: {
      userId,
      name: data.name,
      company: data.company || null,
      email: data.email || null,
      type: "PROSPECT",
      source: "OTHER",
      temperature: "COLD",
      priorityScore: 1,
    },
  })
  revalidatePath("/projets")
  revalidatePath("/crm")
  return client
}

export async function createClient(
  userId: string,
  data: {
    name: string
    company?: string
    email?: string
    phone?: string
    type?: string
    source?: string
    temperature?: string
    notes?: string
  }
) {
  const client = await prisma.client.create({
    data: {
      userId,
      name: data.name,
      company: data.company || null,
      email: data.email || null,
      phone: data.phone || null,
      type: (data.type as any) || "PROSPECT",
      source: (data.source as any) || "OTHER",
      temperature: (data.temperature as any) || "COLD",
      priorityScore: 1,
      notes: data.notes || null,
    },
  })
  revalidatePath("/crm")
  return client
}

export async function updateClient(
  clientId: string,
  userId: string,
  data: {
    name?: string
    company?: string | null
    email?: string | null
    phone?: string | null
    notes?: string | null
    source?: string
  }
) {
  await prisma.client.update({
    where: { id: clientId, userId },
    data: data as any,
  })
  revalidatePath(`/crm/${clientId}`)
  revalidatePath("/crm")
}

export async function updateClientType(clientId: string, userId: string, type: string) {
  await prisma.client.update({
    where: { id: clientId, userId },
    data: { type: type as any },
  })
  revalidatePath(`/crm/${clientId}`)
  revalidatePath("/crm")
}

export async function updateClientTemperature(clientId: string, userId: string, temperature: string) {
  await prisma.client.update({
    where: { id: clientId, userId },
    data: { temperature: temperature as any },
  })
  revalidatePath(`/crm/${clientId}`)
  revalidatePath("/crm")
}

export async function updateClientPriority(clientId: string, userId: string, priorityScore: number) {
  await prisma.client.update({
    where: { id: clientId, userId },
    data: { priorityScore },
  })
  revalidatePath(`/crm/${clientId}`)
  revalidatePath("/crm")
}

export async function deleteClient(clientId: string, userId: string) {
  await prisma.client.delete({ where: { id: clientId, userId } })
  revalidatePath("/crm")
}

// ── Interactions ──────────────────────────────────────────────────────────────

export async function addInteraction(
  clientId: string,
  data: { date: string; channel: string; summary: string; response?: string }
) {
  await prisma.interaction.create({
    data: {
      clientId,
      date: new Date(data.date),
      channel: data.channel as any,
      summary: data.summary,
      response: data.response || null,
    },
  })
  revalidatePath(`/crm/${clientId}`)
  revalidatePath("/crm")
}

export async function updateInteraction(
  interactionId: string,
  clientId: string,
  data: { date: string; channel: string; summary: string; response?: string | null }
) {
  await prisma.interaction.update({
    where: { id: interactionId },
    data: {
      date: new Date(data.date),
      channel: data.channel as any,
      summary: data.summary,
      response: data.response || null,
    },
  })
  revalidatePath(`/crm/${clientId}`)
}

export async function deleteInteraction(interactionId: string, clientId: string) {
  await prisma.interaction.delete({ where: { id: interactionId } })
  revalidatePath(`/crm/${clientId}`)
}

// ── Reminders ─────────────────────────────────────────────────────────────────

export async function addReminder(clientId: string, data: { dueDate: string; note?: string }) {
  await prisma.reminder.create({
    data: {
      clientId,
      dueDate: new Date(data.dueDate),
      note: data.note || null,
    },
  })
  revalidatePath(`/crm/${clientId}`)
}

export async function toggleReminder(reminderId: string, clientId: string, isDone: boolean) {
  await prisma.reminder.update({
    where: { id: reminderId },
    data: { isDone, doneAt: isDone ? new Date() : null },
  })
  revalidatePath(`/crm/${clientId}`)
}

export async function deleteReminder(reminderId: string, clientId: string) {
  await prisma.reminder.delete({ where: { id: reminderId } })
  revalidatePath(`/crm/${clientId}`)
}

// ── Panel ─────────────────────────────────────────────────────────────────────

export async function getClientPanel(clientId: string, userId: string) {
  return prisma.client.findFirst({
    where: { id: clientId, userId },
    include: {
      interactions: { orderBy: { date: "desc" }, take: 3 },
      reminders: { where: { isDone: false }, orderBy: { dueDate: "asc" }, take: 3 },
      projects: {
        orderBy: { createdAt: "desc" },
        take: 5,
        select: { id: true, name: true, status: true },
      },
      invoices: {
        orderBy: { createdAt: "desc" },
        take: 5,
        select: { id: true, number: true, status: true, totalHT: true, depositDeducted: true, createdAt: true },
      },
      quotes: {
        orderBy: { createdAt: "desc" },
        take: 5,
        select: { id: true, number: true, status: true, totalHT: true, createdAt: true },
      },
      _count: { select: { interactions: true, projects: true, invoices: true, quotes: true } },
    },
  })
}
