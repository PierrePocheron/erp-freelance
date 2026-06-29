// Route déclenchée quotidiennement par Vercel Cron (vercel.json).
// Crée une facture brouillon RECURRING pour chaque renouvellement dont l'échéance
// est atteinte, puis avance l'échéance — idempotence naturelle via expiresAt.
//
// Sécurité : Authorization: Bearer <CRON_SECRET>

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { createRenewalDraftInvoice } from "@/lib/renewal-invoice"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Fin du jour en UTC pour ne rater aucune échéance du jour courant
  const endOfToday = new Date()
  endOfToday.setUTCHours(23, 59, 59, 999)

  // Seuls les renouvellements avec periodMonths sont candidats — sans période,
  // l'échéance ne peut pas avancer et le cron recréerait une facture chaque jour.
  const renewals = await prisma.renewal.findMany({
    where: {
      expiresAt: { lte: endOfToday },
      periodMonths: { not: null },
      amount: { gt: 0 },
    },
    include: {
      postDev: {
        select: {
          project: {
            select: {
              id: true,
              userId: true,
              clientId: true,
              companyId: true,
              contactLinks: {
                select: { clientId: true, role: true },
                orderBy: { createdAt: "asc" },
              },
            },
          },
        },
      },
    },
  })

  const results = {
    processed: renewals.length,
    created: 0,
    errors: [] as { name: string; error: string }[],
  }

  for (const renewal of renewals) {
    try {
      await createRenewalDraftInvoice(renewal, renewal.postDev.project.userId)
      results.created++
    } catch (err) {
      results.errors.push({
        name: renewal.name,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  return NextResponse.json(results)
}
