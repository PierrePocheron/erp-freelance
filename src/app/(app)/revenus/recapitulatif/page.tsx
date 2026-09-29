import { auth }  from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma }  from "@/lib/prisma"
import { zonedMidnight, zonedParts } from "@/lib/dates"
import Link from "next/link"
import { ChevronLeft } from "lucide-react"
import { FiscalSummary } from "@/components/modules/revenus/FiscalSummary"

export default async function RecapitulatifPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>
}) {
  const session = await auth()
  if (!session) redirect("/login")
  const userId = session.user.id

  const { year: yearParam } = await searchParams
  const year = yearParam ? parseInt(yearParam) : zonedParts(new Date()).year
  // Bornes de l'exercice en heure de Paris (la prod tourne en UTC)
  const yearStart = zonedMidnight(`${year}-01-01`)
  const yearEnd = new Date(zonedMidnight(`${year + 1}-01-01`).getTime() - 1)

  const [fiscalSources, revenues, paidInvoices] = await Promise.all([
    // Sources configurées
    prisma.fiscalSource.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
      include: {
        emitterProfiles: { select: { id: true, name: true, companyName: true } },
      },
    }),

    // Revenus ENCAISSÉS de l'exercice (#38) : une seule clé d'exercice, la date d'encaissement
    // (la période seulement si elle manque). Avant : les revenus en attente étaient comptés, et
    // un revenu « 2025-12 » encaissé le 05/01/2026 apparaissait dans les DEUX récapitulatifs.
    prisma.revenue.findMany({
      where: {
        userId,
        status: "RECEIVED",
        OR: [
          { receivedAt: { gte: yearStart, lte: yearEnd } },
          { receivedAt: null, period: { startsWith: `${year}-` } },
        ],
      },
      select: {
        id: true,
        label: true,
        amount: true,
        status: true,
        period: true,
        receivedAt: true,
        fiscalSourceId: true,
        fiscalSource: { select: { id: true, name: true, bucket: true, color: true } },
        // Contexte : client ou société associée
        client:  { select: { id: true, name: true, company: true } },
        company: { select: { id: true, name: true } },
        project: { select: { id: true, name: true } },
      },
      orderBy: [{ period: "asc" }, { receivedAt: "asc" }],
    }),

    // Factures payées de l'année (bucket AE via l'émetteur) — avec client et projet
    prisma.invoice.findMany({
      where: {
        userId,
        status: "PAID",
        paidAt: { gte: yearStart, lte: yearEnd },
        emitter: { fiscalSourceId: { not: null } },
      },
      select: {
        id: true,
        number: true,
        totalHT: true,
        depositDeducted: true,
        paidAt: true,
        client:  { select: { id: true, name: true, company: true } },
        project: { select: { id: true, name: true } },
        emitter: {
          select: {
            fiscalSourceId: true,
            fiscalSource: { select: { id: true, name: true, bucket: true, color: true } },
          },
        },
      },
      orderBy: { paidAt: "asc" },
    }),
  ])

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/revenus"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-3"
        >
          <ChevronLeft className="h-4 w-4" /> Revenus
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">Récapitulatif fiscal</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Synthèse annuelle de vos revenus par source fiscale
        </p>
      </div>

      <FiscalSummary
        year={year}
        fiscalSources={fiscalSources.map(fs => ({
          id: fs.id,
          name: fs.name,
          bucket: fs.bucket,
          color: fs.color,
          emitterProfileIds: fs.emitterProfiles.map(e => e.id),
        }))}
        revenues={revenues.map(r => ({
          id:             r.id,
          label:          r.label,
          amount:         r.amount,
          status:         r.status,
          period:         r.period ?? "",
          receivedAt:     r.receivedAt?.toISOString() ?? null,
          fiscalSourceId: r.fiscalSourceId,
          clientName:     r.client?.name ?? null,
          clientCompany:  r.client?.company ?? r.company?.name ?? null,
          projectName:    r.project?.name ?? null,
        }))}
        paidInvoices={paidInvoices
          .filter(inv => inv.emitter?.fiscalSourceId)
          .map(inv => ({
            id:             inv.id,
            number:         inv.number,
            totalHT:        inv.totalHT - inv.depositDeducted,
            paidAt:         inv.paidAt!.toISOString(),
            fiscalSourceId: inv.emitter!.fiscalSourceId!,
            clientName:     inv.client?.name ?? null,
            clientCompany:  inv.client?.company ?? null,
            projectName:    inv.project?.name ?? null,
          }))}
      />
    </div>
  )
}
