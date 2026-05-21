"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { auth } from "@/lib/auth"

async function requireAuth(): Promise<string> {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Non autorisé")
  return session.user.id
}

// ── Client CRUD ───────────────────────────────────────────────────────────────

export async function createQuickClient(
  _userId: string,
  data: { name: string; company?: string; email?: string }
) {
  const userId = await requireAuth()
  const client = await prisma.client.create({
    data: {
      userId,
      name: data.name,
      company: data.company || null,
      email: data.email || null,
      type: "TO_COMPLETE",
      source: "OTHER",
      temperature: "COLD",
      priorityScore: 1,
    },
  })
  revalidatePath("/projets")
  revalidatePath("/client")
  return client
}

export async function createClient(
  _userId: string,
  data: {
    name: string
    company?: string
    email?: string
    phone?: string
    type?: string
    source?: string
    temperature?: string
    notes?: string
    address?: string
    postalCode?: string
    city?: string
    country?: string
    siret?: string
  }
) {
  const userId = await requireAuth()
  const client = await prisma.client.create({
    data: {
      userId,
      name: data.name,
      company: data.company || null,
      email: data.email || null,
      phone: data.phone || null,
      type: (data.type as any) || "TO_COMPLETE",
      source: (data.source as any) || "OTHER",
      temperature: (data.temperature as any) || "COLD",
      priorityScore: 1,
      notes: data.notes || null,
      address: data.address || null,
      postalCode: data.postalCode || null,
      city: data.city || null,
      country: data.country || null,
      siret: data.siret || null,
    },
  })
  revalidatePath("/client")
  return client
}

export async function updateClient(
  clientId: string,
  _userId: string,
  data: {
    name?: string
    company?: string | null
    email?: string | null
    phone?: string | null
    notes?: string | null
    source?: string
  }
) {
  const userId = await requireAuth()
  await prisma.client.update({
    where: { id: clientId, userId },
    data: data as any,
  })
  revalidatePath(`/client/${clientId}`)
  revalidatePath("/client")
}

export async function updateClientType(clientId: string, _userId: string, type: string) {
  const userId = await requireAuth()
  await prisma.client.update({
    where: { id: clientId, userId },
    data: { type: type as any },
  })
  revalidatePath(`/client/${clientId}`)
  revalidatePath("/client")
}

export async function updateClientTemperature(clientId: string, _userId: string, temperature: string) {
  const userId = await requireAuth()
  await prisma.client.update({
    where: { id: clientId, userId },
    data: { temperature: temperature as any },
  })
  revalidatePath(`/client/${clientId}`)
  revalidatePath("/client")
}

export async function updateClientPriority(clientId: string, _userId: string, priorityScore: number) {
  const userId = await requireAuth()
  await prisma.client.update({
    where: { id: clientId, userId },
    data: { priorityScore },
  })
  revalidatePath(`/client/${clientId}`)
  revalidatePath("/client")
}

export async function updateClientAll(
  clientId: string,
  data: {
    name?: string
    company?: string | null
    email?: string | null
    phone?: string | null
    source?: string
    notes?: string | null
    type?: string
    temperature?: string
    address?: string | null
    postalCode?: string | null
    city?: string | null
    country?: string | null
    siret?: string | null
  }
) {
  const userId = await requireAuth()
  const clean: Record<string, unknown> = {}
  if (data.name?.trim()) clean.name = data.name.trim()
  if ("company" in data) clean.company = data.company?.trim() || null
  if ("email" in data) clean.email = data.email?.trim() || null
  if ("phone" in data) clean.phone = data.phone?.trim() || null
  if ("source" in data && data.source) clean.source = data.source
  if ("notes" in data) clean.notes = data.notes?.trim() || null
  if ("type" in data && data.type) clean.type = data.type
  if ("temperature" in data && data.temperature) clean.temperature = data.temperature
  if ("address" in data) clean.address = data.address?.trim() || null
  if ("postalCode" in data) clean.postalCode = data.postalCode?.trim() || null
  if ("city" in data) clean.city = data.city?.trim() || null
  if ("country" in data) clean.country = data.country?.trim() || null
  if ("siret" in data) clean.siret = data.siret?.trim() || null
  await prisma.client.update({ where: { id: clientId, userId }, data: clean as any })
  revalidatePath(`/client/${clientId}`)
  revalidatePath("/client")
}

export async function deleteClient(clientId: string, _userId: string) {
  const userId = await requireAuth()
  await prisma.client.delete({ where: { id: clientId, userId } })
  revalidatePath("/client")
}

// ── Interactions ──────────────────────────────────────────────────────────────

export async function addInteraction(
  clientId: string,
  data: { date: string; channel: string; summary: string; response?: string }
) {
  const userId = await requireAuth()
  const client = await prisma.client.findFirst({ where: { id: clientId, userId }, select: { id: true } })
  if (!client) throw new Error("Non autorisé")
  await prisma.interaction.create({
    data: {
      clientId,
      date: new Date(data.date),
      channel: data.channel as any,
      summary: data.summary,
      response: data.response || null,
    },
  })
  revalidatePath(`/client/${clientId}`)
  revalidatePath("/client")
}

export async function updateInteraction(
  interactionId: string,
  clientId: string,
  data: { date: string; channel: string; summary: string; response?: string | null }
) {
  const userId = await requireAuth()
  const client = await prisma.client.findFirst({ where: { id: clientId, userId }, select: { id: true } })
  if (!client) throw new Error("Non autorisé")
  await prisma.interaction.update({
    where: { id: interactionId },
    data: {
      date: new Date(data.date),
      channel: data.channel as any,
      summary: data.summary,
      response: data.response || null,
    },
  })
  revalidatePath(`/client/${clientId}`)
}

export async function deleteInteraction(interactionId: string, clientId: string) {
  const userId = await requireAuth()
  const client = await prisma.client.findFirst({ where: { id: clientId, userId }, select: { id: true } })
  if (!client) throw new Error("Non autorisé")
  await prisma.interaction.delete({ where: { id: interactionId } })
  revalidatePath(`/client/${clientId}`)
}

// ── Reminders ─────────────────────────────────────────────────────────────────

export async function addReminder(clientId: string, data: { dueDate: string; note?: string }) {
  const userId = await requireAuth()
  const client = await prisma.client.findFirst({ where: { id: clientId, userId }, select: { id: true } })
  if (!client) throw new Error("Non autorisé")
  await prisma.reminder.create({
    data: {
      clientId,
      dueDate: new Date(data.dueDate),
      note: data.note || null,
    },
  })
  revalidatePath(`/client/${clientId}`)
}

export async function toggleReminder(reminderId: string, clientId: string, isDone: boolean) {
  const userId = await requireAuth()
  const client = await prisma.client.findFirst({ where: { id: clientId, userId }, select: { id: true } })
  if (!client) throw new Error("Non autorisé")
  await prisma.reminder.update({
    where: { id: reminderId },
    data: { isDone, doneAt: isDone ? new Date() : null },
  })
  revalidatePath(`/client/${clientId}`)
}

export async function deleteReminder(reminderId: string, clientId: string) {
  const userId = await requireAuth()
  const client = await prisma.client.findFirst({ where: { id: clientId, userId }, select: { id: true } })
  if (!client) throw new Error("Non autorisé")
  await prisma.reminder.delete({ where: { id: reminderId } })
  revalidatePath(`/client/${clientId}`)
}

// ── Panel ─────────────────────────────────────────────────────────────────────

export async function getClientPanel(clientId: string, _userId: string) {
  const userId = await requireAuth()
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
