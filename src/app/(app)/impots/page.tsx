import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { ImpotsView } from "@/components/modules/impots/ImpotsView"
import { suggestDeclarationLines } from "@/actions/urssaf"
import { periodToDeclare, ratesFromProfile } from "@/lib/urssaf"
import type { Metadata } from "next"

export const metadata: Metadata = { title: "Impôts — ERP Freelance" }

export default async function ImpotsPage() {
  const session = await auth()
  const userId = session!.user.id

  const [profile, declarations] = await Promise.all([
    prisma.userProfile.findUnique({ where: { userId } }),
    prisma.urssafDeclaration.findMany({
      where: { userId },
      orderBy: { periodStart: "desc" },
      include: { lines: { orderBy: { amount: "desc" } } },
    }),
  ])

  const frequency = profile?.urssafFrequency ?? "QUARTERLY"
  const toDeclare = periodToDeclare(new Date(), frequency)

  // Lignes suggérées pour la prochaine déclaration (si pas encore créée)
  const alreadyDeclared = declarations.some(d => d.period === toDeclare)
  const suggestedLines = alreadyDeclared ? [] : await suggestDeclarationLines(toDeclare)

  const rates = profile
    ? ratesFromProfile(profile)
    : ratesFromProfile({
        rateBNCCotisations: 25.6, rateBNCVL: 2.2, rateBNCCFP: 0.2,
        rateBICServicesCotisations: 21.2, rateBICServicesVL: 1.7, rateBICServicesCFP: 0.1,
        rateBICSalesCotisations: 12.3, rateBICSalesVL: 1.0, rateBICSalesCFP: 0.1,
      })

  return (
    <ImpotsView
      declarations={declarations.map(d => ({
        id:                   d.id,
        period:               d.period,
        status:               d.status,
        dueDate:              d.dueDate?.toISOString() ?? null,
        declaredAt:           d.declaredAt?.toISOString() ?? null,
        paidAt:               d.paidAt?.toISOString() ?? null,
        amountBNC:            d.amountBNC,
        amountBICServices:    d.amountBICServices,
        amountBICSales:       d.amountBICSales,
        cotisations:          d.cotisations,
        cfp:                  d.cfp,
        versementLiberatoire: d.versementLiberatoire,
        totalPaid:            d.totalPaid,
        notes:                d.notes,
        lines: d.lines.map(l => ({
          id:        l.id,
          category:  l.category,
          invoiceId: l.invoiceId,
          revenueId: l.revenueId,
          label:     l.label,
          amount:    l.amount,
        })),
      }))}
      rates={rates}
      vlEnabled={profile?.versementLiberatoire ?? true}
      frequency={frequency}
      periodToDeclare={toDeclare}
      suggestedLines={suggestedLines}
    />
  )
}
