import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import Link from "next/link"
import { TrendingUp, Clock, AlertCircle, CheckCircle2, BarChart3 } from "lucide-react"
import { markLateInvoices } from "@/actions/facturation"

const MONTHS_FR = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"]

export default async function FacturationOverviewPage() {
  const session = await auth()
  const userId = session!.user.id

  // Auto-marquer les factures en retard
  await markLateInvoices(userId)

  const now = new Date()
  const yearStart = new Date(now.getFullYear(), 0, 1)
  const yearEnd = new Date(now.getFullYear(), 11, 31, 23, 59, 59)

  const [invoicesThisYear, allPending, quotes] = await Promise.all([
    prisma.invoice.findMany({
      where: { userId, createdAt: { gte: yearStart, lte: yearEnd } },
      include: { client: { select: { name: true, company: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.invoice.findMany({
      where: { userId, status: { in: ["SENT", "LATE"] } },
      include: { client: { select: { name: true, company: true } } },
      orderBy: { dueDate: "asc" },
    }),
    prisma.quote.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { client: { select: { name: true, company: true } } },
    }),
  ])

  const paidThisYear = invoicesThisYear
    .filter((i) => i.status === "PAID")
    .reduce((s, i) => s + i.totalHT - i.depositDeducted, 0)

  const totalPending = allPending
    .filter((i) => i.status === "SENT")
    .reduce((s, i) => s + i.totalHT - i.depositDeducted, 0)

  const totalLate = allPending
    .filter((i) => i.status === "LATE")
    .reduce((s, i) => s + i.totalHT - i.depositDeducted, 0)

  const quotesWaiting = quotes.filter((q) => q.status === "SENT").length

  // Revenus mensuels (factures payées cette année)
  const monthlyRevenue = Array.from({ length: 12 }, (_, m) => {
    const total = invoicesThisYear
      .filter((i) => {
        if (i.status !== "PAID") return false
        const d = new Date(i.paidAt ?? i.createdAt)
        return d.getMonth() === m
      })
      .reduce((s, i) => s + i.totalHT - i.depositDeducted, 0)
    return total
  })

  const maxMonthly = Math.max(...monthlyRevenue, 1)
  const currentMonth = now.getMonth()

  const recentInvoices = invoicesThisYear.slice(0, 8)

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Facturation</h1>
        <p className="text-sm text-muted-foreground">Vue d'ensemble {now.getFullYear()}</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KPI
          icon={<CheckCircle2 className="h-4 w-4 text-emerald-500" />}
          label="Encaissé"
          value={`${paidThisYear.toLocaleString("fr-FR")} €`}
          sub={`en ${now.getFullYear()}`}
        />
        <KPI
          icon={<Clock className="h-4 w-4 text-blue-500" />}
          label="En attente"
          value={`${totalPending.toLocaleString("fr-FR")} €`}
          sub={`${allPending.filter((i) => i.status === "SENT").length} facture(s) envoyée(s)`}
        />
        <KPI
          icon={<AlertCircle className="h-4 w-4 text-red-500" />}
          label="En retard"
          value={`${totalLate.toLocaleString("fr-FR")} €`}
          sub={`${allPending.filter((i) => i.status === "LATE").length} facture(s)`}
          alert={totalLate > 0}
        />
        <KPI
          icon={<TrendingUp className="h-4 w-4 text-amber-500" />}
          label="Devis envoyés"
          value={String(quotesWaiting)}
          sub="en attente de réponse"
        />
      </div>

      {/* Graphique mensuel */}
      <div className="rounded-xl border border-border/50 bg-card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-semibold text-sm">Revenus mensuels {now.getFullYear()}</h2>
          <span className="ml-auto text-xs text-muted-foreground">factures payées</span>
        </div>
        <div className="flex items-end gap-1.5 h-28">
          {monthlyRevenue.map((v, m) => {
            const pct = Math.round((v / maxMonthly) * 100)
            const isCurrent = m === currentMonth
            const isFuture = m > currentMonth
            return (
              <div key={m} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full flex items-end" style={{ height: "88px" }}>
                  <div
                    style={{ height: `${Math.max(pct, v > 0 ? 4 : 0)}%` }}
                    className={`w-full rounded-t transition-all ${
                      isFuture ? "bg-muted/40" :
                      isCurrent ? "bg-primary/80" :
                      "bg-primary/40"
                    }`}
                    title={`${MONTHS_FR[m]}: ${v.toLocaleString("fr-FR")} €`}
                  />
                </div>
                <span className={`text-[10px] ${isCurrent ? "text-primary font-medium" : "text-muted-foreground"}`}>
                  {MONTHS_FR[m]}
                </span>
              </div>
            )
          })}
        </div>
        <div className="text-xs text-muted-foreground text-right">
          Max: {maxMonthly > 1 ? maxMonthly.toLocaleString("fr-FR") + " €" : "—"}
        </div>
      </div>

      {/* Factures en retard — priorité */}
      {allPending.some((i) => i.status === "LATE") && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-red-500 flex items-center gap-1.5">
              <AlertCircle className="h-3.5 w-3.5" /> Factures en retard
            </h2>
          </div>
          <div className="rounded-xl border border-red-500/20 bg-red-500/5 overflow-hidden">
            {allPending.filter((i) => i.status === "LATE").map((inv) => (
              <Link
                key={inv.id}
                href={`/facturation/factures/${inv.id}`}
                className="flex items-center gap-3 px-4 py-2.5 border-b border-red-500/10 last:border-0 hover:bg-red-500/10 transition-colors text-sm"
              >
                <span className="font-mono text-xs text-muted-foreground w-24 shrink-0">{inv.number}</span>
                <span className="flex-1 text-muted-foreground">{inv.client.company ?? inv.client.name}</span>
                {inv.dueDate && (
                  <span className="text-xs text-red-500 shrink-0">
                    +{Math.ceil((Date.now() - new Date(inv.dueDate).getTime()) / 86400000)}j
                  </span>
                )}
                <span className="font-bold text-red-500 tabular-nums">
                  {(inv.totalHT - inv.depositDeducted).toLocaleString("fr-FR")} €
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Dernières factures */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Factures {now.getFullYear()}</h2>
          <Link href="/facturation/factures" className="text-xs text-primary hover:underline">Voir tout →</Link>
        </div>
        {recentInvoices.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune facture cette année</p>
        ) : (
          <div className="rounded-xl border border-border/50 bg-card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th className="px-4 py-2.5 text-left font-medium">Numéro</th>
                  <th className="px-4 py-2.5 text-left font-medium">Client</th>
                  <th className="px-4 py-2.5 text-left font-medium">Statut</th>
                  <th className="px-4 py-2.5 text-right font-medium">Montant HT</th>
                  <th className="px-4 py-2.5 text-left font-medium">Échéance</th>
                </tr>
              </thead>
              <tbody>
                {recentInvoices.map((inv) => (
                  <tr key={inv.id} className="border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-2.5">
                      <Link href={`/facturation/factures/${inv.id}`} className="text-primary hover:underline font-mono text-xs">{inv.number}</Link>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">
                      {inv.client.company ?? inv.client.name}
                    </td>
                    <td className="px-4 py-2.5">
                      <InvoiceStatusBadge status={inv.status} />
                    </td>
                    <td className="px-4 py-2.5 text-right font-medium">
                      {(inv.totalHT - inv.depositDeducted).toLocaleString("fr-FR")} €
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">
                      {inv.dueDate
                        ? new Date(inv.dueDate).toLocaleDateString("fr-FR")
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Devis récents */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Devis récents</h2>
          <Link href="/facturation/devis" className="text-xs text-primary hover:underline">Voir tout →</Link>
        </div>
        {quotes.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun devis</p>
        ) : (
          <div className="rounded-xl border border-border/50 bg-card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th className="px-4 py-2.5 text-left font-medium">Numéro</th>
                  <th className="px-4 py-2.5 text-left font-medium">Client</th>
                  <th className="px-4 py-2.5 text-left font-medium">Statut</th>
                  <th className="px-4 py-2.5 text-right font-medium">Total HT</th>
                </tr>
              </thead>
              <tbody>
                {quotes.map((q) => (
                  <tr key={q.id} className="border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-2.5">
                      <Link href={`/facturation/devis/${q.id}`} className="text-primary hover:underline font-mono text-xs">{q.number}</Link>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">
                      {q.client.company ?? q.client.name}
                    </td>
                    <td className="px-4 py-2.5">
                      <QuoteStatusBadge status={q.status} />
                    </td>
                    <td className="px-4 py-2.5 text-right font-medium">{q.totalHT.toLocaleString("fr-FR")} €</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function KPI({ icon, label, value, sub, alert }: { icon: React.ReactNode; label: string; value: string; sub: string; alert?: boolean }) {
  return (
    <div className={`rounded-xl border p-4 space-y-1 ${alert ? "border-red-500/20 bg-red-500/5" : "border-border/50 bg-card"}`}>
      <div className="flex items-center gap-2 text-muted-foreground text-xs">{icon}{label}</div>
      <p className={`text-xl font-bold ${alert ? "text-red-500" : ""}`}>{value}</p>
      <p className="text-xs text-muted-foreground">{sub}</p>
    </div>
  )
}

function QuoteStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    DRAFT: { label: "Brouillon", cls: "bg-muted text-muted-foreground" },
    VALIDATED: { label: "Validé", cls: "bg-violet-500/15 text-violet-600" },
    SENT: { label: "Envoyé", cls: "bg-blue-500/15 text-blue-600" },
    WAITING_DEPOSIT: { label: "Attente acompte", cls: "bg-amber-500/15 text-amber-600" },
    DEPOSIT_RECEIVED: { label: "Acompte reçu", cls: "bg-emerald-500/15 text-emerald-600" },
    ACCEPTED: { label: "Accepté", cls: "bg-emerald-500/15 text-emerald-600" },
    IN_PROGRESS: { label: "En cours", cls: "bg-indigo-500/15 text-indigo-600" },
    SIGNED: { label: "Signé", cls: "bg-teal-500/15 text-teal-600" },
    REJECTED: { label: "Refusé", cls: "bg-red-500/15 text-red-600" },
  }
  const { label, cls } = map[status] ?? { label: status, cls: "" }
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>{label}</span>
}

function InvoiceStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    DRAFT: { label: "Brouillon", cls: "bg-muted text-muted-foreground" },
    SENT: { label: "Envoyée", cls: "bg-blue-500/15 text-blue-600" },
    PAID: { label: "Payée", cls: "bg-emerald-500/15 text-emerald-600" },
    LATE: { label: "En retard", cls: "bg-red-500/15 text-red-600" },
  }
  const { label, cls } = map[status] ?? { label: status, cls: "" }
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>{label}</span>
}
