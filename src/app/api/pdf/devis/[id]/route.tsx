import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { renderToBuffer } from "@react-pdf/renderer"
import { InvoicePDF } from "@/lib/pdf"
import { resolveEmitter } from "@/lib/emitter-resolve"
import { NextRequest } from "next/server"
import React from "react"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return new Response("Unauthorized", { status: 401 })

  const { id } = await params
  const userId = session.user.id

  const quote = await prisma.quote.findFirst({
    where: { id, userId },
    include: {
      client: true,
      lines: { orderBy: { id: "asc" } },
      user: { select: { name: true, email: true } },
    },
  })

  if (!quote) return new Response("Not found", { status: 404 })

  const { emitter, accentColor, branding } = await resolveEmitter({
    userId,
    emitterProfileId: quote.emitterProfileId,
    userName: quote.user.name,
    userEmail: quote.user.email,
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const element: any = React.createElement(InvoicePDF, {
    type: "DEVIS",
    number: quote.number,
    createdAt: quote.createdAt,
    expiresAt: quote.expiresAt,
    sentAt: quote.sentAt,
    acceptedAt: quote.acceptedAt,
    depositPercent: quote.depositPercent,
    generalConditions: quote.generalConditions,
    accentColor,
    logoText: branding.logoText,
    logoSubtext: branding.logoSubtext,
    backgroundColor: branding.backgroundColor,
    emitter,
    client: {
      name: quote.client.name,
      company: quote.client.company,
      email: quote.client.email,
      address: quote.client.address,
      postalCode: quote.client.postalCode,
      city: quote.client.city,
      siret: quote.client.siret,
    },
    lines: quote.lines.map((l) => ({
      description: l.description,
      detail: l.detail,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      taxRate: l.taxRate,
      total: l.total,
    })),
    totalHT: quote.totalHT,
  })

  const buffer = await renderToBuffer(element)

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${quote.number}.pdf"`,
    },
  })
}
