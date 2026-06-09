import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { TrendingUp, Clock, CheckCircle2, Repeat } from "lucide-react"
import { REVENUE_TYPE_LABELS, PAYMENT_METHOD_LABELS } from "@/actions/revenue"
import { RevenueManager } from "@/components/modules/revenus/RevenueManager"

const fmt = (n: number) => n.toLocaleString("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })

export default async function RevenuePage() {
  const session = await auth()
  const userId = session!.user.id

  const now = new Date()
  const currentYear = now.getFullYear()

  const [revenues, recurringRevenues] = await Promise.all([
    prisma.revenue.findMany({
      where: { userId },
      orderBy: [{ period: "desc" }, { createdAt: "desc" }],
      include: { recurringRevenue: { select: { id: true, label: true } } },
    }),
    prisma.recurringRevenue.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
      include: { _count: { select: { revenues: true } } },
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
          createdAt:   r.createdAt.toISOString(),
          updatedAt:   r.updatedAt.toISOString(),
          receivedAt:  r.receivedAt?.toISOString() ?? null,
          recurringRevenue: r.recurringRevenue ?? null,
        }))}
        initialRecurring={recurringRevenues.map(r => ({
          ...r,
          createdAt: r.createdAt.toISOString(),
          updatedAt: r.updatedAt.toISOString(),
          _count:    r._count,
        }))}
        revenueTypeLabels={REVENUE_TYPE_LABELS}
        paymentMethodLabels={PAYMENT_METHOD_LABELS}
      />
    </div>
  )
}
