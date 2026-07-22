import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import Link from "next/link"
import { TrendingUp, Clock, AlertCircle, CheckCircle2, Settings } from "lucide-react"
import { markLateInvoices } from "@/actions/facturation"
import { MonthlyRevenueChart } from "@/components/modules/facturation/MonthlyRevenueChart"
import { FacturationQuickActions } from "@/components/modules/facturation/FacturationQuickActions"
import { AmountsPrivacyToggle } from "@/components/ui/amounts-privacy-toggle"

// Helpers d'affichage cohérents avec la liste des factures
const faNumber = (n: string) => (/^fa/i.test(n.trim()) ? n : `FA${n}`)
const fmtEur = (n: number) =>
  n.toLocaleString("fr-FR", { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 })
const fmtDay = (d: Date | string) => new Date(d).toLocaleDateString("fr-FR")
// Montant réglé d'une facture : somme des versements, sinon le net si soldée
const invoicePaid = (inv: { status: string; totalHT: number; depositDeducted: number; payments: { amount: number }[] }) => {
  const net = inv.totalHT - inv.depositDeducted
  return inv.payments.length ? inv.payments.reduce((s, p) => s + p.amount, 0) : inv.status === "PAID" ? net : 0
}

export default async function FacturationOverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ annee?: string }>
}) {
  const session = await auth()
  const userId = session!.user.id

  // Auto-marquer les factures en retard
  await markLateInvoices(userId)

  const now = new Date()
  const currentYear = now.getFullYear()

  // Filtre d'année piloté par l'URL (?annee=YYYY). Absent = toutes années.
  const sp = await searchParams
  const parsedYear = sp.annee ? parseInt(sp.annee, 10) : NaN
  const selectedYear = Number.isFinite(parsedYear) ? parsedYear : null
  const yearStart = selectedYear ? new Date(selectedYear, 0, 1) : undefined
  const yearEnd = selectedYear ? new Date(selectedYear, 11, 31, 23, 59, 59) : undefined

  const [scopedInvoices, allPaidInvoices, allPending, quotes, emitters, quickClients, quickCompanies, quickProjects] = await Promise.all([
    // Factures affichées : par date d'ÉMISSION (issuedAt), pas createdAt (qui
    // vaut la date d'insertion en base). Toutes années par défaut, sinon
    // bornées à l'année sélectionnée.
    prisma.invoice.findMany({
      where: {
        userId,
        issuedAt: selectedYear ? { gte: yearStart, lte: yearEnd } : { not: null },
      },
      include: {
        client: { select: { name: true, company: true } },
        payments: { select: { amount: true } },
      },
      orderBy: { issuedAt: "desc" },
    }),
    // Toutes les factures encaissées (par date de PAIEMENT) : sert au KPI
    // « Encaissé » (filtré par année en JS) et au graphe mensuel.
    prisma.invoice.findMany({
      where: { userId, status: "PAID", paidAt: { not: null } },
      select: { paidAt: true, totalHT: true, depositDeducted: true },
    }),
    prisma.invoice.findMany({
      where: { userId, status: { in: ["SENT", "LATE"] } },
      include: {
        client: { select: { name: true, company: true } },
        payments: { select: { amount: true } },
      },
      orderBy: { dueDate: "asc" },
    }),
    prisma.quote.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { client: { select: { name: true, company: true } } },
    }),
    // Complétude « facturable » : elle vit sur les émetteurs (raison sociale,
    // SIRET, adresse), pas sur le UserProfile — c'est l'émetteur qui alimente
    // les factures et devis.
    prisma.emitterProfile.findMany({ where: { userId }, select: { companyName: true, siret: true, address: true } }),
    prisma.client.findMany({
      where: { userId, type: { not: "SELF" } },
      orderBy: { name: "asc" },
      select: { id: true, name: true, company: true, type: true, companyId: true },
    }),
    prisma.company.findMany({
      where: { userId },
      orderBy: { name: "asc" },
      select: { id: true, name: true, city: true },
    }),
    prisma.project.findMany({
      where: { userId },
      orderBy: { name: "asc" },
      select: { id: true, name: true, clientId: true, companyId: true },
    }),
  ])

  // Encaissé sur le périmètre choisi (toutes années, ou l'année sélectionnée)
  const paidInScope = allPaidInvoices.filter(
    (i) => !selectedYear || (i.paidAt != null && new Date(i.paidAt).getFullYear() === selectedYear)
  )
  const paidThisYear = paidInScope.reduce((s, i) => s + i.totalHT - i.depositDeducted, 0)

  const totalPending = allPending
    .filter((i) => i.status === "SENT")
    .reduce((s, i) => s + i.totalHT - i.depositDeducted, 0)

  const totalLate = allPending
    .filter((i) => i.status === "LATE")
    .reduce((s, i) => s + i.totalHT - i.depositDeducted, 0)

  const quotesWaiting = quotes.filter((q) => q.status === "SENT").length
  // Incomplet seulement si aucun émetteur n'a raison sociale + SIRET + adresse
  const profileIncomplete = !emitters.some((e) => e.companyName && e.siret && e.address)

  // Revenus mensuels du graphe : toujours l'année civile courante (le graphe a
  // sa propre navigation d'année, indépendante du filtre de la page).
  const monthlyRevenue = Array.from({ length: 12 }, (_, m) =>
    allPaidInvoices
      .filter((i) => i.paidAt && new Date(i.paidAt).getFullYear() === currentYear && new Date(i.paidAt).getMonth() === m)
      .reduce((s, i) => s + i.totalHT - i.depositDeducted, 0)
  )

  const currentMonth = now.getMonth()
  const recentInvoices = scopedInvoices

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <h1 className="sm:hidden text-2xl font-bold tracking-tight">Facturation</h1>
          <p className="text-sm text-muted-foreground">
            {"Vue d'ensemble"} {selectedYear ? `— ${selectedYear}` : "— toutes années"}
          </p>
          {/* Sélecteur de période : toutes années par défaut, ou une année */}
          <div className="inline-flex rounded-lg border border-border overflow-hidden text-xs">
            <YearTab label="Tout" href="/facturation" active={!selectedYear} />
            <YearTab label={String(currentYear)} href={`/facturation?annee=${currentYear}`} active={selectedYear === currentYear} />
            <YearTab label={String(currentYear - 1)} href={`/facturation?annee=${currentYear - 1}`} active={selectedYear === currentYear - 1} />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <AmountsPrivacyToggle />
          <FacturationQuickActions
            userId={userId}
            clients={quickClients}
            companies={quickCompanies}
            projects={quickProjects}
          />
        </div>
      </div>

      {/* Profil incomplet */}
      {profileIncomplete && (
        <div className="flex items-center gap-3 rounded-xl border border-amber-500/20 bg-amber-500/8 px-4 py-3 text-sm">
          <Settings className="h-4 w-4 text-amber-500 shrink-0" />
          <span className="text-amber-700 dark:text-amber-400 flex-1">
            Aucun émetteur complet (raison sociale, SIRET, adresse) — ces informations manqueront sur vos factures et devis.
          </span>
          <Link href="/settings" className="text-amber-700 dark:text-amber-400 font-medium hover:underline shrink-0">
            Configurer un émetteur →
          </Link>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KPI
          icon={<CheckCircle2 className="h-4 w-4 text-emerald-500" />}
          label="Encaissé"
          value={`${fmtEur(paidThisYear)} €`}
          sub={selectedYear ? `en ${selectedYear}` : "toutes années"}
          sensitive
        />
        <KPI
          icon={<Clock className="h-4 w-4 text-blue-500" />}
          label="En attente"
          value={`${totalPending.toLocaleString("fr-FR")} €`}
          sub={`${allPending.filter((i) => i.status === "SENT").length} facture(s) envoyée(s)`}
          sensitive
        />
        <KPI
          icon={<AlertCircle className="h-4 w-4 text-red-500" />}
          label="En retard"
          value={`${totalLate.toLocaleString("fr-FR")} €`}
          sub={`${allPending.filter((i) => i.status === "LATE").length} facture(s)`}
          alert={totalLate > 0}
          sensitive
        />
        <KPI
          icon={<TrendingUp className="h-4 w-4 text-amber-500" />}
          label="Devis envoyés"
          value={String(quotesWaiting)}
          sub="en attente de réponse"
        />
      </div>

      {/* Graphique mensuel */}
      <MonthlyRevenueChart
        initialData={monthlyRevenue}
        currentYear={now.getFullYear()}
        currentMonth={currentMonth}
      />

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
                <span className="font-mono text-xs text-muted-foreground w-24 shrink-0">{faNumber(inv.number)}</span>
                <span className="flex-1 text-muted-foreground">{inv.client.company ?? inv.client.name}</span>
                {inv.dueDate && (
                  <span className="text-xs text-red-500 shrink-0">
                    {/* eslint-disable-next-line react-hooks/purity */}
                    +{Math.ceil((Date.now() - new Date(inv.dueDate).getTime()) / 86400000)}j
                  </span>
                )}
                <span className="font-bold text-red-500 tabular-nums whitespace-nowrap">
                  {fmtEur(invoicePaid(inv))} / {fmtEur(inv.totalHT - inv.depositDeducted)} €
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Dernières factures */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
            {selectedYear ? `Factures ${selectedYear}` : "Dernières factures"}
          </h2>
          <Link href={selectedYear ? `/facturation/factures?annee=${selectedYear}` : "/facturation/factures"} className="text-xs text-primary hover:underline">Voir tout →</Link>
        </div>
        {recentInvoices.length === 0 ? (
          <p className="text-sm text-muted-foreground">{selectedYear ? `Aucune facture émise en ${selectedYear}` : "Aucune facture"}</p>
        ) : (
          <div className="rounded-xl border border-border/50 bg-card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th className="px-4 py-2.5 text-left font-medium">Numéro</th>
                  <th className="px-4 py-2.5 text-left font-medium">Client</th>
                  <th className="px-4 py-2.5 text-left font-medium">Statut</th>
                  <th className="px-4 py-2.5 text-right font-medium">Montant HT</th>
                  <th className="px-4 py-2.5 text-left font-medium">Payé</th>
                  <th className="px-4 py-2.5 text-left font-medium hidden sm:table-cell">Émise le</th>
                  <th className="px-4 py-2.5 text-left font-medium hidden md:table-cell">Échéance</th>
                </tr>
              </thead>
              <tbody>
                {recentInvoices.map((inv) => (
                  <tr key={inv.id} className="border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-2.5">
                      <Link href={`/facturation/factures/${inv.id}`} className="text-primary hover:underline font-mono text-xs">{faNumber(inv.number)}</Link>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">
                      {inv.client.company ?? inv.client.name}
                    </td>
                    <td className="px-4 py-2.5">
                      <InvoiceStatusBadge status={inv.status} />
                    </td>
                    <td className="px-4 py-2.5 text-right font-medium">
                      {fmtEur(inv.totalHT - inv.depositDeducted)} €
                    </td>
                    <td className="px-4 py-2.5 text-xs whitespace-nowrap">
                      {(() => {
                        const net = inv.totalHT - inv.depositDeducted
                        const paid = invoicePaid(inv)
                        const full = inv.status === "PAID" || (paid > 0 && paid >= net - 0.01)
                        return (
                          <span className={`font-medium ${paid <= 0 ? "text-muted-foreground/50" : full ? "text-emerald-600" : "text-amber-600"}`}>
                            {fmtEur(paid)} <span className="font-normal text-muted-foreground/70">/ {fmtEur(net)} €</span>
                          </span>
                        )
                      })()}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground hidden sm:table-cell">
                      {inv.issuedAt ? fmtDay(inv.issuedAt) : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground hidden md:table-cell">
                      {inv.dueDate ? fmtDay(inv.dueDate) : "—"}
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
          <div className="rounded-xl border border-border/50 bg-card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th className="px-4 py-2.5 text-left font-medium">Numéro</th>
                  <th className="px-4 py-2.5 text-left font-medium">Client</th>
                  <th className="px-4 py-2.5 text-left font-medium">Statut</th>
                  <th className="px-4 py-2.5 text-right font-medium">Total HT</th>
                  <th className="px-4 py-2.5 text-left font-medium hidden sm:table-cell">Envoyé le</th>
                  <th className="px-4 py-2.5 text-left font-medium hidden md:table-cell">Échéance</th>
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
                    <td className="px-4 py-2.5 text-right font-medium">{fmtEur(q.totalHT)} €</td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground hidden sm:table-cell">
                      {q.sentAt ? fmtDay(q.sentAt) : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground hidden md:table-cell">
                      {q.expiresAt ? fmtDay(q.expiresAt) : "—"}
                    </td>
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

function YearTab({ label, href, active }: { label: string; href: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={`px-3 py-1.5 border-r last:border-r-0 border-border transition-colors ${
        active ? "bg-accent font-medium text-foreground" : "text-muted-foreground hover:bg-muted/50"
      }`}
    >
      {label}
    </Link>
  )
}

function KPI({ icon, label, value, sub, alert, sensitive }: { icon: React.ReactNode; label: string; value: string; sub: string; alert?: boolean; sensitive?: boolean }) {
  return (
    <div className={`rounded-xl border p-4 space-y-1 ${alert ? "border-red-500/20 bg-red-500/5" : "border-border/50 bg-card"}`}>
      <div className="flex items-center gap-2 text-muted-foreground text-xs">{icon}{label}</div>
      <p className={`text-xl font-bold ${alert ? "text-red-500" : ""} ${sensitive ? "amount-sensitive" : ""}`}>{value}</p>
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
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${cls}`}>{label}</span>
}

function InvoiceStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    DRAFT: { label: "Brouillon", cls: "bg-muted text-muted-foreground" },
    SENT: { label: "Envoyée", cls: "bg-blue-500/15 text-blue-600" },
    PAID: { label: "Payée", cls: "bg-emerald-500/15 text-emerald-600" },
    LATE: { label: "En retard", cls: "bg-red-500/15 text-red-600" },
  }
  const { label, cls } = map[status] ?? { label: status, cls: "" }
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${cls}`}>{label}</span>
}
