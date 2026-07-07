"use server"

import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { revalidatePath } from "next/cache"
import {
  periodBounds,
  declarationDueDate,
  declarationAvailableFrom,
  periodToDeclare,
  periodLabel,
  type FiscalCategory,
  type DeclarationFrequency,
} from "@/lib/urssaf"

/** Marque comme terminé le rappel calendrier lié à cette période, s'il existe. */
async function completeUrssafReminderTask(userId: string, period: string) {
  await prisma.task.updateMany({
    where: { userId, urssafPeriod: period, status: { not: "DONE" } },
    data: { status: "DONE", completedAt: new Date() },
  })
}

// ── Déclarations URSSAF ───────────────────────────────────────────────────────

export type SuggestedLine = {
  category:        FiscalCategory
  invoiceId:        string | null
  revenueId:        string | null
  label:            string
  amount:           number
  status:           string  // statut réel de la facture/revenu source, pour affichage
  defaultIncluded:  boolean // pré-coché : déjà encaissé sur la période (payée/reçu)
}

/**
 * Toutes les factures et revenus rattachables à la période — quel que soit leur
 * statut (émise, envoyée, en retard, payée, en attente de réception…) — pour que
 * l'utilisateur les relie directement à la déclaration sans ressaisie manuelle.
 * Seules celles déjà encaissées sur la période sont pré-cochées par défaut ;
 * les autres restent visibles pour être rattachées au bon moment.
 * Exclut les factures déjà liées à une déclaration (contrainte d'unicité) et
 * celles marquées hors URSSAF. Catégorie pré-remplie depuis
 * Client.defaultFiscalCategory (BNC par défaut).
 */
export async function suggestDeclarationLines(period: string): Promise<SuggestedLine[]> {
  const session = await auth()
  const userId = session!.user.id
  const { start, end } = periodBounds(period)
  const inRange = { gte: start, lte: end }

  const [invoices, revenues] = await Promise.all([
    prisma.invoice.findMany({
      where: {
        userId,
        status: { notIn: ["DRAFT", "CANCELLED"] },
        urssafExcluded: false,
        urssafLine: null,
        OR: [
          { paidAt:   inRange },
          { issuedAt: inRange },
          { sentAt:   inRange },
          { dueDate:  inRange },
        ],
      },
      include: { client: { select: { name: true, defaultFiscalCategory: true } } },
      orderBy: [{ paidAt: "asc" }, { issuedAt: "asc" }],
    }),
    prisma.revenue.findMany({
      where: {
        userId,
        urssafLine: null,
        fiscalSource: { bucket: "AE_URSSAF" },
        OR: [
          { receivedAt: inRange },
          { expectedAt: inRange },
        ],
      },
      include: { client: { select: { defaultFiscalCategory: true } } },
      orderBy: [{ receivedAt: "asc" }, { expectedAt: "asc" }],
    }),
  ])

  const lines: SuggestedLine[] = [
    ...invoices.map(inv => ({
      category:  (inv.client.defaultFiscalCategory ?? "BNC") as FiscalCategory,
      invoiceId: inv.id,
      revenueId: null,
      label:     `${inv.number} — ${inv.client.name}`,
      amount:    inv.totalHT,
      status:    inv.status,
      defaultIncluded: inv.status === "PAID" && !!inv.paidAt && inv.paidAt >= start && inv.paidAt <= end,
    })),
    ...revenues.map(rev => ({
      category:  (rev.client?.defaultFiscalCategory ?? "BNC") as FiscalCategory,
      invoiceId: null,
      revenueId: rev.id,
      label:     rev.label,
      amount:    rev.amount,
      status:    rev.status,
      defaultIncluded: rev.status === "RECEIVED" && !!rev.receivedAt && rev.receivedAt >= start && rev.receivedAt <= end,
    })),
  ]

  // Encaissées d'abord, puis par ordre alphabétique — les lignes en attente
  // restent visibles mais ne polluent pas le haut de la liste pré-cochée.
  return lines.sort((a, b) =>
    a.defaultIncluded === b.defaultIncluded
      ? a.label.localeCompare(b.label, "fr")
      : a.defaultIncluded ? -1 : 1
  )
}

type LineInput = {
  category:   FiscalCategory
  invoiceId?: string | null
  revenueId?: string | null
  label:      string
  amount:     number
}

function sumByCategory(lines: LineInput[]) {
  const sum = (cat: FiscalCategory) =>
    lines.filter(l => l.category === cat).reduce((acc, l) => acc + l.amount, 0)
  return {
    amountBNC:         sum("BNC"),
    amountBICServices: sum("BIC_SERVICES"),
    amountBICSales:    sum("BIC_SALES"),
  }
}

export async function createUrssafDeclaration(data: {
  period: string
  lines:  LineInput[]
  notes?: string | null
}): Promise<{ id?: string; error?: string }> {
  const session = await auth()
  const userId = session!.user.id

  const existing = await prisma.urssafDeclaration.findUnique({
    where: { userId_period: { userId, period: data.period } },
  })
  if (existing) return { error: `Une déclaration existe déjà pour ${data.period}` }

  const { start, end } = periodBounds(data.period)
  const decl = await prisma.urssafDeclaration.create({
    data: {
      userId,
      period:      data.period,
      periodStart: start,
      periodEnd:   end,
      dueDate:     declarationDueDate(data.period),
      notes:       data.notes ?? null,
      ...sumByCategory(data.lines),
      lines: {
        create: data.lines.map(l => ({
          category:  l.category as never,
          invoiceId: l.invoiceId ?? null,
          revenueId: l.revenueId ?? null,
          label:     l.label.trim(),
          amount:    l.amount,
        })),
      },
    },
  })
  revalidatePath("/impots")
  return { id: decl.id }
}

/** Remplace les lignes d'une déclaration (uniquement en brouillon). */
export async function updateUrssafDeclarationLines(
  id: string,
  lines: LineInput[],
  notes?: string | null
): Promise<{ error?: string }> {
  const session = await auth()
  const userId = session!.user.id

  const decl = await prisma.urssafDeclaration.findFirst({ where: { id, userId } })
  if (!decl) return { error: "Déclaration introuvable" }
  if (decl.status !== "DRAFT") return { error: "Seule une déclaration en brouillon est modifiable" }

  await prisma.$transaction([
    prisma.urssafDeclarationLine.deleteMany({ where: { declarationId: id } }),
    prisma.urssafDeclaration.update({
      where: { id },
      data: {
        ...sumByCategory(lines),
        ...(notes !== undefined ? { notes } : {}),
        lines: {
          create: lines.map(l => ({
            category:  l.category as never,
            invoiceId: l.invoiceId ?? null,
            revenueId: l.revenueId ?? null,
            label:     l.label.trim(),
            amount:    l.amount,
          })),
        },
      },
    }),
  ])
  revalidatePath("/impots")
  return {}
}

export async function markUrssafDeclared(
  id: string,
  declaredAt: Date
): Promise<{ error?: string }> {
  const session = await auth()
  const userId = session!.user.id

  const decl = await prisma.urssafDeclaration.findFirst({ where: { id, userId } })
  if (!decl) return { error: "Déclaration introuvable" }

  await prisma.urssafDeclaration.update({
    where: { id },
    data: { status: "DECLARED", declaredAt },
  })
  await completeUrssafReminderTask(userId, decl.period)
  revalidatePath("/impots")
  revalidatePath("/taches")
  revalidatePath("/calendrier")
  return {}
}

/** Enregistre les montants réellement prélevés (récap URSSAF) et passe en PAID. */
export async function markUrssafPaid(
  id: string,
  data: {
    paidAt:               Date
    cotisations:          number
    cfp:                  number
    versementLiberatoire: number
  }
): Promise<{ error?: string }> {
  const session = await auth()
  const userId = session!.user.id

  const decl = await prisma.urssafDeclaration.findFirst({ where: { id, userId } })
  if (!decl) return { error: "Déclaration introuvable" }

  await prisma.urssafDeclaration.update({
    where: { id },
    data: {
      status:               "PAID",
      paidAt:               data.paidAt,
      declaredAt:           decl.declaredAt ?? data.paidAt,
      cotisations:          data.cotisations,
      cfp:                  data.cfp,
      versementLiberatoire: data.versementLiberatoire,
      totalPaid:            data.cotisations + data.cfp + data.versementLiberatoire,
    },
  })
  await completeUrssafReminderTask(userId, decl.period)
  revalidatePath("/impots")
  revalidatePath("/taches")
  revalidatePath("/calendrier")
  return {}
}

export async function deleteUrssafDeclaration(id: string): Promise<{ error?: string }> {
  const session = await auth()
  const userId = session!.user.id

  const decl = await prisma.urssafDeclaration.findFirst({ where: { id, userId } })
  if (!decl) return { error: "Déclaration introuvable" }

  await prisma.urssafDeclaration.delete({ where: { id } })
  revalidatePath("/impots")
  return {}
}

/**
 * Crée, si besoin, une tâche/rappel calendrier pour déclarer la dernière
 * période échue — idempotent, appelé à chaque chargement de l'app. La tâche
 * apparaît automatiquement dans le calendrier (projection standard des Task
 * avec dueDate) et se termine toute seule quand la déclaration correspondante
 * passe à DECLARED ou PAID (voir markUrssafDeclared / markUrssafPaid).
 */
export async function ensureUrssafReminderTask(userId: string, frequency: DeclarationFrequency) {
  const period = periodToDeclare(new Date(), frequency)

  const [existingTask, existingDeclaration] = await Promise.all([
    prisma.task.findFirst({ where: { userId, urssafPeriod: period } }),
    prisma.urssafDeclaration.findUnique({ where: { userId_period: { userId, period } } }),
  ])

  if (existingDeclaration && existingTask && existingTask.status !== "DONE") {
    // La déclaration existe déjà (créée sans passer par le rappel) — on solde la tâche.
    await completeUrssafReminderTask(userId, period)
    return
  }
  if (existingTask || existingDeclaration) return

  await prisma.task.create({
    data: {
      userId,
      title:       `Déclarer l'URSSAF — ${periodLabel(period)}`,
      description: `Rappel : chiffre d'affaires à déclarer sur autoentrepreneur.urssaf.fr pour la période ${periodLabel(period)}. Ouvrez la page Impôts de l'app pour préparer et enregistrer la déclaration.`,
      dueDate:     declarationAvailableFrom(period),
      priority:    "MEDIUM",
      urssafPeriod: period,
    },
  })
}

// ── Flags fiscaux sur factures et clients ─────────────────────────────────────

/** Facture hors auto-entreprise : terminée dès paiement, jamais proposée en déclaration. */
export async function setInvoiceUrssafExcluded(
  invoiceId: string,
  excluded: boolean
): Promise<{ error?: string }> {
  const session = await auth()
  const userId = session!.user.id

  const inv = await prisma.invoice.findFirst({
    where: { id: invoiceId, userId },
    include: { urssafLine: true },
  })
  if (!inv) return { error: "Facture introuvable" }
  if (excluded && inv.urssafLine) {
    return { error: "Cette facture est liée à une déclaration URSSAF — retirez-la d'abord de la déclaration" }
  }

  await prisma.invoice.update({ where: { id: invoiceId }, data: { urssafExcluded: excluded } })
  revalidatePath("/facturation/factures")
  revalidatePath(`/facturation/factures/${invoiceId}`)
  revalidatePath("/impots")
  return {}
}

/** Catégorie fiscale par défaut des factures du client (pré-remplissage déclaration). */
export async function setClientFiscalCategory(
  clientId: string,
  category: FiscalCategory | null
): Promise<{ error?: string }> {
  const session = await auth()
  const userId = session!.user.id

  const client = await prisma.client.findFirst({ where: { id: clientId, userId } })
  if (!client) return { error: "Contact introuvable" }

  await prisma.client.update({
    where: { id: clientId },
    data: { defaultFiscalCategory: category as never },
  })
  revalidatePath(`/contacts/${clientId}`)
  revalidatePath("/impots")
  return {}
}
