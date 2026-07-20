"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { auth } from "@/lib/auth"
import { getResend } from "@/lib/resend"
import { enforceRateLimit } from "@/lib/rate-limit"
import { renderTemplate, bodyToHtml } from "@/lib/email-template"
import { prospectionFromAddress } from "@/lib/prospection-email"
import type { ClientSource, InteractionChannel, ProspectStatus, ProspectEventKind } from "@/generated/prisma/enums"

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
      // Un prospect créé dans le module vient de la prospection par défaut
      source: (data.source as ClientSource) || "PROSPECTION",
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
  // Frise chronologique : tout changement de statut laisse une trace datée
  if (current.prospectStatus !== status) {
    await prisma.prospectEvent.create({
      data: { clientId, kind: "STATUS_CHANGE", fromStatus: current.prospectStatus, toStatus: status },
    })
  }
  revalidatePath("/prospection")
  revalidatePath(`/contacts/${clientId}`)
}

export async function updateProspectsStatusBulk(clientIds: string[], status: ProspectStatus) {
  const userId = await requireAuth()
  // Statuts courants AVANT mutation, pour tracer les transitions réelles
  const owned = await prisma.client.findMany({
    where: { id: { in: clientIds }, userId },
    select: { id: true, prospectStatus: true },
  })
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
  const changed = owned.filter((c) => c.prospectStatus !== status)
  if (changed.length > 0) {
    await prisma.prospectEvent.createMany({
      data: changed.map((c) => ({
        clientId: c.id, kind: "STATUS_CHANGE" as ProspectEventKind,
        fromStatus: c.prospectStatus as ProspectStatus, toStatus: status,
      })),
    })
  }
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
  // Frise : un événement par prospect (EMAIL_SENT pour les emails, sinon trace
  // du contact via le canal en note)
  await prisma.prospectEvent.createMany({
    data: owned.map((c) => ({
      clientId: c.id,
      kind: (channel === "EMAIL" ? "EMAIL_SENT" : "STATUS_CHANGE") as ProspectEventKind,
      note: note?.trim() || `${channelLabels[channel] ?? "Contact"} de prospection`,
      date: now,
    })),
  })
  revalidatePath("/prospection")
  return { contacted: owned.length }
}

/**
 * Recherche allégée de prospects par nom pour le quick-add mobile —
 * sélection minimale, 8 résultats max.
 */
export async function searchProspectsQuick(query: string) {
  const userId = await requireAuth()
  const q = query.trim()
  if (!q) return []
  return prisma.client.findMany({
    where: {
      userId,
      type: "PROSPECT",
      name: { contains: q, mode: "insensitive" },
    },
    orderBy: { name: "asc" },
    take: 8,
    select: { id: true, name: true, company: true, prospectStatus: true },
  })
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
        source: SOURCES.includes(row.source ?? "") ? (row.source as ClientSource) : "PROSPECTION",
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
// Signature (adresse postale + désinscription RGPD/LCEN) : à mettre dans la
// signature Gmail de Pierre, PAS dans le corps → Gmail l'ajoute automatiquement.
const DEFAULT_EMAIL_TEMPLATES = [
  {
    name: "1er contact — offre mensuelle",
    subject: "Une idée pour améliorer votre site",
    sortOrder: 0,
    body: `Bonjour,

Développeur web indépendant depuis plusieurs années, j'accompagne les PME et TPE dans leurs projets web.

Je suis tombé sur votre site ({{site}}) et j'ai des idées concrètes pour le rendre plus moderne, plus rapide et mieux visible sur Google.

Je propose une formule tout compris au mois — création, hébergement, maintenance et mises à jour — sans les engagements de plusieurs années qu'on voit souvent ailleurs.

Est-ce que ça vous dirait d'en discuter 15 min, sans engagement ? Je vous montre ce qu'on pourrait faire ensemble.

Bonne journée,
Pierre — Pedro Dev, développeur web à Lyon`,
  },
  {
    name: "Relance (J+5)",
    subject: "Re : votre site",
    sortOrder: 1,
    body: `Bonjour,

Je me permets une relance rapide sur mon message concernant votre site ({{site}}).

Si le sujet vous intéresse mais que le moment est mal choisi (vacances d'été !), dites-le-moi et je reviendrai vers vous en septembre.

Et si vous préférez ne plus être contacté, un simple « stop » suffit.

Bonne journée,
Pierre — Pedro Dev`,
  },
  {
    name: "Audit gratuit",
    subject: "Un regard gratuit sur votre site",
    sortOrder: 2,
    body: `Bonjour,

Développeur web indépendant à Lyon, j'accompagne les PME et TPE sur leur présence en ligne.

Je propose en ce moment un mini-audit gratuit : je regarde votre site ({{site}}) et je vous envoie 3 améliorations concrètes et prioritaires (vitesse, mobile, visibilité Google) — sans engagement, à appliquer avec le prestataire de votre choix.

Ça vous intéresse ? Répondez simplement à ce mail et je vous l'envoie sous 48 h.

Bonne journée,
Pierre — Pedro Dev`,
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
    orderBy: [{ sortOrder: "asc" }, { updatedAt: "desc" }],
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

/**
 * Persiste l'ordre d'affichage choisi par l'utilisateur (drag & drop) :
 * chaque modèle reçoit son rang dans `orderedIds`. Scoped par userId
 * (updateMany anti-IDOR) — un id étranger ne matche rien.
 */
export async function reorderEmailTemplates(orderedIds: string[]) {
  const userId = await requireAuth()
  await prisma.$transaction(
    orderedIds.map((id, index) =>
      prisma.emailTemplate.updateMany({ where: { id, userId }, data: { sortOrder: index } })
    )
  )
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
      cms: true, seoScore: true, performanceScore: true, seoIssues: true,
      publicationManager: true, domainCreatedAt: true,
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
        await prisma.prospectEvent.createMany({
          data: chunk.map((p) => ({
            clientId: p.id,
            kind: "EMAIL_SENT" as ProspectEventKind,
            note: `Email « ${template.name} »`,
            date: now,
          })),
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

// ─── Mode prospection : actions rapides, frise et notes ─────────────────────

// Statut cible de chaque action rapide (avancement uniquement : on ne
// rétrograde jamais un prospect plus avancé ; un Gagné reste gagné).
const ACTION_TARGET_STATUS: Record<Exclude<ProspectEventKind, "STATUS_CHANGE">, ProspectStatus> = {
  CALL_NO_ANSWER: "CONTACTED",
  CALL_ANSWERED:  "REPLIED",
  EMAIL_SENT:     "CONTACTED",
  REPLY_POSITIVE: "IN_DISCUSSION",
  REPLY_NEGATIVE: "LOST",
  MEETING_BOOKED: "IN_DISCUSSION",
}

const ACTION_INTERACTION: Record<Exclude<ProspectEventKind, "STATUS_CHANGE">, { channel: InteractionChannel; summary: string }> = {
  CALL_NO_ANSWER: { channel: "CALL",    summary: "Appel de prospection — pas de réponse" },
  CALL_ANSWERED:  { channel: "CALL",    summary: "Appel de prospection — a répondu" },
  EMAIL_SENT:     { channel: "EMAIL",   summary: "Email de prospection envoyé" },
  REPLY_POSITIVE: { channel: "EMAIL",   summary: "Réponse positive du prospect" },
  REPLY_NEGATIVE: { channel: "EMAIL",   summary: "Réponse négative du prospect" },
  MEETING_BOOKED: { channel: "MEETING", summary: "Rendez-vous fixé" },
}

const PIPELINE_ORDER: ProspectStatus[] = ["TO_CONTACT", "CONTACTED", "REPLIED", "IN_DISCUSSION"]

/**
 * Action rapide du mode prospection : trace l'événement dans la frise, avance
 * le statut si l'action l'implique (jamais de rétrogradation), et crée
 * l'interaction CRM correspondante (visible sur la fiche contact).
 */
export async function logProspectAction(
  clientId: string,
  kind: Exclude<ProspectEventKind, "STATUS_CHANGE">,
  note?: string,
) {
  const userId = await requireAuth()
  const current = await prisma.client.findFirst({
    where: { id: clientId, userId },
    select: { prospectStatus: true },
  })
  if (!current) throw new Error("Non autorisé")

  const target = ACTION_TARGET_STATUS[kind]
  const from = current.prospectStatus as ProspectStatus
  let to = from
  if (from !== "WON") {
    if (target === "LOST") to = "LOST"
    else {
      const ci = PIPELINE_ORDER.indexOf(from)
      const ti = PIPELINE_ORDER.indexOf(target)
      // Depuis LOST (ci === -1), une action de contact relance le pipeline
      to = ci === -1 || ti > ci ? target : from
    }
  }

  const now = new Date()
  const interaction = ACTION_INTERACTION[kind]
  const event = await prisma.$transaction(async (tx) => {
    if (to !== from) {
      await tx.client.update({ where: { id: clientId, userId }, data: { prospectStatus: to } })
    }
    const ev = await tx.prospectEvent.create({
      data: {
        clientId, kind, date: now, note: note?.trim() || null,
        ...(to !== from ? { fromStatus: from, toStatus: to } : {}),
      },
    })
    await tx.interaction.create({
      data: { clientId, date: now, channel: interaction.channel, summary: interaction.summary },
    })
    return ev
  })

  revalidatePath("/prospection")
  revalidatePath(`/contacts/${clientId}`)
  // L'événement est renvoyé pour mise à jour instantanée de la frise côté client
  return { status: to, event }
}

export async function createProspectNote(clientId: string, data: { title: string; content?: string | null }) {
  const userId = await requireAuth()
  const owned = await prisma.client.findFirst({ where: { id: clientId, userId }, select: { id: true } })
  if (!owned) throw new Error("Non autorisé")
  const note = await prisma.prospectNote.create({
    data: { clientId, title: data.title.trim(), content: data.content?.trim() || null },
  })
  revalidatePath("/prospection")
  return note
}

export async function updateProspectNote(noteId: string, data: { title: string; content?: string | null }) {
  const userId = await requireAuth()
  const { count } = await prisma.prospectNote.updateMany({
    where: { id: noteId, client: { userId } },
    data: { title: data.title.trim(), content: data.content?.trim() || null },
  })
  if (count === 0) throw new Error("Note introuvable")
  revalidatePath("/prospection")
}

export async function deleteProspectNote(noteId: string) {
  const userId = await requireAuth()
  await prisma.prospectNote.deleteMany({ where: { id: noteId, client: { userId } } })
  revalidatePath("/prospection")
}
