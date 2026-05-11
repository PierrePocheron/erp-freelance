"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"

// ── Numérotation ──────────────────────────────────────────────────────────────

async function nextQuoteNumber(userId: string) {
  const year = new Date().getFullYear()
  const profile = await prisma.userProfile.findUnique({ where: { userId }, select: { quotePrefix: true } }).catch(() => null)
  const prefix = profile?.quotePrefix ?? "DEV"
  const count = await prisma.quote.count({
    where: { userId, number: { startsWith: `${prefix}-${year}-` } },
  })
  return `${prefix}-${year}-${String(count + 1).padStart(3, "0")}`
}

async function nextInvoiceNumber(userId: string) {
  const year = new Date().getFullYear()
  const profile = await prisma.userProfile.findUnique({ where: { userId }, select: { invoicePrefix: true } }).catch(() => null)
  const prefix = profile?.invoicePrefix ?? "FAC"
  const count = await prisma.invoice.count({
    where: { userId, number: { startsWith: `${prefix}-${year}-` } },
  })
  return `${prefix}-${year}-${String(count + 1).padStart(3, "0")}`
}

// ── Devis ─────────────────────────────────────────────────────────────────────

export async function createQuote(
  userId: string,
  data: { clientId: string; projectId?: string; depositPercent?: number; notes?: string }
) {
  const number = await nextQuoteNumber(userId)
  const quote = await prisma.quote.create({
    data: {
      userId,
      clientId: data.clientId,
      projectId: data.projectId || null,
      number,
      depositPercent: data.depositPercent ?? 0,
      notes: data.notes || null,
    },
  })
  revalidatePath("/facturation/devis")
  revalidatePath("/facturation")
  return quote
}

export async function updateQuoteStatus(quoteId: string, userId: string, status: string) {
  const data: any = { status }
  if (status === "SENT") data.sentAt = new Date()
  if (status === "ACCEPTED") data.acceptedAt = new Date()
  await prisma.quote.update({ where: { id: quoteId, userId }, data })
  revalidatePath(`/facturation/devis/${quoteId}`)
  revalidatePath("/facturation/devis")
}

export async function updateQuoteNotes(quoteId: string, userId: string, notes: string | null, depositPercent?: number) {
  await prisma.quote.update({
    where: { id: quoteId, userId },
    data: { notes, ...(depositPercent !== undefined ? { depositPercent } : {}) },
  })
  revalidatePath(`/facturation/devis/${quoteId}`)
}

export async function deleteQuote(quoteId: string, userId: string) {
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
  data: { description: string; quantity: number; unitPrice: number; productId?: string }
) {
  const total = data.quantity * data.unitPrice
  await prisma.quoteLine.create({
    data: {
      quoteId,
      description: data.description,
      quantity: data.quantity,
      unitPrice: data.unitPrice,
      total,
      productId: data.productId || null,
    },
  })
  await recalcQuoteTotal(quoteId)
  revalidatePath(`/facturation/devis/${quoteId}`)
}

export async function updateQuoteLine(
  lineId: string,
  data: { description: string; quantity: number; unitPrice: number }
) {
  const total = data.quantity * data.unitPrice
  const line = await prisma.quoteLine.update({
    where: { id: lineId },
    data: { description: data.description, quantity: data.quantity, unitPrice: data.unitPrice, total },
    select: { quoteId: true },
  })
  await recalcQuoteTotal(line.quoteId)
  revalidatePath(`/facturation/devis/${line.quoteId}`)
}

export async function deleteQuoteLine(lineId: string) {
  const line = await prisma.quoteLine.delete({ where: { id: lineId }, select: { quoteId: true } })
  await recalcQuoteTotal(line.quoteId)
  revalidatePath(`/facturation/devis/${line.quoteId}`)
}

// ── Factures ──────────────────────────────────────────────────────────────────

export async function createInvoice(
  userId: string,
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
  const number = await nextInvoiceNumber(userId)
  const invoice = await prisma.invoice.create({
    data: {
      userId,
      clientId: data.clientId,
      projectId: data.projectId || null,
      quoteId: data.quoteId || null,
      number,
      type: (data.type as any) || "STANDALONE",
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
      notes: data.notes || null,
      depositDeducted: data.depositDeducted ?? 0,
    },
  })
  revalidatePath("/facturation/factures")
  revalidatePath("/facturation")
  return invoice
}

export async function createInvoiceFromQuote(quoteId: string, userId: string, type: "DEPOSIT" | "FINAL") {
  const quote = await prisma.quote.findFirst({
    where: { id: quoteId, userId },
    include: { lines: true },
  })
  if (!quote) throw new Error("Devis introuvable")

  const number = await nextInvoiceNumber(userId)
  const isDeposit = type === "DEPOSIT"
  const depositAmount = isDeposit ? quote.totalHT * (quote.depositPercent / 100) : quote.totalHT
  const depositDeducted = type === "FINAL" && quote.depositPercent > 0
    ? quote.totalHT * (quote.depositPercent / 100)
    : 0

  const invoice = await prisma.invoice.create({
    data: {
      userId,
      clientId: quote.clientId,
      projectId: quote.projectId,
      quoteId: quote.id,
      number,
      type: isDeposit ? "DEPOSIT" : "FINAL",
      totalHT: isDeposit ? depositAmount : quote.totalHT,
      depositDeducted,
      lines: {
        create: quote.lines.map((l) => ({
          description: l.description,
          quantity: isDeposit ? 1 : l.quantity,
          unitPrice: isDeposit ? depositAmount : l.unitPrice,
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

export async function updateInvoiceStatus(invoiceId: string, userId: string, status: string) {
  const data: any = { status }
  if (status === "SENT") data.sentAt = new Date()
  if (status === "PAID") data.paidAt = new Date()
  await prisma.invoice.update({ where: { id: invoiceId, userId }, data })
  revalidatePath(`/facturation/factures/${invoiceId}`)
  revalidatePath("/facturation/factures")
  revalidatePath("/facturation")
}

export async function updateInvoiceDueDate(invoiceId: string, userId: string, dueDate: string | null) {
  await prisma.invoice.update({
    where: { id: invoiceId, userId },
    data: { dueDate: dueDate ? new Date(dueDate) : null },
  })
  revalidatePath(`/facturation/factures/${invoiceId}`)
}

export async function updateInvoiceNotes(invoiceId: string, userId: string, notes: string | null) {
  await prisma.invoice.update({ where: { id: invoiceId, userId }, data: { notes } })
  revalidatePath(`/facturation/factures/${invoiceId}`)
}

export async function deleteInvoice(invoiceId: string, userId: string) {
  await prisma.invoice.delete({ where: { id: invoiceId, userId } })
  revalidatePath("/facturation/factures")
  revalidatePath("/facturation")
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
  data: { description: string; quantity: number; unitPrice: number; productId?: string }
) {
  const total = data.quantity * data.unitPrice
  await prisma.invoiceLine.create({
    data: {
      invoiceId,
      description: data.description,
      quantity: data.quantity,
      unitPrice: data.unitPrice,
      total,
      productId: data.productId || null,
    },
  })
  await recalcInvoiceTotal(invoiceId)
  revalidatePath(`/facturation/factures/${invoiceId}`)
}

export async function updateInvoiceLine(
  lineId: string,
  data: { description: string; quantity: number; unitPrice: number }
) {
  const total = data.quantity * data.unitPrice
  const line = await prisma.invoiceLine.update({
    where: { id: lineId },
    data: { description: data.description, quantity: data.quantity, unitPrice: data.unitPrice, total },
    select: { invoiceId: true },
  })
  await recalcInvoiceTotal(line.invoiceId)
  revalidatePath(`/facturation/factures/${line.invoiceId}`)
}

export async function deleteInvoiceLine(lineId: string) {
  const line = await prisma.invoiceLine.delete({ where: { id: lineId }, select: { invoiceId: true } })
  await recalcInvoiceTotal(line.invoiceId)
  revalidatePath(`/facturation/factures/${line.invoiceId}`)
}

// ── Produits ──────────────────────────────────────────────────────────────────

export async function createProduct(
  userId: string,
  data: { name: string; description?: string; unitPrice: number; unit?: string }
) {
  const product = await prisma.product.create({
    data: {
      userId,
      name: data.name,
      description: data.description || null,
      unitPrice: data.unitPrice,
      unit: (data.unit as any) || "UNIT",
    },
  })
  revalidatePath("/facturation/produits")
  return product
}

export async function updateProduct(
  productId: string,
  userId: string,
  data: { name?: string; description?: string | null; unitPrice?: number; unit?: string; isActive?: boolean }
) {
  await prisma.product.update({
    where: { id: productId, userId },
    data: data as any,
  })
  revalidatePath("/facturation/produits")
}

export async function deleteProduct(productId: string, userId: string) {
  await prisma.product.delete({ where: { id: productId, userId } })
  revalidatePath("/facturation/produits")
}

// ── Email ─────────────────────────────────────────────────────────────────────

export async function sendInvoiceEmail(invoiceId: string, userId: string) {
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
    to: invoice.client.email ?? userId,
    subject: `Facture ${invoice.number}`,
    html: `
      <p>Bonjour ${invoice.client.name},</p>
      <p>Veuillez trouver ci-joint la facture <strong>${invoice.number}</strong> d'un montant de <strong>${invoice.totalHT.toLocaleString("fr-FR")} €</strong>.</p>
      <p><a href="${pdfUrl}">Télécharger la facture</a></p>
      <p>Cordialement,<br>${invoice.user.name}</p>
    `,
  })

  if (error) throw new Error(error.message)

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
