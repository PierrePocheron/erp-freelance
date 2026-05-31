"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { type NumberFormat, buildNumberParts } from "@/lib/number-format"
import { auth } from "@/lib/auth"
import { enforceRateLimit } from "@/lib/rate-limit"
import { put } from "@vercel/blob"
import { buildInvoicePdfBuffer } from "@/lib/invoice-pdf"

async function requireAuth(): Promise<string> {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Non autorisé")
  return session.user.id
}

// ── Verrouillage d'édition ──────────────────────────────────────────────────────
// Un devis ou une facture n'est modifiable (lignes, montants, conditions) qu'à
// l'état brouillon. Une fois validé/émis, le document est figé : pour le corriger,
// on le repasse en brouillon (devis) ou on l'annule puis on le duplique (facture).

async function assertQuoteEditable(quoteId: string, userId: string): Promise<void> {
  const quote = await prisma.quote.findFirst({ where: { id: quoteId, userId }, select: { status: true } })
  if (!quote) throw new Error("Devis introuvable")
  if (quote.status !== "DRAFT") throw new Error("Devis verrouillé : repassez-le en brouillon pour le modifier")
}

async function assertInvoiceEditable(invoiceId: string, userId: string): Promise<void> {
  const invoice = await prisma.invoice.findFirst({ where: { id: invoiceId, userId }, select: { status: true } })
  if (!invoice) throw new Error("Facture introuvable")
  if (invoice.status !== "DRAFT") throw new Error("Facture verrouillée : annulez-la pour la corriger")
}

// ── Numérotation ──────────────────────────────────────────────────────────────

async function nextQuoteNumber(userId: string) {
  const profile = await prisma.userProfile?.findUnique({
    where: { userId },
    select: { quotePrefix: true, quoteNumberFormat: true },
  }).catch(() => null)
  const prefix = profile?.quotePrefix ?? "DEV"
  const format = (profile?.quoteNumberFormat ?? "PREFIX-YYYY-NNN") as NumberFormat
  const { scopePrefix, digits } = buildNumberParts(format, prefix, new Date())
  const count = await prisma.quote.count({
    where: { userId, number: { startsWith: scopePrefix } },
  })
  return `${scopePrefix}${String(count + 1).padStart(digits, "0")}`
}

async function nextInvoiceNumber(userId: string) {
  const profile = await prisma.userProfile?.findUnique({
    where: { userId },
    select: { invoicePrefix: true, invoiceNumberFormat: true },
  }).catch(() => null)
  const prefix = profile?.invoicePrefix ?? "FAC"
  const format = (profile?.invoiceNumberFormat ?? "PREFIX-YYYY-NNN") as NumberFormat
  const { scopePrefix, digits } = buildNumberParts(format, prefix, new Date())
  const count = await prisma.invoice.count({
    where: { userId, number: { startsWith: scopePrefix } },
  })
  return `${scopePrefix}${String(count + 1).padStart(digits, "0")}`
}

// ── Devis ─────────────────────────────────────────────────────────────────────

export async function createQuoteWithLines(
  _userId: string,
  data: {
    clientId: string
    projectId?: string
    depositPercent?: number
    expiresAtDays?: number
    generalConditions?: string
    lines: Array<{
      description: string
      detail?: string
      quantity: number
      unitPrice: number
      taxRate: number
      billingType?: string
      productId?: string
    }>
  }
) {
  const userId = await requireAuth()
  const number = await nextQuoteNumber(userId)
  const expiresAt = data.expiresAtDays
    ? new Date(Date.now() + data.expiresAtDays * 24 * 60 * 60 * 1000)
    : null
  const totalHT = data.lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0)
  const quote = await prisma.quote.create({
    data: {
      userId,
      clientId: data.clientId,
      projectId: data.projectId || null,
      number,
      depositPercent: data.depositPercent ?? 0,
      expiresAt,
      generalConditions: data.generalConditions || null,
      totalHT,
      lines: {
        create: data.lines.map((l) => ({
          description: l.description,
          detail: l.detail || null,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          taxRate: l.taxRate,
          total: l.quantity * l.unitPrice,
          billingType: (l.billingType as never) || "ONE_SHOT",
          productId: l.productId || null,
        })),
      },
    },
  })
  revalidatePath("/facturation/devis")
  revalidatePath("/facturation")
  return quote
}

export async function createQuote(
  _userId: string,
  data: {
    clientId: string
    projectId?: string
    depositPercent?: number
    notes?: string
    expiresAtDays?: number
  }
) {
  const userId = await requireAuth()
  const number = await nextQuoteNumber(userId)
  const expiresAt = data.expiresAtDays
    ? new Date(Date.now() + data.expiresAtDays * 24 * 60 * 60 * 1000)
    : null
  const quote = await prisma.quote.create({
    data: {
      userId,
      clientId: data.clientId,
      projectId: data.projectId || null,
      number,
      depositPercent: data.depositPercent ?? 0,
      notes: data.notes || null,
      expiresAt,
    },
  })
  revalidatePath("/facturation/devis")
  revalidatePath("/facturation")
  return quote
}

export async function updateQuoteStatus(quoteId: string, _userId: string, status: string) {
  const realUserId = await requireAuth()
  const data: Record<string, unknown> = { status }
  if (status === "VALIDATED") data.validatedAt = new Date()
  if (status === "SENT") data.sentAt = new Date()
  if (status === "ACCEPTED") data.acceptedAt = new Date()
  await prisma.quote.update({ where: { id: quoteId, userId: realUserId }, data })
  revalidatePath(`/facturation/devis/${quoteId}`)
  revalidatePath("/facturation/devis")
}

// Repasse un devis validé (mais pas encore envoyé) en brouillon pour le corriger.
export async function revertQuoteToDraft(quoteId: string, _userId: string) {
  const userId = await requireAuth()
  const quote = await prisma.quote.findFirst({ where: { id: quoteId, userId }, select: { status: true } })
  if (!quote) throw new Error("Devis introuvable")
  if (quote.status !== "VALIDATED") throw new Error("Seul un devis validé non envoyé peut repasser en brouillon")
  await prisma.quote.update({
    where: { id: quoteId, userId },
    data: { status: "DRAFT" as never, validatedAt: null },
  })
  revalidatePath(`/facturation/devis/${quoteId}`)
  revalidatePath("/facturation/devis")
}

export async function updateQuoteSettings(
  quoteId: string,
  _userId: string,
  data: {
    generalConditions?: string | null
    expiresAt?: string | null
    depositPercent?: number
    notes?: string | null
  }
) {
  const userId = await requireAuth()
  await assertQuoteEditable(quoteId, userId)
  await prisma.quote.update({
    where: { id: quoteId, userId },
    data: {
      ...(data.generalConditions !== undefined && { generalConditions: data.generalConditions }),
      ...(data.expiresAt !== undefined && { expiresAt: data.expiresAt ? new Date(data.expiresAt) : null }),
      ...(data.depositPercent !== undefined && { depositPercent: data.depositPercent }),
      ...(data.notes !== undefined && { notes: data.notes }),
    },
  })
  revalidatePath(`/facturation/devis/${quoteId}`)
}

export async function updateQuoteNotes(quoteId: string, _userId: string, notes: string | null, depositPercent?: number) {
  const userId = await requireAuth()
  await assertQuoteEditable(quoteId, userId)
  await prisma.quote.update({
    where: { id: quoteId, userId },
    data: { notes, ...(depositPercent !== undefined ? { depositPercent } : {}) },
  })
  revalidatePath(`/facturation/devis/${quoteId}`)
}

export async function deleteQuote(quoteId: string, _userId: string) {
  const userId = await requireAuth()
  await prisma.quote.delete({ where: { id: quoteId, userId } })
  revalidatePath("/facturation/devis")
  revalidatePath("/facturation")
}

// ── Lignes de devis ───────────────────────────────────────────────────────────

async function recalcQuoteTotal(quoteId: string) {
  const lines = await prisma.quoteLine.findMany({ where: { quoteId } })
  const totalHT = lines.reduce((s, l) => s + l.total, 0)
  await prisma.quote.update({ where: { id: quoteId }, data: { totalHT } })
}

export async function addQuoteLine(
  quoteId: string,
  _userId: string,
  data: {
    description: string
    detail?: string
    quantity: number
    unitPrice: number
    taxRate?: number
    productId?: string
  }
) {
  const userId = await requireAuth()
  await assertQuoteEditable(quoteId, userId)
  const total = data.quantity * data.unitPrice
  await prisma.quoteLine.create({
    data: {
      quoteId,
      description: data.description,
      detail: data.detail || null,
      quantity: data.quantity,
      unitPrice: data.unitPrice,
      taxRate: data.taxRate ?? 0,
      total,
      productId: data.productId || null,
    },
  })
  await recalcQuoteTotal(quoteId)
  revalidatePath(`/facturation/devis/${quoteId}`)
}

export async function updateQuoteLine(
  lineId: string,
  data: {
    description: string
    detail?: string
    quantity: number
    unitPrice: number
    taxRate?: number
  }
) {
  const userId = await requireAuth()
  const existing = await prisma.quoteLine.findFirst({
    where: { id: lineId, quote: { userId } },
    select: { id: true, quoteId: true, quote: { select: { status: true } } },
  })
  if (!existing) throw new Error("Non autorisé")
  if (existing.quote.status !== "DRAFT") throw new Error("Devis verrouillé : repassez-le en brouillon pour le modifier")
  const total = data.quantity * data.unitPrice
  const line = await prisma.quoteLine.update({
    where: { id: lineId },
    data: {
      description: data.description,
      detail: data.detail ?? null,
      quantity: data.quantity,
      unitPrice: data.unitPrice,
      taxRate: data.taxRate ?? 0,
      total,
    },
    select: { quoteId: true },
  })
  await recalcQuoteTotal(line.quoteId)
  revalidatePath(`/facturation/devis/${line.quoteId}`)
}

export async function deleteQuoteLine(lineId: string) {
  const userId = await requireAuth()
  const existing = await prisma.quoteLine.findFirst({
    where: { id: lineId, quote: { userId } },
    select: { id: true, quote: { select: { status: true } } },
  })
  if (!existing) throw new Error("Non autorisé")
  if (existing.quote.status !== "DRAFT") throw new Error("Devis verrouillé : repassez-le en brouillon pour le modifier")
  const line = await prisma.quoteLine.delete({ where: { id: lineId }, select: { quoteId: true } })
  await recalcQuoteTotal(line.quoteId)
  revalidatePath(`/facturation/devis/${line.quoteId}`)
}

// ── Factures ──────────────────────────────────────────────────────────────────

export async function createInvoice(
  _userId: string,
  data: {
    clientId: string
    projectId?: string
    quoteId?: string
    type?: string
    dueDate?: string
    notes?: string
    depositDeducted?: number
  }
) {
  const userId = await requireAuth()
  const number = await nextInvoiceNumber(userId)
  const invoice = await prisma.invoice.create({
    data: {
      userId,
      clientId: data.clientId,
      projectId: data.projectId || null,
      quoteId: data.quoteId || null,
      number,
      type: (data.type as never) || "STANDALONE",
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
      notes: data.notes || null,
      depositDeducted: data.depositDeducted ?? 0,
    },
  })
  revalidatePath("/facturation/factures")
  revalidatePath("/facturation")
  return invoice
}

export async function createInvoiceFromQuote(quoteId: string, _userId: string, type: "DEPOSIT" | "FINAL" | "RECURRING") {
  const userId = await requireAuth()
  const quote = await prisma.quote.findFirst({
    where: { id: quoteId, userId },
    include: { lines: true },
  })
  if (!quote) throw new Error("Devis introuvable")

  const number = await nextInvoiceNumber(userId)
  const isDeposit = type === "DEPOSIT"
  const depositAmount = isDeposit ? quote.totalHT * (quote.depositPercent / 100) : quote.totalHT

  // Sur la facture de solde, on déduit le montant des acomptes réellement facturés
  // (factures DEPOSIT non annulées) plutôt qu'un pourcentage théorique. Faute
  // d'acompte émis, on retombe sur le % du devis s'il est renseigné.
  let depositDeducted = 0
  if (type === "FINAL") {
    const deposits = await prisma.invoice.findMany({
      where: { quoteId: quote.id, type: "DEPOSIT", status: { not: "CANCELLED" } },
      select: { totalHT: true },
    })
    depositDeducted = deposits.reduce((s, d) => s + d.totalHT, 0)
    if (depositDeducted === 0 && quote.depositPercent > 0) {
      depositDeducted = quote.totalHT * (quote.depositPercent / 100)
    }
  }

  const invoice = await prisma.invoice.create({
    data: {
      userId,
      clientId: quote.clientId,
      projectId: quote.projectId,
      quoteId: quote.id,
      number,
      type: isDeposit ? "DEPOSIT" : type === "RECURRING" ? "RECURRING" : "FINAL",
      totalHT: isDeposit ? depositAmount : quote.totalHT,
      depositDeducted,
      generalConditions: quote.generalConditions ?? null,
      lines: {
        create: quote.lines.map((l) => ({
          description: l.description,
          detail: l.detail,
          quantity: isDeposit ? 1 : l.quantity,
          unitPrice: isDeposit ? depositAmount : l.unitPrice,
          taxRate: l.taxRate,
          total: isDeposit ? depositAmount : l.total,
          productId: l.productId,
        })),
      },
    },
  })
  revalidatePath("/facturation/factures")
  revalidatePath("/facturation")
  return invoice
}

// Facture un renouvellement (hébergement / domaine) pour sa période. Pré-remplit
// une clause réutilisable selon le type (reconduction / nom de domaine) et avance
// l'échéance du renouvellement (tacite reconduction), en réarmant les rappels.
export async function createInvoiceFromRenewal(renewalId: string, _userId: string): Promise<{ id: string }> {
  const userId = await requireAuth()
  const renewal = await prisma.renewal.findFirst({
    where: { id: renewalId, postDev: { project: { userId } } },
    include: { postDev: { select: { project: { select: { id: true, clientId: true } } } } },
  })
  if (!renewal) throw new Error("Renouvellement introuvable")
  if (!renewal.amount || renewal.amount <= 0) {
    throw new Error("Renseignez d'abord un montant sur ce renouvellement")
  }
  const project = renewal.postDev.project

  // Clause par défaut : on cherche une condition réutilisable pertinente selon le
  // type, sinon la condition marquée par défaut.
  const wanted = renewal.type === "DOMAIN"
    ? ["domaine", "reconduc", "abonnement"]
    : ["reconduc", "abonnement", "hébergement", "hebergement"]
  const templates = await prisma.conditionsTemplate.findMany({
    where: { userId },
    select: { name: true, content: true, isDefault: true },
  })
  const match =
    templates.find((t) => wanted.some((w) => t.name.toLowerCase().includes(w))) ??
    templates.find((t) => t.isDefault)
  const generalConditions = match?.content ?? null

  const periodLabel = renewal.periodMonths ? ` (${renewal.periodMonths} mois)` : ""
  const number = await nextInvoiceNumber(userId)
  const invoice = await prisma.invoice.create({
    data: {
      userId,
      clientId: project.clientId,
      projectId: project.id,
      number,
      type: "RECURRING",
      status: "DRAFT",
      totalHT: renewal.amount,
      depositDeducted: 0,
      generalConditions,
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
  })

  if (renewal.periodMonths) {
    const next = new Date(renewal.expiresAt)
    next.setMonth(next.getMonth() + renewal.periodMonths)
    await prisma.renewal.update({
      where: { id: renewalId },
      data: { expiresAt: next, reminderSent30: false, reminderSent7: false },
    })
  }

  revalidatePath("/facturation/factures")
  revalidatePath("/facturation")
  revalidatePath(`/projets/${project.id}/post-dev`)
  return invoice
}

export async function recordPayment(
  invoiceId: string,
  _userId: string,
  data: { amount: number; paidAt: string; note?: string }
) {
  const userId = await requireAuth()
  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, userId },
    include: { payments: true },
  })
  if (!invoice) return

  await prisma.payment.create({
    data: {
      invoiceId,
      amount: data.amount,
      paidAt: new Date(data.paidAt),
      note: data.note || null,
    },
  })

  const netAmount = invoice.totalHT - invoice.depositDeducted
  const totalPaid = invoice.payments.reduce((s, p) => s + p.amount, 0) + data.amount
  if (netAmount > 0 && totalPaid >= netAmount - 0.01 && invoice.status !== "PAID") {
    await prisma.invoice.update({
      where: { id: invoiceId },
      data: { status: "PAID", paidAt: new Date(data.paidAt) },
    })
  }

  revalidatePath(`/facturation/factures/${invoiceId}`)
  revalidatePath("/facturation/factures")
  revalidatePath("/facturation")
}

export async function deletePayment(paymentId: string, invoiceId: string, _userId: string) {
  const userId = await requireAuth()
  const invoice = await prisma.invoice.findFirst({ where: { id: invoiceId, userId } })
  if (!invoice) return
  await prisma.payment.delete({ where: { id: paymentId } })
  revalidatePath(`/facturation/factures/${invoiceId}`)
  revalidatePath("/facturation/factures")
  revalidatePath("/facturation")
}

export async function markLateInvoices(_userId: string) {
  const userId = await requireAuth()
  await prisma.invoice.updateMany({
    where: {
      userId,
      status: "SENT",
      dueDate: { lt: new Date() },
    },
    data: { status: "LATE" },
  })
}

export async function updateInvoiceStatus(invoiceId: string, _userId: string, status: string) {
  const userId = await requireAuth()
  const data: Record<string, unknown> = { status }
  if (status === "ISSUED") data.issuedAt = new Date()
  if (status === "SENT") data.sentAt = new Date()
  if (status === "PAID") data.paidAt = new Date()
  if (status === "CANCELLED") data.cancelledAt = new Date()
  await prisma.invoice.update({ where: { id: invoiceId, userId }, data })
  revalidatePath(`/facturation/factures/${invoiceId}`)
  revalidatePath("/facturation/factures")
  revalidatePath("/facturation")
}

// Émet une facture : passage brouillon → émise. La facture est alors figée
// (plus éditable) et son PDF est rendu une fois puis stocké sur Blob — ce
// document devient immuable, indépendant des évolutions futures du profil.
export async function issueInvoice(invoiceId: string, _userId: string) {
  const userId = await requireAuth()
  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, userId },
    select: { status: true, number: true },
  })
  if (!invoice) throw new Error("Facture introuvable")
  if (invoice.status !== "DRAFT") throw new Error("Seule une facture en brouillon peut être émise")

  // Gel du PDF : rendu pendant que la facture est encore cohérente, avant le
  // changement de statut. Un échec Blob ne doit pas bloquer l'émission — la
  // route PDF retombera sur un rendu à la volée tant que pdfUrl est null.
  let pdfUrl: string | null = null
  try {
    const buffer = await buildInvoicePdfBuffer(invoiceId, userId)
    const safeNumber = invoice.number.replace(/[^a-zA-Z0-9._-]/g, "-")
    const blob = await put(`factures/${userId}/${safeNumber}.pdf`, buffer, {
      access: "public",
      contentType: "application/pdf",
    })
    pdfUrl = blob.url
  } catch (e) {
    console.error("Gel PDF facture échoué (émission poursuivie) :", e)
  }

  await prisma.invoice.update({
    where: { id: invoiceId, userId },
    data: { status: "ISSUED" as never, issuedAt: new Date(), ...(pdfUrl ? { pdfUrl } : {}) },
  })
  revalidatePath(`/facturation/factures/${invoiceId}`)
  revalidatePath("/facturation/factures")
  revalidatePath("/facturation")
}

// Annule une facture émise (conservée pour la continuité de la séquence légale ;
// son numéro n'est pas réutilisé). Pour repartir, on la duplique en brouillon.
export async function cancelInvoice(invoiceId: string, _userId: string) {
  const userId = await requireAuth()
  const invoice = await prisma.invoice.findFirst({ where: { id: invoiceId, userId }, select: { status: true } })
  if (!invoice) throw new Error("Facture introuvable")
  if (invoice.status === "DRAFT" || invoice.status === "CANCELLED") {
    throw new Error("Cette facture ne peut pas être annulée")
  }
  await prisma.invoice.update({
    where: { id: invoiceId, userId },
    data: { status: "CANCELLED" as never, cancelledAt: new Date() },
  })
  revalidatePath(`/facturation/factures/${invoiceId}`)
  revalidatePath("/facturation/factures")
  revalidatePath("/facturation")
}

// Duplique une facture (typiquement annulée) en un nouveau brouillon éditable,
// avec un nouveau numéro, pour corriger puis ré-émettre.
export async function duplicateInvoiceAsDraft(invoiceId: string, _userId: string) {
  const userId = await requireAuth()
  const source = await prisma.invoice.findFirst({
    where: { id: invoiceId, userId },
    include: { lines: true },
  })
  if (!source) throw new Error("Facture introuvable")
  const number = await nextInvoiceNumber(userId)
  const draft = await prisma.invoice.create({
    data: {
      userId,
      clientId: source.clientId,
      projectId: source.projectId,
      quoteId: source.quoteId,
      number,
      type: source.type,
      totalHT: source.totalHT,
      depositDeducted: source.depositDeducted,
      dueDate: source.dueDate,
      notes: source.notes,
      lines: {
        create: source.lines.map((l) => ({
          description: l.description,
          detail: l.detail,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          taxRate: l.taxRate,
          total: l.total,
          productId: l.productId,
        })),
      },
    },
  })
  revalidatePath("/facturation/factures")
  revalidatePath("/facturation")
  return draft
}

export async function updateInvoiceDueDate(invoiceId: string, _userId: string, dueDate: string | null) {
  const userId = await requireAuth()
  await assertInvoiceEditable(invoiceId, userId)
  await prisma.invoice.update({
    where: { id: invoiceId, userId },
    data: { dueDate: dueDate ? new Date(dueDate) : null },
  })
  revalidatePath(`/facturation/factures/${invoiceId}`)
}

export async function updateInvoiceNotes(invoiceId: string, _userId: string, notes: string | null) {
  const userId = await requireAuth()
  await assertInvoiceEditable(invoiceId, userId)
  await prisma.invoice.update({ where: { id: invoiceId, userId }, data: { notes } })
  revalidatePath(`/facturation/factures/${invoiceId}`)
}

export async function updateInvoiceConditions(invoiceId: string, _userId: string, generalConditions: string | null) {
  const userId = await requireAuth()
  await assertInvoiceEditable(invoiceId, userId)
  await prisma.invoice.update({ where: { id: invoiceId, userId }, data: { generalConditions } })
  revalidatePath(`/facturation/factures/${invoiceId}`)
}

export async function deleteInvoice(invoiceId: string, _userId: string) {
  const userId = await requireAuth()
  await prisma.invoice.delete({ where: { id: invoiceId, userId } })
  revalidatePath("/facturation/factures")
  revalidatePath("/facturation")
}

export async function signQuoteWithFile(quoteId: string, _userId: string, fileUrl: string) {
  const userId = await requireAuth()
  await prisma.quote.update({
    where: { id: quoteId, userId },
    data: { signedFileUrl: fileUrl, status: "SIGNED" as never },
  })
  revalidatePath(`/facturation/devis/${quoteId}`)
  revalidatePath("/facturation/devis")
}

// ── Lignes de facture ─────────────────────────────────────────────────────────

async function recalcInvoiceTotal(invoiceId: string) {
  const lines = await prisma.invoiceLine.findMany({ where: { invoiceId } })
  const totalHT = lines.reduce((s, l) => s + l.total, 0)
  await prisma.invoice.update({ where: { id: invoiceId }, data: { totalHT } })
}

export async function addInvoiceLine(
  invoiceId: string,
  _userId: string,
  data: {
    description: string
    detail?: string
    quantity: number
    unitPrice: number
    taxRate?: number
    productId?: string
  }
) {
  const userId = await requireAuth()
  await assertInvoiceEditable(invoiceId, userId)
  const total = data.quantity * data.unitPrice
  await prisma.invoiceLine.create({
    data: {
      invoiceId,
      description: data.description,
      detail: data.detail || null,
      quantity: data.quantity,
      unitPrice: data.unitPrice,
      taxRate: data.taxRate ?? 0,
      total,
      productId: data.productId || null,
    },
  })
  await recalcInvoiceTotal(invoiceId)
  revalidatePath(`/facturation/factures/${invoiceId}`)
}

export async function updateInvoiceLine(
  lineId: string,
  data: {
    description: string
    detail?: string
    quantity: number
    unitPrice: number
    taxRate?: number
  }
) {
  const userId = await requireAuth()
  const existing = await prisma.invoiceLine.findFirst({
    where: { id: lineId, invoice: { userId } },
    select: { id: true, invoice: { select: { status: true } } },
  })
  if (!existing) throw new Error("Non autorisé")
  if (existing.invoice.status !== "DRAFT") throw new Error("Facture verrouillée : annulez-la pour la corriger")
  const total = data.quantity * data.unitPrice
  const line = await prisma.invoiceLine.update({
    where: { id: lineId },
    data: {
      description: data.description,
      detail: data.detail ?? null,
      quantity: data.quantity,
      unitPrice: data.unitPrice,
      taxRate: data.taxRate ?? 0,
      total,
    },
    select: { invoiceId: true },
  })
  await recalcInvoiceTotal(line.invoiceId)
  revalidatePath(`/facturation/factures/${line.invoiceId}`)
}

export async function deleteInvoiceLine(lineId: string) {
  const userId = await requireAuth()
  const existing = await prisma.invoiceLine.findFirst({
    where: { id: lineId, invoice: { userId } },
    select: { id: true, invoice: { select: { status: true } } },
  })
  if (!existing) throw new Error("Non autorisé")
  if (existing.invoice.status !== "DRAFT") throw new Error("Facture verrouillée : annulez-la pour la corriger")
  const line = await prisma.invoiceLine.delete({ where: { id: lineId }, select: { invoiceId: true } })
  await recalcInvoiceTotal(line.invoiceId)
  revalidatePath(`/facturation/factures/${line.invoiceId}`)
}

// ── Produits ──────────────────────────────────────────────────────────────────

export async function createProduct(
  _userId: string,
  data: { name: string; description?: string; unitPrice: number; unit?: string; billingType?: string; defaultTaxRate?: number }
) {
  const userId = await requireAuth()
  const product = await prisma.product.create({
    data: {
      userId,
      name: data.name,
      description: data.description || null,
      unitPrice: data.unitPrice,
      unit: (data.unit || "UNIT") as never,
      billingType: (data.billingType || "ONE_SHOT") as never,
      defaultTaxRate: (data.defaultTaxRate ?? 0) as never,
    } as never,
  })
  revalidatePath("/facturation/produits")
  return product
}

export async function updateProduct(
  productId: string,
  _userId: string,
  data: { name?: string; description?: string | null; unitPrice?: number; unit?: string; isActive?: boolean; billingType?: string; defaultTaxRate?: number }
) {
  const userId = await requireAuth()
  await prisma.product.update({
    where: { id: productId, userId },
    data: data as never,
  })
  revalidatePath("/facturation/produits")
}

export async function deleteProduct(productId: string, _userId: string) {
  const userId = await requireAuth()
  await prisma.product.delete({ where: { id: productId, userId } })
  revalidatePath("/facturation/produits")
}

// ── Récurrentes ───────────────────────────────────────────────────────────────

export async function createRecurringInvoice(
  _userId: string,
  data: {
    clientId: string
    projectId?: string
    name: string
    frequency: string
    nextGenerationDate: string
  }
) {
  const userId = await requireAuth()
  const rec = await (prisma as never as { recurringInvoice: { create: (args: unknown) => Promise<{ id: string }> } }).recurringInvoice.create({
    data: {
      userId,
      clientId: data.clientId,
      projectId: data.projectId || null,
      name: data.name,
      frequency: data.frequency,
      nextGenerationDate: new Date(data.nextGenerationDate),
      isActive: true,
    },
  })
  revalidatePath("/facturation/recurrentes")
  return rec
}

export async function updateRecurringInvoice(
  id: string,
  _userId: string,
  data: {
    name?: string
    frequency?: string
    nextGenerationDate?: string
    isActive?: boolean
    projectId?: string | null
  }
) {
  const userId = await requireAuth()
  await (prisma as never as { recurringInvoice: { update: (args: unknown) => Promise<unknown> } }).recurringInvoice.update({
    where: { id, userId } as never,
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.frequency !== undefined && { frequency: data.frequency }),
      ...(data.nextGenerationDate !== undefined && { nextGenerationDate: new Date(data.nextGenerationDate) }),
      ...(data.isActive !== undefined && { isActive: data.isActive }),
      ...(data.projectId !== undefined && { projectId: data.projectId }),
    },
  })
  revalidatePath("/facturation/recurrentes")
}

export async function deleteRecurringInvoice(id: string, _userId: string) {
  const userId = await requireAuth()
  await (prisma as never as { recurringInvoice: { delete: (args: unknown) => Promise<unknown> } }).recurringInvoice.delete({
    where: { id, userId } as never,
  })
  revalidatePath("/facturation/recurrentes")
}

type RecurringRowFull = {
  id: string
  name: string
  frequency: string
  nextGenerationDate: Date
  clientId: string
  projectId: string | null
  userId: string
}

export async function generateInvoiceFromRecurring(
  recurringId: string,
  _userId: string
): Promise<{ id: string }> {
  const userId = await requireAuth()
  const prismaExt = prisma as never as {
    recurringInvoice: { findFirst: (args: unknown) => Promise<RecurringRowFull | null> }
  }

  const recurring = await prismaExt.recurringInvoice.findFirst({
    where: { id: recurringId, userId } as never,
  })
  if (!recurring) throw new Error("Modèle introuvable")

  // Fetch lines via raw SQL
  type LineRow = { description: string; quantity: number; unitPrice: number; taxRate: number; total: number; productId: string | null }
  const lines = await prisma.$queryRawUnsafe<LineRow[]>(
    `SELECT description, quantity, "unitPrice", "taxRate", total, "productId" FROM "RecurringInvoiceLine" WHERE "recurringInvoiceId" = $1 ORDER BY id ASC`,
    recurringId
  )

  const totalHT = lines.reduce((s, l) => s + Number(l.total), 0)
  const number = await nextInvoiceNumber(userId)

  const invoice = await prisma.invoice.create({
    data: {
      userId,
      clientId: recurring.clientId,
      projectId: recurring.projectId,
      number,
      type: "RECURRING",
      status: "DRAFT",
      totalHT,
      depositDeducted: 0,
      lines: {
        create: lines.map((l) => ({
          description: l.description,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          taxRate: l.taxRate,
          total: l.total,
        })),
      },
    },
  })

  // Advance nextGenerationDate
  const next = new Date(recurring.nextGenerationDate)
  if (recurring.frequency === "MONTHLY") next.setMonth(next.getMonth() + 1)
  else if (recurring.frequency === "QUARTERLY") next.setMonth(next.getMonth() + 3)
  else if (recurring.frequency === "YEARLY") next.setFullYear(next.getFullYear() + 1)

  await (prisma as never as { recurringInvoice: { update: (args: unknown) => Promise<unknown> } }).recurringInvoice.update({
    where: { id: recurringId } as never,
    data: { nextGenerationDate: next } as never,
  })

  revalidatePath("/facturation/recurrentes")
  revalidatePath("/facturation/factures")
  return invoice
}

type RecurringLine = {
  description: string
  quantity: number
  unitPrice: number
  taxRate: number
  productId?: string | null
}

export async function setRecurringInvoiceLines(
  recurringInvoiceId: string,
  _userId: string,
  lines: RecurringLine[]
) {
  const userId = await requireAuth()
  // RecurringInvoiceLine is not in Prisma schema (raw SQL migration) — use $executeRawUnsafe
  await prisma.$executeRawUnsafe(
    `DELETE FROM "RecurringInvoiceLine" WHERE "recurringInvoiceId" = $1`,
    recurringInvoiceId
  )

  const totalHT = lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0)

  for (const l of lines) {
    await prisma.$executeRawUnsafe(
      `INSERT INTO "RecurringInvoiceLine" (id, "recurringInvoiceId", "productId", description, detail, quantity, "unitPrice", "taxRate", total)
       VALUES (gen_random_uuid()::text, $1, $2, $3, NULL, $4, $5, $6, $7)`,
      recurringInvoiceId,
      l.productId || null,
      l.description,
      l.quantity,
      l.unitPrice,
      l.taxRate,
      l.quantity * l.unitPrice
    )
  }

  // Update totalHT on RecurringInvoice (column added via raw SQL migration)
  await prisma.$executeRawUnsafe(
    `UPDATE "RecurringInvoice" SET "totalHT" = $1 WHERE id = $2 AND "userId" = $3`,
    totalHT,
    recurringInvoiceId,
    userId
  )

  revalidatePath("/facturation/recurrentes")
}

// ── Email ─────────────────────────────────────────────────────────────────────

export async function resendQuoteEmail(quoteId: string, _userId: string) {
  const userId = await requireAuth()
  enforceRateLimit(`email:${userId}`, 10, 60_000) // 10 emails/min max
  const quote = await prisma.quote.findFirst({
    where: { id: quoteId, userId, status: "SENT" },
    include: { client: true, user: true },
  })
  if (!quote) throw new Error("Devis introuvable")
  if (!quote.client.email) throw new Error("Le client n'a pas d'adresse email")

  const { Resend } = await import("resend")
  const resend = new Resend(process.env.RESEND_API_KEY)

  const pdfUrl = `${process.env.NEXTAUTH_URL}/api/pdf/devis/${quoteId}`

  const { error } = await resend.emails.send({
    from: "ERP Freelance <noreply@resend.dev>",
    to: quote.client.email,
    subject: `Rappel — Devis ${quote.number}`,
    html: `
      <p>Bonjour ${quote.client.name},</p>
      <p>Je me permets de vous relancer concernant le devis <strong>${quote.number}</strong> d'un montant de <strong>${quote.totalHT.toLocaleString("fr-FR")} €</strong> HT que je vous ai adressé.</p>
      ${quote.expiresAt ? `<p>Ce devis est valable jusqu'au ${new Date(quote.expiresAt).toLocaleDateString("fr-FR")}.</p>` : ""}
      <p><a href="${pdfUrl}">Consulter le devis</a></p>
      <p>Cordialement,<br>${quote.user.name}</p>
    `,
  })

  if (error) throw new Error("Échec de l'envoi email. Vérifiez la configuration Resend.")
  revalidatePath(`/facturation/devis/${quoteId}`)
}

export async function sendQuoteEmail(quoteId: string, _userId: string) {
  const userId = await requireAuth()
  enforceRateLimit(`email:${userId}`, 10, 60_000)
  const quote = await prisma.quote.findFirst({
    where: { id: quoteId, userId },
    include: { client: true, user: true },
  })
  if (!quote) throw new Error("Devis introuvable")
  if (!quote.client.email) throw new Error("Le client n'a pas d'adresse email")

  const { Resend } = await import("resend")
  const resend = new Resend(process.env.RESEND_API_KEY)

  const pdfUrl = `${process.env.NEXTAUTH_URL}/api/pdf/devis/${quoteId}`

  const { error } = await resend.emails.send({
    from: "ERP Freelance <noreply@resend.dev>",
    to: quote.client.email,
    subject: `Devis ${quote.number}`,
    html: `
      <p>Bonjour ${quote.client.name},</p>
      <p>Veuillez trouver ci-joint le devis <strong>${quote.number}</strong> d'un montant de <strong>${quote.totalHT.toLocaleString("fr-FR")} €</strong> HT.</p>
      ${quote.expiresAt ? `<p>Ce devis est valable jusqu'au ${new Date(quote.expiresAt).toLocaleDateString("fr-FR")}.</p>` : ""}
      <p><a href="${pdfUrl}">Télécharger le devis</a></p>
      <p>Cordialement,<br>${quote.user.name}</p>
    `,
  })

  if (error) throw new Error("Échec de l'envoi email. Vérifiez la configuration Resend.")

  await updateQuoteStatus(quoteId, userId, "SENT")
}

export async function sendInvoiceEmail(invoiceId: string, _userId: string) {
  const userId = await requireAuth()
  enforceRateLimit(`email:${userId}`, 10, 60_000)
  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, userId },
    include: { client: true, user: true },
  })
  if (!invoice) throw new Error("Facture introuvable")

  const { Resend } = await import("resend")
  const resend = new Resend(process.env.RESEND_API_KEY)

  const pdfUrl = `${process.env.NEXTAUTH_URL}/api/pdf/facture/${invoiceId}`

  const { data, error } = await resend.emails.send({
    from: "ERP Freelance <noreply@resend.dev>",
    to: invoice.client.email ?? invoice.user.email ?? "",
    subject: `Facture ${invoice.number}`,
    html: `
      <p>Bonjour ${invoice.client.name},</p>
      <p>Veuillez trouver ci-joint la facture <strong>${invoice.number}</strong> d'un montant de <strong>${invoice.totalHT.toLocaleString("fr-FR")} €</strong>.</p>
      <p><a href="${pdfUrl}">Télécharger la facture</a></p>
      <p>Cordialement,<br>${invoice.user.name}</p>
    `,
  })

  if (error) throw new Error("Échec de l'envoi email. Vérifiez la configuration Resend.")

  await prisma.emailLog.create({
    data: {
      userId,
      invoiceId,
      to: invoice.client.email ?? "",
      subject: `Facture ${invoice.number}`,
      resendMessageId: data?.id,
    },
  })

  await updateInvoiceStatus(invoiceId, userId, "SENT")
}

export async function sendInvoiceReminder(invoiceId: string, _userId: string) {
  const userId = await requireAuth()
  enforceRateLimit(`email:${userId}`, 10, 60_000)
  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, userId, status: { in: ["SENT", "LATE"] } },
    include: { client: true, user: true },
  })
  if (!invoice) throw new Error("Facture introuvable")
  if (!invoice.client.email) throw new Error("Le client n'a pas d'adresse email")

  const { Resend } = await import("resend")
  const resend = new Resend(process.env.RESEND_API_KEY)

  const pdfUrl = `${process.env.NEXTAUTH_URL}/api/pdf/facture/${invoiceId}`
  const isLate = invoice.status === "LATE"
  const daysLate = invoice.dueDate
    ? Math.ceil((Date.now() - new Date(invoice.dueDate).getTime()) / 86400000)
    : null

  const subject = isLate
    ? `Relance — Facture ${invoice.number} en retard`
    : `Rappel — Facture ${invoice.number}`

  const { data, error } = await resend.emails.send({
    from: "ERP Freelance <noreply@resend.dev>",
    to: invoice.client.email,
    subject,
    html: `
      <p>Bonjour ${invoice.client.name},</p>
      ${isLate && daysLate
        ? `<p>Sauf erreur de notre part, la facture <strong>${invoice.number}</strong> d'un montant de <strong>${(invoice.totalHT - invoice.depositDeducted).toLocaleString("fr-FR")} €</strong> est en retard de <strong>${daysLate} jour(s)</strong>.</p>`
        : `<p>Nous vous rappelons que la facture <strong>${invoice.number}</strong> d'un montant de <strong>${(invoice.totalHT - invoice.depositDeducted).toLocaleString("fr-FR")} €</strong> est toujours en attente de règlement.</p>`
      }
      <p><a href="${pdfUrl}">Voir la facture</a></p>
      <p>Cordialement,<br>${invoice.user.name}</p>
    `,
  })

  if (error) throw new Error("Échec de l'envoi email. Vérifiez la configuration Resend.")

  await prisma.emailLog.create({
    data: {
      userId,
      invoiceId,
      to: invoice.client.email,
      subject,
      resendMessageId: data?.id,
    },
  })

  revalidatePath(`/facturation/factures/${invoiceId}`)
}

// ── Chart ──────────────────────────────────────────────────────────────────

export async function getMonthlyRevenue(year: number): Promise<number[]> {
  const { auth } = await import("@/lib/auth")
  const session = await auth()
  if (!session) return Array(12).fill(0)
  const userId = session.user.id

  const start = new Date(year, 0, 1)
  const end = new Date(year, 11, 31, 23, 59, 59, 999)

  const invoices = await prisma.invoice.findMany({
    where: { userId, status: "PAID", paidAt: { gte: start, lte: end } },
    select: { paidAt: true, createdAt: true, totalHT: true, depositDeducted: true },
  })

  return Array.from({ length: 12 }, (_, m) =>
    invoices
      .filter((i) => new Date(i.paidAt ?? i.createdAt).getMonth() === m)
      .reduce((s, i) => s + i.totalHT - i.depositDeducted, 0)
  )
}
