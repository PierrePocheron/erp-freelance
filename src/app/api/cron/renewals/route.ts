// Route déclenchée quotidiennement par Vercel Cron (vercel.json).
// Crée une facture brouillon RECURRING pour chaque renouvellement dont l'échéance
// est atteinte, puis avance l'échéance — idempotence naturelle via expiresAt.
//
// Sécurité : Authorization: Bearer <CRON_SECRET>

import { NextRequest, NextResponse } from "next/server"
import { timingSafeEqual } from "node:crypto"
import { prisma } from "@/lib/prisma"
import { createRenewalDraftInvoice } from "@/lib/renewal-invoice"

export const dynamic = "force-dynamic"

// Comparaison à temps constant : évite qu'une attaque temporelle reconstitue le
// secret octet par octet (endpoint public déclenché par Vercel Cron).
function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  if (bufA.length !== bufB.length) return false
  return timingSafeEqual(bufA, bufB)
}

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  const authHeader = req.headers.get("authorization")
  if (!secret || !authHeader || !safeEqual(authHeader, `Bearer ${secret}`)) {
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

  type Outcome =
    | { ok: true }
    | { ok: false; name: string; error: string }

  const outcomes = await Promise.all<Outcome>(
    renewals.map(async (renewal) => {
      try {
        await createRenewalDraftInvoice(renewal, renewal.postDev.project.userId)
        return { ok: true }
      } catch (err) {
        return { ok: false, name: renewal.name, error: err instanceof Error ? err.message : String(err) }
      }
    })
  )

  return NextResponse.json({
    processed: renewals.length,
    created: outcomes.filter(o => o.ok).length,
    errors: outcomes.flatMap(o => o.ok ? [] : [{ name: o.name, error: o.error }]),
  })
}
