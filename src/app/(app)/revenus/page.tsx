import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import Link from "next/link"
import { TrendingUp, Clock, CheckCircle2, Repeat, BarChart2 } from "lucide-react"
import { REVENUE_TYPE_LABELS, PAYMENT_METHOD_LABELS } from "@/lib/revenue-constants"
import { RevenueManager } from "@/components/modules/revenus/RevenueManager"

const fmt = (n: number) => n.toLocaleString("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })

export default async function RevenuePage() {
  const session = await auth()
  const userId = session!.user.id

  const now = new Date()
  const currentYear = now.getFullYear()

  const [revenues, recurringRevenues, companies, clients, projects, fiscalSources] = await Promise.all([
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
    prisma.fiscalSource.findMany({
      where: { userId, isActive: true },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, bucket: true, color: true },
    }),
  ])

  // ── KPIs ──────────────────────────────────────────────────────────────────────

  const yearPrefix = `${currentYear}-`
  const yearRevenues = revenues.filter(r => r.period?.startsWith(yearPrefix))

  const totalYear     = yearRevenues.filter(r => r.status === "RECEIVED").reduce((s, r) => s + r.amount, 0)
  const totalPending  = revenues.filter(r => r.status === "PENDING").reduce((s, r) => s + r.amount, 0)
  const totalReceived = revenues.filter(r => r.status === "RECEIVED").reduce((s, r) => s + r.amount, 0)

  const currentPeriod = `${currentYear}-${String(now.getMonth() + 1).padStart(2, "0")}`
  const monthRevenues = revenues.filter(r => r.period === currentPeriod)
  const totalMonth    = monthRevenues.filter(r => r.status === "RECEIVED").reduce((s, r) => s + r.amount, 0)

  // ── Groupement par période ─────────────────────────────────────────────────

  const byPeriod: Record<string, typeof revenues> = {}
  for (const r of revenues) {
    const key = r.period ?? "Sans période"
    if (!byPeriod[key]) byPeriod[key] = []
    byPeriod[key].push(r)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Revenus</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Suivi des revenus hors auto-entreprise
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
          <p className="text-xs text-muted-foreground">{yearRevenues.filter(r => r.status === "RECEIVED").length} entrées</p>
        </div>
        <div className="rounded-xl border border-border/50 bg-card p-4 space-y-1">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <CheckCircle2 className="h-4 w-4 text-blue-600" />
            Ce mois — encaissé
          </div>
          <p className="text-xl font-bold tabular-nums text-blue-600">{fmt(totalMonth)} €</p>
          <p className="text-xs text-muted-foreground">{monthRevenues.filter(r => r.status === "RECEIVED").length} entrées</p>
        </div>
        <div className="rounded-xl border border-border/50 bg-card p-4 space-y-1">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="h-4 w-4 text-amber-600" />
            En attente
          </div>
          <p className="text-xl font-bold tabular-nums text-amber-600">{fmt(totalPending)} €</p>
          <p className="text-xs text-muted-foreground">{revenues.filter(r => r.status === "PENDING").length} entrées</p>
        </div>
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

      {/* Gestionnaire client */}
      <RevenueManager
        initialRevenues={revenues.map(r => ({
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
        }))}
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
