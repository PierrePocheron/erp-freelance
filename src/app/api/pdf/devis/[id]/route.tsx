import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { buildQuotePdfBuffer } from "@/lib/invoice-pdf"
import { NextRequest } from "next/server"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return new Response("Unauthorized", { status: 401 })

  const { id } = await params
  const userId = session.user.id

  // Le rendu vit dans lib/invoice-pdf.ts (même fabrique que la facture et que la
  // pièce jointe des emails) — cette route ne fait plus que l'autorisation.
  const quote = await prisma.quote.findFirst({ where: { id, userId }, select: { number: true } })
  if (!quote) return new Response("Not found", { status: 404 })

  const buffer = await buildQuotePdfBuffer(id, userId)

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${quote.number}.pdf"`,
    },
  })
}
