import { auth }  from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma }  from "@/lib/prisma"
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
  const year = yearParam ? parseInt(yearParam) : new Date().getFullYear()

  const [fiscalSources, revenues, paidInvoices] = await Promise.all([
    // Sources configurées
    prisma.fiscalSource.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
      include: {
        emitterProfiles: { select: { id: true, name: true, companyName: true } },
      },
    }),

    // Revenus manuels de l'année (toutes sources)
    prisma.revenue.findMany({
      where: {
        userId,
        period: { startsWith: `${year}-` },
      },
      select: {
        id: true,
        label: true,
        amount: true,
        status: true,
        period: true,
        fiscalSourceId: true,
        fiscalSource: { select: { id: true, name: true, bucket: true, color: true } },
      },
      orderBy: { period: "asc" },
    }),

    // Factures payées de l'année (bucket AE via l'émetteur)
    prisma.invoice.findMany({
      where: {
        userId,
        status: "PAID",
        paidAt: {
          gte: new Date(`${year}-01-01`),
          lte: new Date(`${year}-12-31T23:59:59`),
        },
        emitter: { fiscalSourceId: { not: null } },
      },
      select: {
        id: true,
        number: true,
        totalHT: true,
        paidAt: true,
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
          id: r.id,
          label: r.label,
          amount: r.amount,
          status: r.status,
          period: r.period ?? "",
          fiscalSourceId: r.fiscalSourceId,
        }))}
        paidInvoices={paidInvoices
          .filter(inv => inv.emitter?.fiscalSourceId)
          .map(inv => ({
            id:            inv.id,
            number:        inv.number,
            totalHT:       inv.totalHT,
            paidAt:        inv.paidAt!.toISOString(),
            fiscalSourceId: inv.emitter!.fiscalSourceId!,
          }))}
      />
    </div>
  )
}
