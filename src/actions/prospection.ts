"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { auth } from "@/lib/auth"
import type { ClientSource, InteractionChannel, ProspectStatus } from "@/generated/prisma/enums"

async function requireAuth(): Promise<string> {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Non autorisé")
  return session.user.id
}

// Résout la société d'un prospect par nom (création si absente) — même logique
// que resolveCompany de crm.ts, dupliquée ici car non exportée là-bas.
async function resolveCompanyByName(userId: string, companyName?: string | null): Promise<{ companyId: string | null; companyName: string | null }> {
  const name = (companyName ?? "").trim()
  if (!name) return { companyId: null, companyName: null }
  const existing = await prisma.company.findFirst({
    where: { userId, name: { equals: name, mode: "insensitive" } },
    select: { id: true, name: true },
  })
  if (existing) return { companyId: existing.id, companyName: existing.name }
  const created = await prisma.company.create({ data: { userId, name } })
  return { companyId: created.id, companyName: created.name }
}

export async function createProspect(data: {
  name: string
  email?: string | null
  phone?: string | null
  source?: string | null
  companyName?: string | null
  websiteUrl?: string | null
  region?: string | null
}) {
  const userId = await requireAuth()
  const name = data.name.trim()
  if (!name) throw new Error("Le nom est requis")
  const { companyId, companyName } = await resolveCompanyByName(userId, data.companyName)
  const client = await prisma.client.create({
    data: {
      userId,
      name,
      email: data.email?.trim() || null,
      phone: data.phone?.trim() || null,
      companyId,
      company: companyName,
      type: "PROSPECT",
      source: (data.source as ClientSource) || "OTHER",
      prospectStatus: "TO_CONTACT",
      websiteUrl: data.websiteUrl?.trim() || null,
      region: data.region?.trim() || null,
    },
  })
  revalidatePath("/prospection")
  return client
}

export async function updateProspectStatus(clientId: string, status: ProspectStatus) {
  const userId = await requireAuth()
  const data: Record<string, unknown> = { prospectStatus: status }
  // Gagné → convertit automatiquement en client
  if (status === "WON") data.type = "CLIENT"
  await prisma.client.update({ where: { id: clientId, userId }, data: data as never })
  revalidatePath("/prospection")
  revalidatePath(`/contacts/${clientId}`)
}

export async function updateProspectsStatusBulk(clientIds: string[], status: ProspectStatus) {
  const userId = await requireAuth()
  await prisma.client.updateMany({
    where: { id: { in: clientIds }, userId },
    data: {
      prospectStatus: status,
      ...(status === "WON" ? { type: "CLIENT" } : {}),
    },
  })
  revalidatePath("/prospection")
}

/**
 * Marque un lot de prospects comme contactés : crée une Interaction datée
 * (canal choisi) sur chacun, et avance le statut TO_CONTACT → CONTACTED
 * (les statuts plus avancés ne sont pas rétrogradés).
 */
export async function markProspectsContacted(clientIds: string[], channel: InteractionChannel, note?: string) {
  const userId = await requireAuth()
  // Anti-IDOR : ne retient que les ids appartenant réellement à l'utilisateur.
  const owned = await prisma.client.findMany({
    where: { id: { in: clientIds }, userId },
    select: { id: true },
  })
  if (owned.length === 0) return { contacted: 0 }

  const now = new Date()
  const channelLabels: Record<string, string> = {
    EMAIL: "Email", CALL: "Appel", LINKEDIN: "LinkedIn", MEETING: "Réunion", SMS: "SMS", OTHER: "Contact",
  }
  await prisma.interaction.createMany({
    data: owned.map((c) => ({
      clientId: c.id,
      date: now,
      channel,
      summary: note?.trim() || `${channelLabels[channel] ?? "Contact"} de prospection`,
    })),
  })
  await prisma.client.updateMany({
    where: { id: { in: owned.map((c) => c.id) }, userId, prospectStatus: "TO_CONTACT" },
    data: { prospectStatus: "CONTACTED" },
  })
  revalidatePath("/prospection")
  return { contacted: owned.length }
}

export type ImportProspectRow = {
  name: string
  firstName?: string | null
  lastName?: string | null
  email?: string | null
  phone?: string | null
  companyName?: string | null
  websiteUrl?: string | null
  websiteType?: string | null
  websitePagesApprox?: number | null
  businessDescription?: string | null
  city?: string | null
  region?: string | null
  notes?: string | null
  source?: string | null
}

const WEBSITE_TYPES = ["SHOWCASE", "ECOMMERCE", "BLOG_CONTENT", "OUTDATED", "OTHER"]
const SOURCES = ["WORD_OF_MOUTH", "LINKEDIN", "WEBSITE", "INBOUND", "OTHER"]

/**
 * Import en masse (CSV scrapé) : déduplique par email normalisé contre TOUS
 * les contacts du user (pas seulement les prospects — évite de réimporter un
 * client existant en prospect). Doublons skippés avec rapport.
 */
export async function importProspects(rows: ImportProspectRow[]) {
  const userId = await requireAuth()

  const existing = await prisma.client.findMany({
    where: { userId, email: { not: null } },
    select: { email: true },
  })
  const known = new Set(existing.map((c) => c.email!.trim().toLowerCase()))

  let imported = 0
  const skipped: string[] = []

  for (const row of rows) {
    const name = row.name?.trim()
    if (!name) continue

    const email = row.email?.trim() || null
    const emailKey = email?.toLowerCase()
    if (emailKey && known.has(emailKey)) {
      skipped.push(email!)
      continue
    }

    const { companyId, companyName } = await resolveCompanyByName(userId, row.companyName)
    await prisma.client.create({
      data: {
        userId,
        name,
        firstName: row.firstName?.trim() || null,
        lastName: row.lastName?.trim() || null,
        email,
        phone: row.phone?.trim() || null,
        companyId,
        company: companyName,
        type: "PROSPECT",
        prospectStatus: "TO_CONTACT",
        source: SOURCES.includes(row.source ?? "") ? (row.source as ClientSource) : "OTHER",
        websiteUrl: row.websiteUrl?.trim() || null,
        websiteType: WEBSITE_TYPES.includes(row.websiteType ?? "") ? (row.websiteType as never) : null,
        websitePagesApprox: row.websitePagesApprox ?? null,
        businessDescription: row.businessDescription?.trim() || null,
        city: row.city?.trim() || null,
        region: row.region?.trim() || null,
        notes: row.notes?.trim() || null,
      },
    })
    if (emailKey) known.add(emailKey) // dédup aussi à l'intérieur du fichier
    imported++
  }

  revalidatePath("/prospection")
  return { imported, skipped }
}

export async function deleteProspects(clientIds: string[]) {
  const userId = await requireAuth()
  const deleted = await prisma.client.deleteMany({
    where: { id: { in: clientIds }, userId, type: "PROSPECT" },
  })
  revalidatePath("/prospection")
  return { deleted: deleted.count }
}
