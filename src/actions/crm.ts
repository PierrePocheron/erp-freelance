"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { auth } from "@/lib/auth"
import { computeContactName } from "@/lib/contact"
import type { ClientType, ClientSource, InteractionChannel } from "@/generated/prisma/enums"

async function requireAuth(): Promise<string> {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Non autorisé")
  return session.user.id
}

// ── Company (société cliente) ──────────────────────────────────────────────────

// Résout la société cible d'un contact : par id explicite, sinon par nom
// (recherche insensible à la casse, création si absente). Renvoie aussi le nom
// normalisé pour alimenter le cache d'affichage `Client.company`.
async function resolveCompany(
  userId: string,
  opts: { companyId?: string | null; companyName?: string | null }
): Promise<{ companyId: string | null; companyName: string | null }> {
  if (opts.companyId) {
    const co = await prisma.company.findFirst({
      where: { id: opts.companyId, userId },
      select: { id: true, name: true },
    })
    if (co) return { companyId: co.id, companyName: co.name }
  }
  const name = (opts.companyName ?? "").trim()
  if (!name) return { companyId: null, companyName: null }
  const existing = await prisma.company.findFirst({
    where: { userId, name: { equals: name, mode: "insensitive" } },
    select: { id: true, name: true },
  })
  if (existing) return { companyId: existing.id, companyName: existing.name }
  const created = await prisma.company.create({ data: { userId, name } })
  return { companyId: created.id, companyName: created.name }
}

// Recherche de sociétés pour l'autocomplétion du formulaire contact.
export async function searchCompanies(query: string) {
  const userId = await requireAuth()
  const q = query.trim()
  return prisma.company.findMany({
    where: { userId, ...(q ? { name: { contains: q, mode: "insensitive" } } : {}) },
    orderBy: { name: "asc" },
    take: 8,
    select: { id: true, name: true, city: true },
  })
}

export async function createCompany(data: {
  name: string
  companyType?: string | null
  siret?: string
  vatNumber?: string
  email?: string
  phone?: string
  website?: string
  address?: string
  postalCode?: string
  city?: string
  country?: string
  notes?: string
  fiscalSourceId?: string | null
}) {
  const userId = await requireAuth()
  const name = data.name.trim()
  if (!name) throw new Error("Le nom de la société est requis")
  const company = await prisma.company.create({
    data: {
      userId,
      name,
      companyType: (data.companyType || null) as never,
      siret: data.siret?.trim() || null,
      vatNumber: data.vatNumber?.trim() || null,
      email: data.email?.trim() || null,
      phone: data.phone?.trim() || null,
      website: data.website?.trim() || null,
      address: data.address?.trim() || null,
      postalCode: data.postalCode?.trim() || null,
      city: data.city?.trim() || null,
      country: data.country?.trim() || null,
      notes: data.notes?.trim() || null,
      fiscalSourceId: data.fiscalSourceId || null,
    },
  })
  revalidatePath("/societes")
  revalidatePath("/contacts")
  return company
}

export async function updateCompany(
  companyId: string,
  data: {
    name?: string
    companyType?: string | null
    siret?: string | null
    vatNumber?: string | null
    email?: string | null
    phone?: string | null
    website?: string | null
    address?: string | null
    postalCode?: string | null
    city?: string | null
    country?: string | null
    notes?: string | null
    fiscalSourceId?: string | null
  }
) {
  const userId = await requireAuth()
  const before = await prisma.company.findFirst({ where: { id: companyId, userId }, select: { name: true } })
  if (!before) throw new Error("Société introuvable")

  const clean: Record<string, unknown> = {}
  if (data.name?.trim()) clean.name = data.name.trim()
  if ("companyType" in data) clean.companyType = data.companyType || null
  for (const k of ["siret", "vatNumber", "email", "phone", "website", "address", "postalCode", "city", "country", "notes"] as const) {
    if (k in data) clean[k] = (data[k] ?? "")?.toString().trim() || null
  }
  if ("fiscalSourceId" in data) clean.fiscalSourceId = data.fiscalSourceId || null
  await prisma.company.update({ where: { id: companyId, userId }, data: clean as never })

  // Resynchronise le cache d'affichage des contacts si le nom a changé.
  if (clean.name && clean.name !== before.name) {
    await prisma.client.updateMany({ where: { companyId, userId }, data: { company: clean.name as string } })
  }
  revalidatePath("/societes")
  revalidatePath(`/societes/${companyId}`)
  revalidatePath("/contacts")
}

export async function deleteCompany(companyId: string) {
  const userId = await requireAuth()
  // Détache les contacts (companyId → null via FK SET NULL) puis nettoie le cache.
  await prisma.client.updateMany({ where: { companyId, userId }, data: { company: null } })
  await prisma.company.delete({ where: { id: companyId, userId } })
  revalidatePath("/societes")
  revalidatePath("/contacts")
}

// ── Client CRUD ───────────────────────────────────────────────────────────────

export async function createQuickClient(
  _userId: string,
  data: {
    firstName?: string
    lastName?: string
    label?: string
    companyId?: string
    companyName?: string
    email?: string
  }
) {
  const userId = await requireAuth()
  const { companyId, companyName } = await resolveCompany(userId, data)
  const name = computeContactName({
    label: data.label,
    firstName: data.firstName,
    lastName: data.lastName,
    companyName,
  })
  const client = await prisma.client.create({
    data: {
      userId,
      firstName: data.firstName?.trim() || null,
      lastName: data.lastName?.trim() || null,
      label: data.label?.trim() || null,
      companyId,
      company: companyName,
      name,
      email: data.email?.trim() || null,
      type: "TO_COMPLETE",
      source: "OTHER",
      priorityScore: 1,
    },
  })
  revalidatePath("/projets")
  revalidatePath("/contacts")
  return client
}

export async function createClient(
  _userId: string,
  data: {
    firstName?: string
    lastName?: string
    label?: string
    companyId?: string
    companyName?: string
    email?: string
    phone?: string
    jobTitle?: string
    type?: string
    source?: string
    notes?: string
    address?: string
    postalCode?: string
    city?: string
    country?: string
    siret?: string
  }
) {
  const userId = await requireAuth()
  const { companyId, companyName } = await resolveCompany(userId, data)
  const name = computeContactName({
    label: data.label,
    firstName: data.firstName,
    lastName: data.lastName,
    companyName,
  })
  const client = await prisma.client.create({
    data: {
      userId,
      firstName: data.firstName?.trim() || null,
      lastName: data.lastName?.trim() || null,
      label: data.label?.trim() || null,
      companyId,
      company: companyName,
      name,
      email: data.email?.trim() || null,
      phone: data.phone?.trim() || null,
      jobTitle: data.jobTitle?.trim() || null,
      type: (data.type as ClientType) || "TO_COMPLETE",
      source: (data.source as ClientSource) || "OTHER",
      priorityScore: 1,
      notes: data.notes?.trim() || null,
      address: data.address?.trim() || null,
      postalCode: data.postalCode?.trim() || null,
      city: data.city?.trim() || null,
      country: data.country?.trim() || null,
      siret: data.siret?.trim() || null,
    },
  })
  revalidatePath("/contacts")
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: data as any,
  })
  revalidatePath(`/contacts/${clientId}`)
  revalidatePath("/contacts")
}

export async function updateCompanyType(companyId: string, type: string | null) {
  const userId = await requireAuth()
  await prisma.company.update({
    where: { id: companyId, userId },
    data: { companyType: (type || null) as never },
  })
  revalidatePath(`/societes/${companyId}`)
  revalidatePath("/societes")
}

export async function updateClientType(clientId: string, _userId: string, type: string) {
  const userId = await requireAuth()
  await prisma.client.update({
    where: { id: clientId, userId },
    data: { type: type as ClientType },
  })
  revalidatePath(`/contacts/${clientId}`)
  revalidatePath("/contacts")
}


export async function updateClientPriority(clientId: string, _userId: string, priorityScore: number) {
  const userId = await requireAuth()
  await prisma.client.update({
    where: { id: clientId, userId },
    data: { priorityScore },
  })
  revalidatePath(`/contacts/${clientId}`)
  revalidatePath("/contacts")
}

export async function updateClientAll(
  clientId: string,
  data: {
    firstName?: string | null
    lastName?: string | null
    label?: string | null
    companyId?: string | null
    companyName?: string | null
    jobTitle?: string | null
    email?: string | null
    personalEmail?: string | null
    phone?: string | null
    phoneType?: string | null
    source?: string
    notes?: string | null
    type?: string
    address?: string | null
    postalCode?: string | null
    city?: string | null
    country?: string | null
    siret?: string | null
    linkedinUrl?: string | null
    // Fiche site web (prospection)
    websiteUrl?: string | null
    websiteType?: string | null
    websitePagesApprox?: number | null
    businessDescription?: string | null
    region?: string | null
  }
) {
  const userId = await requireAuth()
  const current = await prisma.client.findFirst({
    where: { id: clientId, userId },
    select: { firstName: true, lastName: true, label: true, company: true },
  })
  if (!current) throw new Error("Contact introuvable")

  const clean: Record<string, unknown> = {}

  // Identité (source de vérité). On part des valeurs courantes pour pouvoir
  // recalculer le cache d'affichage `name` même si un seul champ est modifié.
  let firstName = current.firstName
  let lastName = current.lastName
  let label = current.label
  let companyName = current.company
  let identityTouched = false

  if ("firstName" in data) { firstName = data.firstName?.trim() || null; clean.firstName = firstName; identityTouched = true }
  if ("lastName" in data) { lastName = data.lastName?.trim() || null; clean.lastName = lastName; identityTouched = true }
  if ("label" in data) { label = data.label?.trim() || null; clean.label = label; identityTouched = true }

  if ("companyId" in data || "companyName" in data) {
    const r = await resolveCompany(userId, { companyId: data.companyId, companyName: data.companyName })
    clean.companyId = r.companyId
    clean.company = r.companyName
    companyName = r.companyName
    identityTouched = true
  }

  if (identityTouched) {
    clean.name = computeContactName({ label, firstName, lastName, companyName })
  }

  if ("jobTitle" in data) clean.jobTitle = data.jobTitle?.trim() || null
  // Autres champs du contact.
  if ("email" in data) clean.email = data.email?.trim() || null
  if ("personalEmail" in data) clean.personalEmail = data.personalEmail?.trim() || null
  if ("phone" in data) clean.phone = data.phone?.trim() || null
  // Type de numéro : conservé seulement s'il y a un numéro
  if ("phoneType" in data) clean.phoneType = data.phoneType || null
  if ("source" in data && data.source) clean.source = data.source
  if ("notes" in data) clean.notes = data.notes?.trim() || null
  if ("type" in data && data.type) clean.type = data.type
  if ("address" in data) clean.address = data.address?.trim() || null
  if ("postalCode" in data) clean.postalCode = data.postalCode?.trim() || null
  if ("city" in data) clean.city = data.city?.trim() || null
  if ("country" in data) clean.country = data.country?.trim() || null
  if ("siret" in data) clean.siret = data.siret?.trim() || null
  if ("linkedinUrl" in data) clean.linkedinUrl = data.linkedinUrl?.trim() || null
  if ("websiteUrl" in data) clean.websiteUrl = data.websiteUrl?.trim() || null
  if ("websiteType" in data) clean.websiteType = data.websiteType || null
  if ("websitePagesApprox" in data) clean.websitePagesApprox = data.websitePagesApprox ?? null
  if ("businessDescription" in data) clean.businessDescription = data.businessDescription?.trim() || null
  if ("region" in data) clean.region = data.region?.trim() || null

  await prisma.client.update({ where: { id: clientId, userId }, data: clean as never })
  revalidatePath(`/contacts/${clientId}`)
  revalidatePath("/contacts")
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function deleteClient(clientId: string, _userId: string) {
  const userId = await requireAuth()
  await prisma.client.delete({ where: { id: clientId, userId } })
  revalidatePath("/contacts")
}

// ── Interactions ──────────────────────────────────────────────────────────────

export async function addInteraction(
  clientId: string,
  data: { date: string; channel: string; summary: string; response?: string; emailUrl?: string | null }
) {
  const userId = await requireAuth()
  const client = await prisma.client.findFirst({ where: { id: clientId, userId }, select: { id: true } })
  if (!client) throw new Error("Non autorisé")
  await prisma.interaction.create({
    data: {
      clientId,
      date: new Date(data.date),
      channel: data.channel as InteractionChannel,
      summary: data.summary,
      response: data.response || null,
      emailUrl: data.emailUrl?.trim() || null,
    },
  })
  revalidatePath(`/contacts/${clientId}`)
  revalidatePath("/contacts")
  revalidatePath("/prospection")
}

export async function updateInteraction(
  interactionId: string,
  clientId: string,
  data: { date: string; channel: string; summary: string; response?: string | null; emailUrl?: string | null }
) {
  const userId = await requireAuth()
  // Scope par l'interaction elle-même (via le client propriétaire), pas par le
  // clientId fourni par l'appelant — sinon IDOR (clientId attaquant + interactionId victime).
  const updated = await prisma.interaction.updateMany({
    where: { id: interactionId, client: { userId } },
    data: {
      date: new Date(data.date),
      channel: data.channel as InteractionChannel,
      summary: data.summary,
      response: data.response || null,
      emailUrl: data.emailUrl?.trim() || null,
    },
  })
  if (updated.count === 0) throw new Error("Non autorisé")
  revalidatePath(`/contacts/${clientId}`)
}

export async function deleteInteraction(interactionId: string, clientId: string) {
  const userId = await requireAuth()
  const deleted = await prisma.interaction.deleteMany({
    where: { id: interactionId, client: { userId } },
  })
  if (deleted.count === 0) throw new Error("Non autorisé")
  revalidatePath(`/contacts/${clientId}`)
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
  revalidatePath(`/contacts/${clientId}`)
  revalidatePath("/contacts/prospects")
}

export async function toggleReminder(reminderId: string, clientId: string, isDone: boolean) {
  const userId = await requireAuth()
  const updated = await prisma.reminder.updateMany({
    where: { id: reminderId, client: { userId } },
    data: { isDone, doneAt: isDone ? new Date() : null },
  })
  if (updated.count === 0) throw new Error("Non autorisé")
  revalidatePath(`/contacts/${clientId}`)
}

export async function deleteReminder(reminderId: string, clientId: string) {
  const userId = await requireAuth()
  const deleted = await prisma.reminder.deleteMany({
    where: { id: reminderId, client: { userId } },
  })
  if (deleted.count === 0) throw new Error("Non autorisé")
  revalidatePath(`/contacts/${clientId}`)
}

// ── Panel ─────────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-unused-vars
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
