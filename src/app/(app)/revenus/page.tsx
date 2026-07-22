import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import Link from "next/link"
import { TrendingUp, Clock, CheckCircle2, Repeat, BarChart2, Wallet, ArrowRight } from "lucide-react"
import { REVENUE_TYPE_LABELS, PAYMENT_METHOD_LABELS } from "@/lib/revenue-constants"
import { RevenueManager } from "@/components/modules/revenus/RevenueManager"

const fmt = (n: number) => n.toLocaleString("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })

function invPeriod(d: Date | null): string | null {
  if (!d) return null
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

export default async function RevenuePage() {
  const session = await auth()
  const userId = session!.user.id

  const now = new Date()
  const currentYear = now.getFullYear()

  const [revenues, recurringRevenues, companies, clients, projects, fiscalSources, paidInvoices] = await Promise.all([
    prisma.revenue.findMany({
      where: { userId },
      orderBy: [{ period: "desc" }, { createdAt: "desc" }],
      include: {
        recurringRevenue: { select: { id: true, label: true } },
        fiscalSource:     { select: { id: true, name: true, bucket: true, color: true } },
        company: { select: { name: true } },
        client:  { select: { name: true, company: true } },
        project: { select: { name: true } },
      },
    }),
    prisma.recurringRevenue.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
      include: {
        _count:  { select: { revenues: true } },
        company: { select: { name: true } },
        client:  { select: { name: true, company: true } },
        project: { select: { name: true } },
      },
    }),
    prisma.company.findMany({
      where: { userId },
      orderBy: { name: "asc" },
      select: { id: true, name: true, city: true },
    }),
    prisma.client.findMany({
      where: { userId, type: { not: "SELF" } },
      orderBy: { name: "asc" },
      select: { id: true, name: true, company: true, companyId: true },
    }),
    prisma.project.findMany({
      where: { userId },
      orderBy: { name: "asc" },
      select: { id: true, name: true, clientId: true, companyId: true },
    }),
    // Toutes les sources fiscales (actives et inactives) pour le filtre
    prisma.fiscalSource.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, bucket: true, color: true, isActive: true },
    }),
    // Factures payées liées à une source fiscale (revenus AE)
    prisma.invoice.findMany({
      where: { userId, status: "PAID", paidAt: { not: null } },
      orderBy: { paidAt: "asc" },
      select: {
        id: true, number: true, totalHT: true, depositDeducted: true, paidAt: true,
        client:  { select: { name: true, company: true } },
        project: { select: { name: true } },
        emitter: {
          select: {
            fiscalSource: { select: { id: true, name: true, bucket: true, color: true } },
          },
        },
      },
    }),
  ])

  // ── Revenus AE depuis les factures payées ─────────────────────────────────
  // Seules les factures liées à un profil émetteur avec une source fiscale sont
  // incluses, pour ne pas dupliquer des factures sans catégorie fiscale.
  const invoicesWithSource = paidInvoices.filter(inv => inv.emitter?.fiscalSource != null)

  const aeRevenueItems = invoicesWithSource.map(inv => ({
    id:               `inv-${inv.id}`,
    type:             "FREELANCE" as const,
    label:            inv.number,
    amount:           inv.totalHT - inv.depositDeducted,
    currency:         "EUR",
    status:           "RECEIVED" as const,
    receivedAt:       inv.paidAt!.toISOString(),
    expectedAt:       null,
    paymentMethod:    null,
    notes:            null,
    period:           invPeriod(inv.paidAt),
    recurringRevenueId: null,
    fiscalSourceId:   inv.emitter!.fiscalSource!.id,
    companyId:        null,
    clientId:         null,
    projectId:        null,
    createdAt:        inv.paidAt!.toISOString(),
    updatedAt:        inv.paidAt!.toISOString(),
    recurringRevenue: null,
    fiscalSource:     inv.emitter!.fiscalSource,
    company:          null,
    client:           inv.client ? { name: inv.client.company ?? inv.client.name, company: inv.client.company ?? null } : null,
    project:          inv.project,
    isFromInvoice:    true as const,
    invoiceHref:      `/facturation/factures/${inv.id}`,
  }))

  // Liste unifiée — Revenue DB + factures AE
  const allRevenues = [
    ...revenues.map(r => ({
      ...r,
      createdAt:    r.createdAt.toISOString(),
      updatedAt:    r.updatedAt.toISOString(),
      receivedAt:   r.receivedAt?.toISOString() ?? null,
      expectedAt:   r.expectedAt?.toISOString() ?? null,
      recurringRevenue: r.recurringRevenue ?? null,
      fiscalSource: r.fiscalSource ?? null,
      company: r.company ?? null,
      client:  r.client ?? null,
      project: r.project ?? null,
      isFromInvoice: false as const,
      invoiceHref:  undefined as string | undefined,
    })),
    ...aeRevenueItems,
  ]

  // ── KPIs (toutes sources confondues) ──────────────────────────────────────

  const yearPrefix    = `${currentYear}-`
  const currentPeriod = `${currentYear}-${String(now.getMonth() + 1).padStart(2, "0")}`

  const totalYear     = allRevenues.filter(r => r.period?.startsWith(yearPrefix) && r.status === "RECEIVED").reduce((s, r) => s + r.amount, 0)
  const totalMonth    = allRevenues.filter(r => r.period === currentPeriod && r.status === "RECEIVED").reduce((s, r) => s + r.amount, 0)
  const totalPending  = allRevenues.filter(r => r.status === "PENDING").reduce((s, r) => s + r.amount, 0)
  const totalRecvYear = allRevenues.filter(r => r.period?.startsWith(yearPrefix) && r.status === "RECEIVED").length
  const totalRecvMonth= allRevenues.filter(r => r.period === currentPeriod && r.status === "RECEIVED").length

  // ── Répartition par source fiscale (toutes sources) ───────────────────────
  // Collecte toutes les sources présentes dans les données
  const allSourceMap = new Map<string, { id: string; name: string; bucket: string; color: string }>()
  for (const r of allRevenues) {
    if (r.fiscalSource) allSourceMap.set(r.fiscalSource.id, r.fiscalSource)
  }

  const sourceStats = [...allSourceMap.values()].map(src => {
    const srcRevs = allRevenues.filter(r => r.fiscalSourceId === src.id)
    return {
      ...src,
      count:    srcRevs.length,
      received: srcRevs.filter(r => r.status === "RECEIVED").reduce((s, r) => s + r.amount, 0),
      pending:  srcRevs.filter(r => r.status === "PENDING").reduce((s, r) => s + r.amount, 0),
    }
  }).filter(s => s.count > 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="sm:hidden text-2xl font-bold tracking-tight">Revenus</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Vue unifiée — revenus manuels + factures AE encaissées
          </p>
        </div>
        <Link
          href="/revenus/recapitulatif"
          className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium hover:bg-accent transition-colors"
        >
          <BarChart2 className="h-4 w-4 text-muted-foreground" />
          Récapitulatif fiscal
        </Link>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-border/50 bg-card p-4 space-y-1">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <TrendingUp className="h-4 w-4 text-emerald-600" />
            {currentYear} — encaissé
          </div>
          <p className="text-xl font-bold tabular-nums text-emerald-600">{fmt(totalYear)} €</p>
          <p className="text-xs text-muted-foreground">{totalRecvYear} entrées</p>
        </div>
        <div className="rounded-xl border border-border/50 bg-card p-4 space-y-1">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <CheckCircle2 className="h-4 w-4 text-blue-600" />
            Ce mois — encaissé
          </div>
          <p className="text-xl font-bold tabular-nums text-blue-600">{fmt(totalMonth)} €</p>
          <p className="text-xs text-muted-foreground">{totalRecvMonth} entrées</p>
        </div>
        {/* Cliquable : filtre le tableau sur les montants en attente + déplie tout */}
        <Link
          href="/revenus?filtre=attente"
          scroll={false}
          title="Voir uniquement les montants en attente"
          className="rounded-xl border border-border/50 bg-card p-4 space-y-1 hover:border-amber-500/40 hover:bg-amber-500/5 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="h-4 w-4 text-amber-600" />
            En attente
          </div>
          <p className="text-xl font-bold tabular-nums text-amber-600">{fmt(totalPending)} €</p>
          <p className="text-xs text-muted-foreground">{allRevenues.filter(r => r.status === "PENDING").length} entrées</p>
        </Link>
        <div className="rounded-xl border border-border/50 bg-card p-4 space-y-1">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Repeat className="h-4 w-4 text-muted-foreground" />
            Récurrents actifs
          </div>
          <p className="text-xl font-bold tabular-nums">{recurringRevenues.filter(r => r.isActive).length}</p>
          <p className="text-xs text-muted-foreground">
            {fmt(recurringRevenues.filter(r => r.isActive).reduce((s, r) => s + r.amount, 0))} €/mois
          </p>
        </div>
      </div>

      {/* Sources fiscales — répartition */}
      {sourceStats.length > 0 && (
        <div className="rounded-xl border border-border/50 bg-card p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Wallet className="h-4 w-4 text-muted-foreground" />
              <h2 className="font-semibold text-sm">Par source fiscale</h2>
            </div>
            <Link
              href="/revenus/sources"
              className="flex items-center gap-1 text-xs text-primary hover:underline"
            >
              Gérer <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {sourceStats.map(src => (
              <div
                key={src.id}
                className="rounded-lg border border-border/50 px-3 py-2.5 text-xs space-y-1"
              >
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: src.color }} />
                  <span className="font-medium truncate flex-1">{src.name}</span>
                  <span className="text-muted-foreground/60 tabular-nums shrink-0">
                    {src.count} entrée{src.count !== 1 ? "s" : ""}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Validé</span>
                  <span className="text-emerald-600 font-semibold tabular-nums">{fmt(src.received)} €</span>
                </div>
                {src.pending > 0 && (
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">En attente</span>
                    <span className="text-amber-600 font-medium tabular-nums">{fmt(src.pending)} €</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Gestionnaire */}
      <RevenueManager
        initialRevenues={allRevenues}
        initialRecurring={recurringRevenues.map(r => ({
          ...r,
          createdAt: r.createdAt.toISOString(),
          updatedAt: r.updatedAt.toISOString(),
          _count:    r._count,
          company: r.company ?? null,
          client:  r.client ?? null,
          project: r.project ?? null,
        }))}
        revenueTypeLabels={REVENUE_TYPE_LABELS}
        paymentMethodLabels={PAYMENT_METHOD_LABELS}
        companies={companies}
        clients={clients}
        projects={projects}
        fiscalSources={fiscalSources}
      />
    </div>
  )
}
