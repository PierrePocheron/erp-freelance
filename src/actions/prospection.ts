"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { auth } from "@/lib/auth"
import { getResend } from "@/lib/resend"
import { enforceRateLimit } from "@/lib/rate-limit"
import { renderTemplate, bodyToHtml } from "@/lib/email-template"
import { prospectionFromAddress } from "@/lib/prospection-email"
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
  const current = await prisma.client.findFirst({
    where: { id: clientId, userId },
    select: { type: true, prospectStatus: true },
  })
  if (!current) throw new Error("Non autorisé")

  const data: Record<string, unknown> = { prospectStatus: status }
  // Gagné → convertit automatiquement en client ; quitter Gagné → redevient
  // prospect (annulation d'une conversion, pas de clients fantômes).
  if (status === "WON") data.type = "CLIENT"
  else if (current.type === "CLIENT" && current.prospectStatus === "WON") data.type = "PROSPECT"

  await prisma.client.update({ where: { id: clientId, userId }, data: data as never })
  revalidatePath("/prospection")
  revalidatePath(`/contacts/${clientId}`)
}

export async function updateProspectsStatusBulk(clientIds: string[], status: ProspectStatus) {
  const userId = await requireAuth()
  if (status !== "WON") {
    // Annule d'abord les conversions des gagnés inclus dans le lot
    await prisma.client.updateMany({
      where: { id: { in: clientIds }, userId, type: "CLIENT", prospectStatus: "WON" },
      data: { type: "PROSPECT" },
    })
  }
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

// ── Modèles de mails ─────────────────────────────────────────────────────────

// Modèles de départ — {{nom_complet}} = nom du site/de l'entreprise pour les
// prospects ajoutés via l'ajout rapide (le champ name porte le nom du business).
const DEFAULT_EMAIL_TEMPLATES = [
  {
    name: "1er contact — refonte de site",
    subject: "Votre site {{site}} — quelques pistes d'amélioration",
    body: `Bonjour,

Je suis tombé sur le site de {{nom_complet}} ({{site}}) en cherchant des entreprises de la région, et j'ai remarqué quelques points qui pourraient vous faire perdre des clients : affichage sur mobile, vitesse de chargement, visibilité sur Google.

Je suis développeur web indépendant à Lyon et j'aide les petites entreprises à moderniser leur site sans les prix d'agence — souvent en repartant de l'existant.

Seriez-vous ouvert à un échange de 10 minutes cette semaine ? Je peux vous montrer concrètement ce qui peut être amélioré, sans engagement.

Bonne journée,
Pierre — Pedro Dev

PS : si vous ne souhaitez plus recevoir de message de ma part, répondez simplement « stop ».`,
  },
  {
    name: "Relance douce (J+7)",
    subject: "Re : votre site {{site}}",
    body: `Bonjour,

Je me permets une petite relance suite à mon message de la semaine dernière au sujet du site de {{nom_complet}}.

Je sais que ce n'est pas toujours la priorité du moment — si le sujet vous intéresse mais que le timing est mauvais, dites-le moi simplement et je reviendrai vers vous plus tard.

Et si vous préférez ne plus être contacté, un simple « stop » suffit.

Bonne journée,
Pierre — Pedro Dev`,
  },
  {
    name: "Proposition d'audit gratuit",
    subject: "Audit gratuit du site de {{nom_complet}}",
    body: `Bonjour,

Je propose en ce moment un mini-audit gratuit aux entreprises de la région : je passe en revue votre site ({{site}}) et je vous envoie 3 améliorations concrètes et prioritaires — vitesse, mobile, référencement Google.

C'est gratuit, sans engagement, et vous pouvez appliquer les recommandations avec le prestataire de votre choix.

Intéressé ? Répondez simplement à ce mail et je vous envoie l'audit sous 48 h.

Bonne journée,
Pierre — Pedro Dev

PS : pour ne plus recevoir de message de ma part, répondez « stop ».`,
  },
]

/** Provisionne 3 modèles de départ au premier usage — évite de partir d'une page vide. */
export async function getOrCreateDefaultEmailTemplates() {
  const userId = await requireAuth()
  const count = await prisma.emailTemplate.count({ where: { userId } })
  if (count === 0) {
    await prisma.emailTemplate.createMany({
      data: DEFAULT_EMAIL_TEMPLATES.map((t) => ({ userId, ...t })),
    })
  }
  return prisma.emailTemplate.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
  })
}

export async function createEmailTemplate(data: { name: string; subject: string; body: string }) {
  const userId = await requireAuth()
  const name = data.name.trim()
  if (!name) throw new Error("Le nom du modèle est requis")
  const template = await prisma.emailTemplate.create({
    data: { userId, name, subject: data.subject.trim(), body: data.body },
  })
  revalidatePath("/prospection/modeles")
  return template
}

export async function updateEmailTemplate(templateId: string, data: { name: string; subject: string; body: string }) {
  const userId = await requireAuth()
  const updated = await prisma.emailTemplate.updateMany({
    where: { id: templateId, userId },
    data: { name: data.name.trim(), subject: data.subject.trim(), body: data.body },
  })
  if (updated.count === 0) throw new Error("Non autorisé")
  revalidatePath("/prospection/modeles")
}

export async function deleteEmailTemplate(templateId: string) {
  const userId = await requireAuth()
  await prisma.emailTemplate.deleteMany({ where: { id: templateId, userId } })
  revalidatePath("/prospection/modeles")
}

// ── Envoi en masse (Resend) ──────────────────────────────────────────────────

const RESEND_BATCH_SIZE = 100 // limite de l'API batch Resend
const BATCH_INTERVAL_MS = 600 // limite Resend par défaut : 2 req/s

/**
 * Envoie un modèle rendu par prospect via l'API batch Resend.
 * Par envoi réussi : EmailLog (traçabilité) + Interaction (canal EMAIL) +
 * bump TO_CONTACT → CONTACTED. Best-effort par chunk : un chunk en échec
 * n'empêche pas les suivants.
 */
export async function sendProspectionEmails(templateId: string, clientIds: string[]) {
  const userId = await requireAuth()
  const from = prospectionFromAddress()
  if (!from) {
    throw new Error("Adresse d'envoi non configurée — vérifiez un domaine chez Resend puis renseignez RESEND_FROM_EMAIL (hors sandbox resend.dev).")
  }
  await enforceRateLimit(`prospection-email:${userId}`, 300, 3_600_000)

  const template = await prisma.emailTemplate.findFirst({ where: { id: templateId, userId } })
  if (!template) throw new Error("Modèle introuvable")

  const prospects = await prisma.client.findMany({
    where: { id: { in: clientIds }, userId, email: { not: null } },
    select: {
      id: true, name: true, firstName: true, lastName: true, company: true,
      email: true, websiteUrl: true, city: true, region: true, businessDescription: true,
    },
  })
  if (prospects.length === 0) return { sent: 0, failed: 0, skippedNoEmail: clientIds.length }

  let sent = 0
  let failed = 0

  for (let i = 0; i < prospects.length; i += RESEND_BATCH_SIZE) {
    const chunk = prospects.slice(i, i + RESEND_BATCH_SIZE)
    const emails = chunk.map((p) => {
      const rendered = renderTemplate(template, p)
      return {
        from,
        to: p.email!,
        subject: rendered.subject,
        html: bodyToHtml(rendered.body),
        text: rendered.body,
      }
    })

    try {
      const { data, error } = await getResend().batch.send(emails)
      if (error || !data) {
        failed += chunk.length
      } else {
        // La réponse batch préserve l'ordre d'envoi.
        const now = new Date()
        await prisma.emailLog.createMany({
          data: chunk.map((p, j) => ({
            userId,
            clientId: p.id,
            to: p.email!,
            subject: emails[j].subject,
            resendMessageId: data.data[j]?.id ?? null,
          })),
        })
        await prisma.interaction.createMany({
          data: chunk.map((p) => ({
            clientId: p.id,
            date: now,
            channel: "EMAIL" as InteractionChannel,
            summary: `Email "${template.name}" envoyé via l'ERP`,
          })),
        })
        await prisma.client.updateMany({
          where: { id: { in: chunk.map((p) => p.id) }, userId, prospectStatus: "TO_CONTACT" },
          data: { prospectStatus: "CONTACTED" },
        })
        sent += chunk.length
      }
    } catch {
      failed += chunk.length
    }

    if (i + RESEND_BATCH_SIZE < prospects.length) {
      await new Promise((r) => setTimeout(r, BATCH_INTERVAL_MS))
    }
  }

  revalidatePath("/prospection")
  return { sent, failed, skippedNoEmail: clientIds.length - prospects.length }
}
