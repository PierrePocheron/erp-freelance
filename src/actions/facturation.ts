"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"

// ── Numérotation ──────────────────────────────────────────────────────────────

async function nextQuoteNumber(userId: string) {
  const year = new Date().getFullYear()
  const profile = await prisma.userProfile?.findUnique({ where: { userId }, select: { quotePrefix: true } }).catch(() => null)
  const prefix = profile?.quotePrefix ?? "DEV"
  const count = await prisma.quote.count({
    where: { userId, number: { startsWith: `${prefix}-${year}-` } },
  })
  return `${prefix}-${year}-${String(count + 1).padStart(3, "0")}`
}

async function nextInvoiceNumber(userId: string) {
  const year = new Date().getFullYear()
  const profile = await prisma.userProfile?.findUnique({ where: { userId }, select: { invoicePrefix: true } }).catch(() => null)
  const prefix = profile?.invoicePrefix ?? "FAC"
  const count = await prisma.invoice.count({
    where: { userId, number: { startsWith: `${prefix}-${year}-` } },
  })
  return `${prefix}-${year}-${String(count + 1).padStart(3, "0")}`
}

// ── Devis ─────────────────────────────────────────────────────────────────────

export async function createQuoteWithLines(
  userId: string,
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
  userId: string,
  data: {
    clientId: string
    projectId?: string
    depositPercent?: number
    notes?: string
    expiresAtDays?: number
  }
) {
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

export async function updateQuoteStatus(quoteId: string, userId: string, status: string) {
  const data: Record<string, unknown> = { status }
  if (status === "VALIDATED") data.validatedAt = new Date()
  if (status === "SENT") data.sentAt = new Date()
  if (status === "ACCEPTED") data.acceptedAt = new Date()
  await prisma.quote.update({ where: { id: quoteId, userId }, data })
  revalidatePath(`/facturation/devis/${quoteId}`)
  revalidatePath("/facturation/devis")
}

export async function updateQuoteSettings(
  quoteId: string,
  userId: string,
  data: {
    generalConditions?: string | null
    expiresAt?: string | null
    depositPercent?: number
    notes?: string | null
  }
) {
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
  data: {
    description: string
    detail?: string
    quantity: number
    unitPrice: number
    taxRate?: number
    productId?: string
  }
) {
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

export async function createInvoiceFromQuote(quoteId: string, userId: string, type: "DEPOSIT" | "FINAL") {
  const quote = await prisma.quote.findFirst({
    where: { id: quoteId, userId },
    include: { lines: true },
  })
  if (!quote) throw new Error("Devis introuvable")

  const number = await nextInvoiceNumber(userId)
  const isDeposit = type === "DEPOSIT"
  const depositAmount = isDeposit ? quote.totalHT * (quote.depositPercent / 100) : quote.totalHT
  const depositDeducted =
    type === "FINAL" && quote.depositPercent > 0 ? quote.totalHT * (quote.depositPercent / 100) : 0

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
      notes: quote.generalConditions ?? null,
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

export async function markLateInvoices(userId: string) {
  await prisma.invoice.updateMany({
    where: {
      userId,
      status: "SENT",
      dueDate: { lt: new Date() },
    },
    data: { status: "LATE" },
  })
}

export async function updateInvoiceStatus(invoiceId: string, userId: string, status: string) {
  const data: Record<string, unknown> = { status }
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

export async function signQuoteWithFile(quoteId: string, userId: string, fileUrl: string) {
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
  const line = await prisma.invoiceLine.delete({ where: { id: lineId }, select: { invoiceId: true } })
  await recalcInvoiceTotal(line.invoiceId)
  revalidatePath(`/facturation/factures/${line.invoiceId}`)
}

// ── Produits ──────────────────────────────────────────────────────────────────

export async function createProduct(
  userId: string,
  data: { name: string; description?: string; unitPrice: number; unit?: string; billingType?: string; defaultTaxRate?: number }
) {
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
  userId: string,
  data: { name?: string; description?: string | null; unitPrice?: number; unit?: string; isActive?: boolean; billingType?: string; defaultTaxRate?: number }
) {
  await prisma.product.update({
    where: { id: productId, userId },
    data: data as never,
  })
  revalidatePath("/facturation/produits")
}

export async function deleteProduct(productId: string, userId: string) {
  await prisma.product.delete({ where: { id: productId, userId } })
  revalidatePath("/facturation/produits")
}

// ── Récurrentes ───────────────────────────────────────────────────────────────

export async function createRecurringInvoice(
  userId: string,
  data: {
    clientId: string
    projectId?: string
    name: string
    frequency: string
    nextGenerationDate: string
  }
) {
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
  userId: string,
  data: {
    name?: string
    frequency?: string
    nextGenerationDate?: string
    isActive?: boolean
    projectId?: string | null
  }
) {
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

export async function deleteRecurringInvoice(id: string, userId: string) {
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
  userId: string
): Promise<{ id: string }> {
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
  userId: string,
  lines: RecurringLine[]
) {
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

export async function resendQuoteEmail(quoteId: string, userId: string) {
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

  if (error) throw new Error(error.message)
  revalidatePath(`/facturation/devis/${quoteId}`)
}

export async function sendQuoteEmail(quoteId: string, userId: string) {
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

  if (error) throw new Error(error.message)

  await updateQuoteStatus(quoteId, userId, "SENT")
}

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

export async function sendInvoiceReminder(invoiceId: string, userId: string) {
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

  if (error) throw new Error(error.message)

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
