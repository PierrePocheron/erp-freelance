import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { renderToBuffer } from "@react-pdf/renderer"
import { InvoicePDF } from "@/lib/pdf"
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

  const [invoice, profile] = await Promise.all([
    prisma.invoice.findFirst({
      where: { id, userId },
      include: {
        client: true,
        lines: { orderBy: { id: "asc" } },
        user: { select: { name: true, email: true } },
      },
    }),
    prisma.userProfile?.findUnique({ where: { userId } }).catch(() => null),
  ])

  if (!invoice) return new Response("Not found", { status: 404 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const element: any = React.createElement(InvoicePDF, {
    type: "FACTURE",
    number: invoice.number,
    createdAt: invoice.createdAt,
    dueDate: invoice.dueDate,
    sentAt: invoice.sentAt,
    depositDeducted: invoice.depositDeducted,
    emitter: {
      name: invoice.user.name ?? "Freelance",
      email: invoice.user.email,
      companyName: profile?.companyName,
      address: profile?.address,
      postalCode: profile?.postalCode,
      city: profile?.city,
      siret: profile?.siret,
      phone: profile?.phone,
      iban: profile?.iban,
      bic: profile?.bic,
    },
    client: {
      name: invoice.client.name,
      company: invoice.client.company,
      email: invoice.client.email,
    },
    lines: invoice.lines,
    notes: invoice.notes,
    totalHT: invoice.totalHT,
  })

  const buffer = await renderToBuffer(element)

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${invoice.number}.pdf"`,
    },
  })
}
