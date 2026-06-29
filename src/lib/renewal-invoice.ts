// Logique de création de facture de reconduction — partagée entre le Server Action
// (déclenché manuellement depuis l'UI) et la route cron (déclenchée automatiquement à l'échéance).

import { prisma } from "@/lib/prisma"
import { addMonths } from "@/lib/dates"
import { nextInvoiceNumber, defaultEmitterId } from "@/lib/invoice-helpers"

// ── Type partagé ───────────────────────────────────────────────────────────────

export type RenewalForInvoice = {
  id: string
  type: string
  name: string
  amount: number | null
  periodMonths: number | null
  expiresAt: Date
  postDev: {
    project: {
      id: string
      userId: string
      clientId: string | null
      companyId: string | null
      contactLinks: { clientId: string; role: string }[]
    }
  }
}

// ── Fonction principale ────────────────────────────────────────────────────────

/**
 * Crée une facture brouillon RECURRING pour un renouvellement donné, puis
 * avance l'échéance de periodMonths et remet les flags de rappel à zéro.
 * Ne fait PAS revalidatePath — l'appelant gère ça selon son contexte.
 */
export async function createRenewalDraftInvoice(
  renewal: RenewalForInvoice,
  userId: string
): Promise<{ invoiceId: string; projectId: string }> {
  if (!renewal.amount || renewal.amount <= 0) {
    throw new Error("Pas de montant facturable sur ce renouvellement")
  }
  const project = renewal.postDev.project

  // Cherche un modèle de conditions adapté au type de renouvellement
  const wanted = renewal.type === "DOMAIN"
    ? ["domaine", "reconduc", "abonnement"]
    : ["reconduc", "abonnement", "hébergement", "hebergement"]

  // Les trois premières requêtes sont indépendantes — on les parallélise.
  const [templates, number, emitterId] = await Promise.all([
    prisma.conditionsTemplate.findMany({
      where: { userId },
      select: { name: true, content: true, isDefault: true },
    }),
    nextInvoiceNumber(userId),
    defaultEmitterId(userId),
  ])

  const match =
    templates.find((t) => wanted.some((w) => t.name.toLowerCase().includes(w))) ??
    templates.find((t) => t.isDefault)

  const periodLabel = renewal.periodMonths ? ` (${renewal.periodMonths} mois)` : ""

  // Résout le client facturable (M2M > legacy clientId > société)
  const clientLink = project.contactLinks.find(l => l.role === "CLIENT") ?? project.contactLinks[0]
  const billingClientId =
    project.clientId ??
    clientLink?.clientId ??
    (project.companyId
      ? (await prisma.client.findFirst({ where: { companyId: project.companyId, userId }, select: { id: true } }))?.id ?? null
      : null)
  if (!billingClientId) {
    throw new Error("Le projet n'a pas de contact facturable")
  }

  const invoice = await prisma.invoice.create({
    data: {
      userId,
      clientId: billingClientId,
      projectId: project.id,
      emitterProfileId: emitterId,
      number,
      type: "RECURRING",
      status: "DRAFT",
      totalHT: renewal.amount,
      depositDeducted: 0,
      generalConditions: match?.content ?? null,
      lines: {
        create: [{
          description: renewal.name + periodLabel,
          quantity: 1,
          unitPrice: renewal.amount,
          taxRate: 0,
          total: renewal.amount,
        }],
      },
    },
    select: { id: true },
  })

  // Avance l'échéance + réarme les rappels (idempotence naturelle pour le cron)
  if (renewal.periodMonths) {
    const next = addMonths(renewal.expiresAt, renewal.periodMonths)
    await prisma.renewal.update({
      where: { id: renewal.id },
      data: { expiresAt: next, reminderSent30: false, reminderSent7: false },
    })
  }

  return { invoiceId: invoice.id, projectId: project.id }
}
