import "server-only"
import { prisma } from "@/lib/prisma"
import { renderToBuffer } from "@react-pdf/renderer"
import { InvoicePDF } from "@/lib/pdf"
import { resolveEmitter } from "@/lib/emitter-resolve"
import React from "react"

// Rend une facture en PDF (Buffer). Utilisé par la route de visualisation
// et par l'émission (où le PDF est figé sur Blob).
export async function buildInvoicePdfBuffer(invoiceId: string, userId: string): Promise<Buffer> {
  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, userId },
    include: {
      client: true,
      lines: { orderBy: { id: "asc" } },
      user: { select: { name: true, email: true } },
    },
  })

  if (!invoice) throw new Error("Facture introuvable")

  const { emitter, accentColor } = await resolveEmitter({
    userId,
    emitterProfileId: invoice.emitterProfileId,
    userName: invoice.user.name,
    userEmail: invoice.user.email,
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const element: any = React.createElement(InvoicePDF, {
    type: "FACTURE",
    number: invoice.number,
    createdAt: invoice.createdAt,
    dueDate: invoice.dueDate,
    sentAt: invoice.sentAt,
    depositDeducted: invoice.depositDeducted,
    accentColor,
    emitter,
    client: {
      name: invoice.client.name,
      company: invoice.client.company,
      email: invoice.client.email,
    },
    lines: invoice.lines.map((l) => ({
      description: l.description,
      detail: l.detail,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      taxRate: l.taxRate,
      total: l.total,
    })),
    notes: invoice.notes,
    generalConditions: invoice.generalConditions,
    totalHT: invoice.totalHT,
  })

  return Buffer.from(await renderToBuffer(element))
}
