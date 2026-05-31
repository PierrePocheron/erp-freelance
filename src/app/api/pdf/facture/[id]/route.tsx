import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { buildInvoicePdfBuffer } from "@/lib/invoice-pdf"
import { NextRequest } from "next/server"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return new Response("Unauthorized", { status: 401 })

  const { id } = await params
  const userId = session.user.id

  const invoice = await prisma.invoice.findFirst({
    where: { id, userId },
    select: { number: true, pdfUrl: true },
  })
  if (!invoice) return new Response("Not found", { status: 404 })

  // Facture émise → on sert le PDF figé stocké sur Blob (immuable).
  if (invoice.pdfUrl) {
    const upstream = await fetch(invoice.pdfUrl)
    if (upstream.ok) {
      return new Response(upstream.body, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `inline; filename="${invoice.number}.pdf"`,
        },
      })
    }
    // Si le blob est inaccessible, on retombe sur un rendu à la volée.
  }

  const buffer = await buildInvoicePdfBuffer(id, userId)

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${invoice.number}.pdf"`,
    },
  })
}
