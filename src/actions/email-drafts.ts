"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { auth } from "@/lib/auth"
import { getResend } from "@/lib/resend"
import { enforceRateLimit } from "@/lib/rate-limit"
import {
  renderTemplate,
  bodyToHtml,
  residualTemplateVars,
  isValidEmailAddress,
} from "@/lib/email-template"
import { prospectionFromAddress } from "@/lib/prospection-email"
import type { InteractionChannel } from "@/generated/prisma/enums"

/**
 * File de brouillons de prospection — contrôle à 100 % de l'écriture ET de
 * l'envoi : génération de brouillons personnalisés, relecture/édition un par
 * un, marquage « relu » explicite (READY), envoi uniquement des relus après
 * confirmation. Toute édition repasse en DRAFT (une modif après relecture
 * exige une nouvelle relecture). Jamais d'envoi automatique.
 */

async function requireAuth(): Promise<string> {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Non autorisé")
  return session.user.id
}

// Statuts « actifs » : un prospect ne peut avoir qu'un brouillon en file à la
// fois (SENT/CANCELLED n'empêchent pas d'en régénérer un).
const ACTIVE_STATUSES = ["DRAFT", "READY"] as const

function revalidateDraftPaths() {
  revalidatePath("/prospection/brouillons")
  revalidatePath("/prospection") // badge compteur
}

/**
 * Génère un brouillon par prospect à partir d'un modèle (renderTemplate) :
 * destinataire figé (= email du prospect, éditable ensuite), variables vides
 * tracées dans missingVars. Les prospects ayant déjà un brouillon actif
 * (DRAFT/READY) sont sautés pour éviter les doublons en file.
 */
export async function generateEmailDrafts(clientIds: string[], templateId: string) {
  const userId = await requireAuth()

  const template = await prisma.emailTemplate.findFirst({ where: { id: templateId, userId } })
  if (!template) throw new Error("Modèle introuvable")

  // Anti-IDOR : seuls les prospects du user sont retenus.
  const prospects = await prisma.client.findMany({
    where: { id: { in: clientIds }, userId },
    select: {
      id: true, name: true, firstName: true, lastName: true, company: true,
      email: true, websiteUrl: true, city: true, region: true, businessDescription: true,
      cms: true, seoScore: true, performanceScore: true, seoIssues: true,
      publicationManager: true, domainCreatedAt: true,
    },
  })
  if (prospects.length === 0) return { created: 0, skipped: 0 }

  const alreadyQueued = await prisma.emailDraft.findMany({
    where: {
      userId,
      clientId: { in: prospects.map((p) => p.id) },
      status: { in: [...ACTIVE_STATUSES] },
    },
    select: { clientId: true },
  })
  const queuedIds = new Set(alreadyQueued.map((d) => d.clientId))

  const toCreate = prospects.filter((p) => !queuedIds.has(p.id))
  if (toCreate.length > 0) {
    await prisma.emailDraft.createMany({
      data: toCreate.map((p) => {
        const rendered = renderTemplate(template, p)
        return {
          userId,
          clientId: p.id,
          templateId: template.id,
          emailTo: p.email?.trim() || null,
          subject: rendered.subject,
          body: rendered.body,
          missingVars: rendered.missing.length > 0 ? rendered.missing.join(",") : null,
        }
      }),
    })
  }

  revalidateDraftPaths()
  return { created: toCreate.length, skipped: prospects.length - toCreate.length }
}

/**
 * Édition d'un brouillon (sujet, corps, destinataire). Toute édition repasse
 * le brouillon en DRAFT — une modification après relecture exige une nouvelle
 * relecture — et recalcule missingVars à partir des {{variables}} encore
 * présentes dans le texte édité.
 */
export async function updateEmailDraft(
  id: string,
  data: { subject?: string; body?: string; emailTo?: string | null }
) {
  const userId = await requireAuth()
  const draft = await prisma.emailDraft.findFirst({ where: { id, userId } })
  if (!draft) throw new Error("Brouillon introuvable")
  if (draft.status === "SENT" || draft.status === "CANCELLED") {
    throw new Error("Ce brouillon n'est plus modifiable")
  }

  const subject = data.subject !== undefined ? data.subject : draft.subject
  const body = data.body !== undefined ? data.body : draft.body
  const emailTo = data.emailTo !== undefined ? (data.emailTo?.trim() || null) : draft.emailTo
  const residual = residualTemplateVars(subject, body)

  const updated = await prisma.emailDraft.update({
    where: { id: draft.id },
    data: {
      subject,
      body,
      emailTo,
      missingVars: residual.length > 0 ? residual.join(",") : null,
      status: "DRAFT",
    },
  })
  revalidateDraftPaths()
  return updated
}

/**
 * Marquage « relu » : DRAFT → READY. Refusé côté serveur si le destinataire
 * est vide/invalide, si des {{variables}} subsistent dans sujet/corps, ou si
 * des variables manquantes tracées à la génération n'ont pas été revues
 * (toute édition/sauvegarde les recalcule).
 */
export async function setEmailDraftReady(id: string) {
  const userId = await requireAuth()
  const draft = await prisma.emailDraft.findFirst({ where: { id, userId } })
  if (!draft) throw new Error("Brouillon introuvable")
  if (draft.status !== "DRAFT") throw new Error("Seul un brouillon peut être marqué relu")

  if (!isValidEmailAddress(draft.emailTo)) {
    throw new Error("Destinataire vide ou invalide — renseignez un email valide avant de marquer relu")
  }
  if (residualTemplateVars(draft.subject, draft.body).length > 0) {
    throw new Error("Des {{variables}} non substituées subsistent dans le sujet ou le corps")
  }
  if (draft.missingVars) {
    throw new Error(
      `Variables manquantes à la génération (${draft.missingVars}) — éditez le texte pour combler les trous`
    )
  }

  await prisma.emailDraft.update({ where: { id: draft.id }, data: { status: "READY" } })
  revalidateDraftPaths()
}

/** Retour en relecture : READY → DRAFT. */
export async function setEmailDraftBack(id: string) {
  const userId = await requireAuth()
  const res = await prisma.emailDraft.updateMany({
    where: { id, userId, status: "READY" },
    data: { status: "DRAFT" },
  })
  if (res.count === 0) throw new Error("Brouillon introuvable ou non relu")
  revalidateDraftPaths()
}

/** Écarte un brouillon sans l'envoyer (DRAFT/READY → CANCELLED). */
export async function cancelEmailDraft(id: string) {
  const userId = await requireAuth()
  const res = await prisma.emailDraft.updateMany({
    where: { id, userId, status: { in: [...ACTIVE_STATUSES] } },
    data: { status: "CANCELLED" },
  })
  if (res.count === 0) throw new Error("Brouillon introuvable ou déjà traité")
  revalidateDraftPaths()
}

/** Suppression définitive d'un brouillon (l'historique d'envoi vit dans EmailLog). */
export async function deleteEmailDraft(id: string) {
  const userId = await requireAuth()
  await prisma.emailDraft.deleteMany({ where: { id, userId } })
  revalidateDraftPaths()
}

// ── Envoi des brouillons relus (Resend) ──────────────────────────────────────

const RESEND_BATCH_SIZE = 100 // limite de l'API batch Resend
const BATCH_INTERVAL_MS = 600 // limite Resend par défaut : 2 req/s

/**
 * Envoie les brouillons relus — SEUL chemin d'envoi de la file, toujours
 * derrière une confirmation récapitulative côté UI. Défense en profondeur :
 * chaque brouillon est re-vérifié côté serveur (propriétaire, statut READY,
 * destinataire valide, aucune {{variable}} résiduelle) — tout brouillon non
 * conforme est refusé, jamais envoyé.
 *
 * Par envoi réussi : EmailLog (traçabilité), Interaction EMAIL (sujet en
 * summary), bump TO_CONTACT → CONTACTED, brouillon marqué SENT + sentAt.
 * Best-effort par lot Resend : un lot en échec n'empêche pas les suivants.
 */
/**
 * Envoie un brouillon EN TEST à l'adresse du compte connecté (jamais au
 * prospect) : sujet préfixé [TEST], aucun EmailLog/Interaction, statut du
 * brouillon inchangé — pour vérifier le rendu réel dans sa propre boîte
 * avant de marquer relu.
 */
export async function sendDraftTest(id: string): Promise<{ to: string }> {
  const session = await auth()
  const userId = session?.user?.id
  const selfEmail = session?.user?.email
  if (!userId) throw new Error("Non autorisé")
  if (!selfEmail) throw new Error("Adresse du compte introuvable")

  const from = prospectionFromAddress()
  if (!from) {
    throw new Error("Adresse d'envoi non configurée — vérifiez un domaine chez Resend puis renseignez RESEND_FROM_EMAIL (hors sandbox resend.dev).")
  }
  await enforceRateLimit(`prospection-email-test:${userId}`, 30, 3_600_000)

  const draft = await prisma.emailDraft.findFirst({ where: { id, userId } })
  if (!draft) throw new Error("Brouillon introuvable")
  if (draft.status === "SENT" || draft.status === "CANCELLED") {
    throw new Error("Ce brouillon n'est plus actif")
  }

  const { error } = await getResend().emails.send({
    from,
    to: selfEmail,
    subject: `[TEST] ${draft.subject}`,
    html: bodyToHtml(draft.body),
    text: draft.body,
  })
  if (error) throw new Error(`Échec de l'envoi du test : ${error.message}`)
  return { to: selfEmail }
}

export async function sendReadyDrafts(draftIds: string[]) {
  const userId = await requireAuth()
  const from = prospectionFromAddress()
  if (!from) {
    throw new Error("Adresse d'envoi non configurée — vérifiez un domaine chez Resend puis renseignez RESEND_FROM_EMAIL (hors sandbox resend.dev).")
  }
  await enforceRateLimit(`prospection-email:${userId}`, 300, 3_600_000)

  const uniqueIds = [...new Set(draftIds)]
  const drafts = await prisma.emailDraft.findMany({
    where: { id: { in: uniqueIds }, userId },
  })

  // Re-vérification serveur de chaque brouillon (défense en profondeur).
  const sendable = drafts.filter(
    (d) =>
      d.status === "READY" &&
      isValidEmailAddress(d.emailTo) &&
      !d.missingVars &&
      residualTemplateVars(d.subject, d.body).length === 0
  )
  const refused = uniqueIds.length - sendable.length

  if (sendable.length === 0) return { sent: 0, failed: 0, refused }

  let sent = 0
  let failed = 0

  for (let i = 0; i < sendable.length; i += RESEND_BATCH_SIZE) {
    const chunk = sendable.slice(i, i + RESEND_BATCH_SIZE)
    const emails = chunk.map((d) => ({
      from,
      to: d.emailTo!,
      subject: d.subject,
      html: bodyToHtml(d.body),
      text: d.body,
    }))

    try {
      const { data, error } = await getResend().batch.send(emails)
      if (error || !data) {
        failed += chunk.length
      } else {
        // La réponse batch préserve l'ordre d'envoi.
        const now = new Date()
        await prisma.emailLog.createMany({
          data: chunk.map((d, j) => ({
            userId,
            clientId: d.clientId,
            to: d.emailTo!,
            subject: d.subject,
            resendMessageId: data.data[j]?.id ?? null,
          })),
        })
        await prisma.interaction.createMany({
          data: chunk.map((d) => ({
            clientId: d.clientId,
            date: now,
            channel: "EMAIL" as InteractionChannel,
            summary: `Email « ${d.subject} » envoyé via l'ERP (brouillon relu)`,
          })),
        })
        await prisma.client.updateMany({
          where: { id: { in: chunk.map((d) => d.clientId) }, userId, prospectStatus: "TO_CONTACT" },
          data: { prospectStatus: "CONTACTED" },
        })
        await prisma.emailDraft.updateMany({
          where: { id: { in: chunk.map((d) => d.id) }, userId },
          data: { status: "SENT", sentAt: now },
        })
        sent += chunk.length
      }
    } catch {
      failed += chunk.length
    }

    if (i + RESEND_BATCH_SIZE < sendable.length) {
      await new Promise((r) => setTimeout(r, BATCH_INTERVAL_MS))
    }
  }

  revalidateDraftPaths()
  return { sent, failed, refused }
}
