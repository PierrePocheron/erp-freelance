import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import Link from "next/link"
import { TrendingUp, Clock, AlertCircle, CheckCircle2 } from "lucide-react"

export default async function FacturationOverviewPage() {
  const session = await auth()
  const userId = session!.user.id

  const [quotes, invoices] = await Promise.all([
    prisma.quote.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { client: { select: { name: true, company: true } } },
    }),
    prisma.invoice.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: { client: { select: { name: true, company: true } } },
    }),
  ])

  const totalPaid = invoices.filter((i) => i.status === "PAID").reduce((s, i) => s + i.totalHT - i.depositDeducted, 0)
  const totalPending = invoices.filter((i) => i.status === "SENT").reduce((s, i) => s + i.totalHT - i.depositDeducted, 0)
  const totalLate = invoices.filter((i) => i.status === "LATE").reduce((s, i) => s + i.totalHT - i.depositDeducted, 0)
  const quotesWaiting = quotes.filter((q) => q.status === "SENT").length

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Facturation</h1>
        <p className="text-sm text-muted-foreground">Vue d'ensemble de votre activité financière</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KPI
          icon={<CheckCircle2 className="h-4 w-4 text-emerald-500" />}
          label="Encaissé"
          value={`${totalPaid.toLocaleString("fr-FR")} €`}
          sub="cette année"
        />
        <KPI
          icon={<Clock className="h-4 w-4 text-blue-500" />}
          label="En attente"
          value={`${totalPending.toLocaleString("fr-FR")} €`}
          sub={`${invoices.filter((i) => i.status === "SENT").length} facture(s)`}
        />
        <KPI
          icon={<AlertCircle className="h-4 w-4 text-red-500" />}
          label="En retard"
          value={`${totalLate.toLocaleString("fr-FR")} €`}
          sub={`${invoices.filter((i) => i.status === "LATE").length} facture(s)`}
        />
        <KPI
          icon={<TrendingUp className="h-4 w-4 text-amber-500" />}
          label="Devis envoyés"
          value={String(quotesWaiting)}
          sub="en attente de réponse"
        />
      </div>

      {/* Dernières factures */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Dernières factures</h2>
          <Link href="/facturation/factures" className="text-xs text-primary hover:underline">Voir tout →</Link>
        </div>
        {invoices.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune facture</p>
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
                {invoices.slice(0, 8).map((inv) => (
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

function KPI({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub: string }) {
  return (
    <div className="rounded-xl border border-border/50 bg-card p-4 space-y-1">
      <div className="flex items-center gap-2 text-muted-foreground text-xs">{icon}{label}</div>
      <p className="text-xl font-bold">{value}</p>
      <p className="text-xs text-muted-foreground">{sub}</p>
    </div>
  )
}

function QuoteStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    DRAFT: { label: "Brouillon", cls: "bg-muted text-muted-foreground" },
    SENT: { label: "Envoyé", cls: "bg-blue-500/15 text-blue-600" },
    ACCEPTED: { label: "Accepté", cls: "bg-emerald-500/15 text-emerald-600" },
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
