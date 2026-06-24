import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import Link from "next/link"
import {
  CheckSquare, AlertCircle, Clock, Users,
  TrendingUp, Bell, Code2, Calendar, Circle,
  AlertTriangle, Globe, UserMinus, Wallet, Receipt, Target,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { QuickActionsBar } from "@/components/modules/dashboard/QuickActionsBar"
import { ProdMonitorCard } from "@/components/modules/dashboard/ProdMonitorCard"
import { PendingIncomeCard } from "@/components/modules/dashboard/PendingIncomeCard"
import { JobHuntCard } from "@/components/modules/dashboard/JobHuntCard"

export default async function DashboardPage() {
  const session = await auth()
  const userId = session!.user.id
  const firstName = session?.user?.name?.split(" ")[0] ?? "vous"

  /* eslint-disable react-hooks/purity */
  const today = new Date()
  const todayStart = new Date(today.setHours(0, 0, 0, 0))
  const todayEnd = new Date(today.setHours(23, 59, 59, 999))
  const in30Days = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
  const followUpCutoff = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000)
  /* eslint-enable react-hooks/purity */
  const currentYear = new Date().getFullYear()
  const yearStart = new Date(currentYear, 0, 1)
  const yearEnd   = new Date(currentYear, 11, 31, 23, 59, 59)
  const yearPrefix = `${currentYear}-`

  const [
    tasksDueToday,
    tasksInProgress,
    upcomingReminders,
    unpaidInvoices,
    lateInvoices,
    activeProjects,
    pendingQuotes,
    recentInteractions,
    upcomingMilestones,
    quickClients,
    quickProjects,
    quickProducts,
    quickQuotes,
    userProfile,
    prodSites,
    overdueTasks,
    upcomingRenewals,
    followUpCandidates,
    quickCompanies,
    quickContacts,
    paidInvoicesYTD,
    receivedRevenuesYTD,
    dashboardProspects,
    pendingRevenues,
    pendingReimbursements,
    dashboardJobApps,
  ] = await Promise.all([
    prisma.task.findMany({
      where: {
        OR: [{ project: { userId } }, { userId }],
        dueDate: { gte: todayStart, lte: todayEnd },
        status: { not: "DONE" },
        parentTaskId: null,
      },
      include: {
        project: { select: { id: true, name: true } },
        client:  { select: { id: true, name: true, company: true } },
      },
      orderBy: { dueDate: "asc" },
      take: 5,
    }),
    prisma.task.findMany({
      where: {
        OR: [{ project: { userId } }, { userId }],
        status: "IN_PROGRESS",
        parentTaskId: null,
      },
      include: {
        project: { select: { id: true, name: true } },
        client:  { select: { id: true, name: true, company: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: 5,
    }),
    prisma.reminder.findMany({
      where: {
        client: { userId },
        isDone: false,
        // eslint-disable-next-line react-hooks/purity
        dueDate: { lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
      },
      include: { client: { select: { id: true, name: true } } },
      orderBy: { dueDate: "asc" },
      take: 5,
    }),
    prisma.invoice.findMany({
      where: { userId, status: "SENT" },
      include: { client: { select: { name: true, company: true } } },
      orderBy: { dueDate: "asc" },
      take: 5,
    }),
    prisma.invoice.count({ where: { userId, status: "LATE" } }),
    prisma.project.count({ where: { userId, status: "ACTIVE" } }),
    prisma.quote.count({ where: { userId, status: "SENT" } }),
    prisma.interaction.findMany({
      where: { client: { userId } },
      orderBy: { date: "desc" },
      take: 3,
      include: { client: { select: { id: true, name: true } } },
    }),
    prisma.milestone.findMany({
      where: {
        project: { userId },
        status: { not: "DONE" },
        date: { gte: new Date() },
      },
      include: { project: { select: { id: true, name: true } } },
      orderBy: { date: "asc" },
      take: 5,
    }),
    prisma.client.findMany({
      where: { userId, type: { not: "SELF" } },
      select: { id: true, name: true, company: true, type: true, companyId: true },
      orderBy: { name: "asc" },
    }),
    prisma.project.findMany({
      where: { userId, status: "ACTIVE" },
      select: { id: true, name: true, clientId: true, companyId: true },
      orderBy: { name: "asc" },
    }),
    prisma.product.findMany({
      where: { userId, isActive: true },
      orderBy: { name: "asc" },
    }) as unknown as Array<{ id: string; name: string; description: string | null; unitPrice: number; unit: string; isActive: boolean; billingType: string; defaultTaxRate: number }>,
    prisma.quote.findMany({
      where: { userId, status: { notIn: ["DRAFT", "REJECTED"] } },
      select: {
        id: true, number: true, clientId: true, projectId: true,
        totalHT: true, depositPercent: true, status: true,
        client: { select: { name: true, company: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.userProfile.findUnique({ where: { userId } }),
    prisma.postDev.findMany({
      where: { project: { userId }, prodUrl: { not: null } },
      select: {
        id: true,
        prodUrl: true,
        project: { select: { id: true, name: true } },
        monitoringChecks: {
          orderBy: { checkedAt: "desc" },
          take: 1,
          select: { isUp: true, statusCode: true, checkedAt: true },
        },
      },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.task.findMany({
      where: {
        OR: [{ project: { userId } }, { userId }],
        dueDate: { lt: todayStart },
        status: { not: "DONE" },
        parentTaskId: null,
      },
      include: {
        project: { select: { id: true, name: true } },
        client:  { select: { id: true, name: true, company: true } },
      },
      orderBy: { dueDate: "asc" },
      take: 6,
    }),
    prisma.renewal.findMany({
      where: { postDev: { project: { userId } }, expiresAt: { lte: in30Days } },
      include: { postDev: { select: { project: { select: { id: true, name: true } } } } },
      orderBy: { expiresAt: "asc" },
      take: 6,
    }),
    prisma.client.findMany({
      where: { userId, type: { not: "SELF" } },
      select: {
        id: true,
        name: true,
        company: true,
        createdAt: true,
        interactions: { orderBy: { date: "desc" }, take: 1, select: { date: true } },
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
    // Factures AE payées cette année (paidAt ou updatedAt dans l'année)
    prisma.invoice.findMany({
      where: { userId, status: "PAID", paidAt: { gte: yearStart, lte: yearEnd } },
      select: { totalHT: true, depositDeducted: true },
    }),
    // Revenus hors-AE reçus cette année (par période)
    prisma.revenue.findMany({
      where: { userId, status: "RECEIVED", period: { startsWith: yearPrefix } },
      select: { amount: true },
    }),
    // Prospects pour le widget pipeline dashboard
    prisma.client.findMany({
      where: { userId, type: "PROSPECT" },
      orderBy: [{ temperature: "desc" }, { updatedAt: "desc" }],
      select: {
        id: true,
        name: true,
        company: true,
        temperature: true,
        prospectStage: true,
        interactions: { orderBy: { date: "desc" }, take: 1, select: { date: true } },
      },
    }),
    // Revenus en attente de réception
    prisma.revenue.findMany({
      where: { userId, status: "PENDING" },
      orderBy: [{ expectedAt: "asc" }, { createdAt: "desc" }],
      select: { id: true, label: true, amount: true, expectedAt: true },
    }),
    // Remboursements santé en attente
    prisma.healthReimbursement.findMany({
      where: { userId, status: "PENDING" },
      orderBy: [{ expectedDate: "asc" }, { createdAt: "desc" }],
      select: {
        id: true, amount: true, source: true, expectedDate: true, notes: true,
        consultation: { select: { practitionerName: true, title: true } },
      },
    }),
    // Candidatures actives (module entretien)
    prisma.jobApplication.findMany({
      where: { userId, status: { notIn: ["ACCEPTED", "REJECTED", "WITHDRAWN", "GHOSTED"] } },
      orderBy: [{ nextActionAt: "asc" }, { updatedAt: "desc" }],
      select: {
        id: true, companyName: true, position: true, status: true,
        nextActionAt: true, nextActionLabel: true,
      },
    }),
  ])

  const totalPending   = unpaidInvoices.reduce((s, i) => s + i.totalHT - i.depositDeducted, 0)
  const encaisseAE     = paidInvoicesYTD.reduce((s, i) => s + i.totalHT - i.depositDeducted, 0)
  const encaisseAutres = receivedRevenuesYTD.reduce((s, r) => s + r.amount, 0)
  const encaisseTotal  = encaisseAE + encaisseAutres

  // ── Encaissements en attente (factures + revenus + remboursements santé) ──────
  const pendingInvoiceItems = unpaidInvoices.map((inv) => ({
    id: inv.id,
    number: inv.number,
    clientName: inv.client.company ?? inv.client.name,
    amount: inv.totalHT - inv.depositDeducted,
    dueDate: inv.dueDate ? inv.dueDate.toISOString() : null,
    isLate: !!inv.dueDate && new Date(inv.dueDate) < new Date(),
  }))
  const pendingRevenueItems = pendingRevenues.map((r) => ({
    id: r.id,
    label: r.label,
    amount: r.amount,
    expectedAt: r.expectedAt ? r.expectedAt.toISOString() : null,
  }))
  const pendingReimbursementItems = pendingReimbursements.map((r) => ({
    id: r.id,
    label: r.consultation
      ? `${r.consultation.practitionerName}${r.consultation.title ? ` — ${r.consultation.title}` : ""}`
      : (r.notes ?? "Remboursement"),
    amount: r.amount,
    source: r.source,
    expectedDate: r.expectedDate ? r.expectedDate.toISOString() : null,
  }))

  // ── Entretiens (candidatures actives) ─────────────────────────────────────────
  const jobAppItems = dashboardJobApps.map((a) => ({
    id: a.id,
    companyName: a.companyName,
    position: a.position,
    status: a.status,
    nextActionAt: a.nextActionAt ? a.nextActionAt.toISOString() : null,
    nextActionLabel: a.nextActionLabel,
  }))

  // Prods : aplatit le dernier check pour la carte de monitoring.
  const prods = prodSites.map((pd) => ({
    id: pd.id,
    projectId: pd.project.id,
    name: pd.project.name,
    url: pd.prodUrl!,
    isUp: pd.monitoringChecks[0]?.isUp ?? null,
    statusCode: pd.monitoringChecks[0]?.statusCode ?? null,
    checkedAt: pd.monitoringChecks[0]?.checkedAt ?? null,
  }))

  // Pipeline prospects
  const PIPELINE_ACTIVE_STAGES = ["IDENTIFIED", "CONTACTED", "NO_RESPONSE", "REPLIED", "MEETING", "PROPOSAL_SENT", "NEGOTIATION"]
  const prospectsActive = dashboardProspects.filter((p) => PIPELINE_ACTIVE_STAGES.includes(p.prospectStage))
  const prospectsHot    = dashboardProspects.filter((p) => p.temperature === "HOT" && PIPELINE_ACTIVE_STAGES.includes(p.prospectStage))
  // eslint-disable-next-line react-hooks/purity
  const prospectStale30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  const prospectsStale  = prospectsActive.filter((p) => {
    const last = p.interactions[0]?.date ?? null
    return !last || new Date(last) < prospectStale30
  })
  // Comptage par étape (seulement les étapes non-nulles)
  const prospectByStage: Record<string, number> = {}
  for (const p of prospectsActive) {
    prospectByStage[p.prospectStage] = (prospectByStage[p.prospectStage] ?? 0) + 1
  }

  // Clients à relancer : dernier contact (interaction ou création) plus vieux que 45 j.
  const followUpClients = followUpCandidates
    .map((c) => ({
      id: c.id,
      name: c.name,
      company: c.company,
      lastTouch: c.interactions[0]?.date ?? c.createdAt,
    }))
    .filter((c) => c.lastTouch < followUpCutoff)
    .sort((a, b) => a.lastTouch.getTime() - b.lastTouch.getTime())
    .slice(0, 5)

  const hour = new Date().getHours()
  const greeting = hour < 12 ? "Bonjour" : hour < 18 ? "Bonjour" : "Bonsoir"

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{greeting}, {firstName} 👋</h1>
        <p className="text-muted-foreground text-sm">
          {new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
        </p>
      </div>

      {/* Raccourcis */}
      <QuickActionsBar userId={userId} clients={quickClients} companies={quickCompanies} contacts={quickContacts} projects={quickProjects} products={quickProducts} quotes={quickQuotes} defaultConditions={userProfile?.defaultConditions ?? ""} />

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <KPICard href="/projets" icon={<Code2 className="h-4 w-4" />} label="Projets actifs" value={activeProjects} color="indigo" />
        <KPICard href="/facturation/factures" icon={<TrendingUp className="h-4 w-4" />} label="En attente" value={`${totalPending.toLocaleString("fr-FR")} €`} color="blue" />
        <KPICard href="/facturation/factures" icon={<AlertCircle className="h-4 w-4" />} label="En retard" value={lateInvoices} color={lateInvoices > 0 ? "red" : "muted"} />
        <KPICard href="/facturation/devis" icon={<Clock className="h-4 w-4" />} label="Devis envoyés" value={pendingQuotes} color="amber" />
        <KPICard href="/contacts" icon={<Bell className="h-4 w-4" />} label="Rappels" value={upcomingReminders.length} color={upcomingReminders.some(r => new Date(r.dueDate) < new Date()) ? "red" : "muted"} />
        <KPICard href="/projets" icon={<CheckSquare className="h-4 w-4" />} label="En cours" value={tasksInProgress.length} color="emerald" />
      </div>

      {/* Revenus encaissés {year} */}
      <div className="rounded-xl border border-border/50 bg-card px-5 py-4">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
          Revenus encaissés — {currentYear}
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Link href="/facturation/factures" className="group space-y-0.5">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground group-hover:text-foreground transition-colors">
              <Receipt className="h-3.5 w-3.5 text-violet-500" />
              Auto-entreprise
            </div>
            <p className="text-lg font-bold tabular-nums text-violet-600">
              {encaisseAE.toLocaleString("fr-FR")} €
            </p>
          </Link>
          <Link href="/revenus" className="group space-y-0.5">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground group-hover:text-foreground transition-colors">
              <Wallet className="h-3.5 w-3.5 text-teal-500" />
              Autres revenus
            </div>
            <p className="text-lg font-bold tabular-nums text-teal-600">
              {encaisseAutres.toLocaleString("fr-FR")} €
            </p>
          </Link>
          <div className="space-y-0.5 border-l border-border/50 pl-4">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
              Total
            </div>
            <p className="text-lg font-bold tabular-nums text-emerald-600">
              {encaisseTotal.toLocaleString("fr-FR")} €
            </p>
          </div>
        </div>
      </div>

      {/* Encaissements en attente — factures, revenus, remboursements santé */}
      <PendingIncomeCard
        invoices={pendingInvoiceItems}
        revenues={pendingRevenueItems}
        reimbursements={pendingReimbursementItems}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Colonne principale */}
        <div className="lg:col-span-2 space-y-6">

          {/* Tâches en retard */}
          {overdueTasks.length > 0 && (
            <Section title="Tâches en retard" icon={<AlertTriangle className="h-4 w-4" />} href="/taches">
              <div className="space-y-1.5">
                {overdueTasks.map((task) => {
                  const href = task.project ? `/projets/${task.project.id}/dev` : "/taches"
                  const sub  = task.project?.name ?? task.client?.company ?? task.client?.name ?? "Tâche"
                  return (
                    <div key={task.id} className="flex items-center gap-2 rounded-lg px-3 py-2 hover:bg-muted/50 transition-colors group">
                      <form action={async () => {
                        "use server"
                        const { completeTaskGlobal } = await import("@/actions/projet")
                        await completeTaskGlobal(task.id)
                      }}>
                        <button type="submit" title="Marquer terminée" className="shrink-0 text-muted-foreground hover:text-emerald-500 transition-colors">
                          <Circle className="h-3.5 w-3.5" />
                        </button>
                      </form>
                      <Link href={href} className="flex-1 min-w-0 flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{task.title}</p>
                          <p className="text-xs text-muted-foreground">{sub}</p>
                        </div>
                        <span className="text-xs text-red-500 font-medium shrink-0">
                          {new Date(task.dueDate!).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                        </span>
                      </Link>
                    </div>
                  )
                })}
              </div>
            </Section>
          )}

          {/* Tâches en cours */}
          {tasksInProgress.length > 0 && (
            <Section title="Tâches en cours" icon={<CheckSquare className="h-4 w-4" />} href="/taches">
              <div className="space-y-1.5">
                {tasksInProgress.map((task) => {
                  const href = task.project ? `/projets/${task.project.id}/dev` : "/taches"
                  const sub  = task.project?.name ?? task.client?.company ?? task.client?.name ?? "Tâche"
                  return (
                    <div key={task.id} className="flex items-center gap-2 rounded-lg px-3 py-2 hover:bg-muted/50 transition-colors group">
                      <form action={async () => {
                        "use server"
                        const { completeTaskGlobal } = await import("@/actions/projet")
                        await completeTaskGlobal(task.id)
                      }}>
                        <button type="submit" title="Marquer terminée" className="shrink-0 text-muted-foreground hover:text-emerald-500 transition-colors">
                          <Circle className="h-3.5 w-3.5" />
                        </button>
                      </form>
                      <Link href={href} className="flex-1 min-w-0 flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{task.title}</p>
                          <p className="text-xs text-muted-foreground">{sub}</p>
                        </div>
                        {task.dueDate && (
                          <span className={`text-xs shrink-0 ${new Date(task.dueDate) < new Date() ? "text-red-500 font-medium" : "text-muted-foreground"}`}>
                            {new Date(task.dueDate).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                          </span>
                        )}
                      </Link>
                    </div>
                  )
                })}
              </div>
            </Section>
          )}

          {/* Tâches dues aujourd'hui */}
          {tasksDueToday.length > 0 && (
            <Section title="Échéances aujourd'hui" icon={<Calendar className="h-4 w-4" />} href="/taches">
              <div className="space-y-1.5">
                {tasksDueToday.map((task) => {
                  const href = task.project ? `/projets/${task.project.id}/dev` : "/taches"
                  const sub  = task.project?.name ?? task.client?.company ?? task.client?.name ?? "Tâche"
                  return (
                    <div key={task.id} className="flex items-center gap-2 rounded-lg px-3 py-2 hover:bg-muted/50 transition-colors group">
                      <form action={async () => {
                        "use server"
                        const { completeTaskGlobal } = await import("@/actions/projet")
                        await completeTaskGlobal(task.id)
                      }}>
                        <button type="submit" title="Marquer terminée" className="shrink-0 text-muted-foreground hover:text-emerald-500 transition-colors">
                          <Circle className="h-3.5 w-3.5" />
                        </button>
                      </form>
                      <Link href={href} className="flex-1 min-w-0 flex items-center gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{task.title}</p>
                          <p className="text-xs text-muted-foreground">{sub}</p>
                        </div>
                      </Link>
                    </div>
                  )
                })}
              </div>
            </Section>
          )}

          {/* Factures impayées */}
          {unpaidInvoices.length > 0 && (
            <Section title="Factures en attente" icon={<TrendingUp className="h-4 w-4" />} href="/facturation/factures">
              <div className="space-y-1.5">
                {unpaidInvoices.map((inv) => {
                  const isLate = inv.dueDate && new Date(inv.dueDate) < new Date()
                  return (
                    <Link key={inv.id} href={`/facturation/factures/${inv.id}`} className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-muted/50 transition-colors">
                      <span className={`h-2 w-2 rounded-full shrink-0 ${isLate ? "bg-red-500" : "bg-blue-500"}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium font-mono">{inv.number}</p>
                        <p className="text-xs text-muted-foreground">{inv.client.company ?? inv.client.name}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className={`text-sm font-bold ${isLate ? "text-red-500" : ""}`}>
                          {(inv.totalHT - inv.depositDeducted).toLocaleString("fr-FR")} €
                        </p>
                        {inv.dueDate && (
                          <p className={`text-xs ${isLate ? "text-red-500" : "text-muted-foreground"}`}>
                            {isLate ? "En retard · " : ""}
                            {new Date(inv.dueDate).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                          </p>
                        )}
                      </div>
                    </Link>
                  )
                })}
              </div>
            </Section>
          )}

          {/* Jalons à venir */}
          {upcomingMilestones.length > 0 && (
            <Section title="Jalons à venir" icon={<Calendar className="h-4 w-4" />} href="/projets">
              <div className="space-y-1.5">
                {upcomingMilestones.map((m) => (
                  <Link key={m.id} href={`/projets/${m.project.id}/dev`} className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-muted/50 transition-colors">
                    <span className="h-2 w-2 rounded-full bg-indigo-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{m.name}</p>
                      <p className="text-xs text-muted-foreground">{m.project.name}</p>
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {new Date(m.date).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                    </span>
                  </Link>
                ))}
              </div>
            </Section>
          )}

          {/* Renouvellements imminents */}
          {upcomingRenewals.length > 0 && (
            <Section title="Renouvellements imminents" icon={<Globe className="h-4 w-4" />} href="/projets">
              <div className="space-y-1.5">
                {upcomingRenewals.map((r) => {
                  const isExpired = new Date(r.expiresAt) < new Date()
                  return (
                    <Link key={r.id} href={`/projets/${r.postDev.project.id}/post-dev`} className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-muted/50 transition-colors">
                      <span className={`h-2 w-2 rounded-full shrink-0 ${isExpired ? "bg-red-500" : "bg-amber-500"}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{r.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{r.postDev.project.name}</p>
                      </div>
                      <span className={`text-xs shrink-0 ${isExpired ? "text-red-500 font-medium" : "text-amber-600"}`}>
                        {isExpired ? "Expiré · " : ""}
                        {new Date(r.expiresAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}
                      </span>
                    </Link>
                  )
                })}
              </div>
            </Section>
          )}
        </div>

        {/* Colonne secondaire */}
        <div className="space-y-6">
          {/* Monitoring des prods */}
          <ProdMonitorCard prods={prods} />

          {/* Entretiens — candidatures actives */}
          <JobHuntCard applications={jobAppItems} activeCount={jobAppItems.length} />

          {/* Pipeline Prospects */}
          {dashboardProspects.length > 0 && (
            <div className="rounded-xl border border-border/50 bg-card overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <span className="text-muted-foreground"><Target className="h-4 w-4" /></span>
                  Prospection
                </div>
                <Link href="/contacts/prospects" className="text-xs text-primary hover:underline">Voir tout →</Link>
              </div>
              <div className="p-3 space-y-3">
                {/* Stats row */}
                <div className="grid grid-cols-3 gap-2">
                  <Link href="/contacts/prospects" className="rounded-lg bg-muted/40 px-2 py-2 text-center hover:bg-muted/70 transition-colors">
                    <p className="text-lg font-bold">{prospectsActive.length}</p>
                    <p className="text-[10px] text-muted-foreground leading-tight">En pipeline</p>
                  </Link>
                  <Link href="/contacts/prospects" className={cn("rounded-lg px-2 py-2 text-center transition-colors", prospectsHot.length > 0 ? "bg-red-500/10 hover:bg-red-500/15" : "bg-muted/40 hover:bg-muted/70")}>
                    <p className={cn("text-lg font-bold", prospectsHot.length > 0 ? "text-red-600" : "")}>{prospectsHot.length}</p>
                    <p className="text-[10px] text-muted-foreground leading-tight">Chauds</p>
                  </Link>
                  <Link href="/contacts/prospects" className={cn("rounded-lg px-2 py-2 text-center transition-colors", prospectsStale.length > 0 ? "bg-amber-500/10 hover:bg-amber-500/15" : "bg-muted/40 hover:bg-muted/70")}>
                    <p className={cn("text-lg font-bold", prospectsStale.length > 0 ? "text-amber-600" : "")}>{prospectsStale.length}</p>
                    <p className="text-[10px] text-muted-foreground leading-tight">Inactifs</p>
                  </Link>
                </div>

                {/* Stage chips */}
                {Object.keys(prospectByStage).length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {PIPELINE_ACTIVE_STAGES.filter((s) => (prospectByStage[s] ?? 0) > 0).map((stage) => {
                      const pipelineLabels: Record<string, string> = {
                        IDENTIFIED: "Identifié", CONTACTED: "Contacté", NO_RESPONSE: "Sans réponse",
                        REPLIED: "A répondu", MEETING: "RDV", PROPOSAL_SENT: "Devis envoyé", NEGOTIATION: "Négociation",
                      }
                      const pipelineColors: Record<string, string> = {
                        IDENTIFIED: "bg-slate-500/15 text-slate-600", CONTACTED: "bg-blue-500/15 text-blue-600",
                        NO_RESPONSE: "bg-amber-500/15 text-amber-700", REPLIED: "bg-teal-500/15 text-teal-600",
                        MEETING: "bg-purple-500/15 text-purple-600", PROPOSAL_SENT: "bg-indigo-500/15 text-indigo-600",
                        NEGOTIATION: "bg-violet-500/15 text-violet-600",
                      }
                      return (
                        <Link
                          key={stage}
                          href={`/contacts/prospects?stage=${stage}`}
                          className={cn("rounded-full border border-transparent px-2 py-0.5 text-[10px] font-medium hover:opacity-80 transition-opacity", pipelineColors[stage])}
                        >
                          {pipelineLabels[stage]} ({prospectByStage[stage]})
                        </Link>
                      )
                    })}
                  </div>
                )}

                {/* Top prospects chauds */}
                {prospectsHot.length > 0 && (
                  <div className="space-y-0.5 border-t border-border/50 pt-2">
                    {prospectsHot.slice(0, 3).map((p) => {
                      const stageShort: Record<string, string> = {
                        IDENTIFIED: "Identifié", CONTACTED: "Contacté", NO_RESPONSE: "Sans réponse",
                        REPLIED: "A répondu", MEETING: "RDV", PROPOSAL_SENT: "Devis env.", NEGOTIATION: "Négo.",
                      }
                      return (
                        <Link
                          key={p.id}
                          href={`/contacts/${p.id}`}
                          className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-muted/50 transition-colors"
                        >
                          <span className="h-1.5 w-1.5 rounded-full bg-red-500 shrink-0" />
                          <p className="text-xs font-medium truncate flex-1">{p.company ?? p.name}</p>
                          <span className="text-[10px] text-muted-foreground shrink-0">{stageShort[p.prospectStage] ?? p.prospectStage}</span>
                        </Link>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Rappels */}
          {upcomingReminders.length > 0 && (
            <Section title="Rappels" icon={<Bell className="h-4 w-4" />} href="/contacts">
              <div className="space-y-1.5">
                {upcomingReminders.map((r) => {
                  const isLate = new Date(r.dueDate) < new Date()
                  return (
                    <div key={r.id} className="flex items-start gap-2 rounded-lg px-3 py-2 hover:bg-muted/50 transition-colors group">
                      <form action={async () => {
                        "use server"
                        const { toggleReminder } = await import("@/actions/crm")
                        await toggleReminder(r.id, r.client.id, true)
                      }}>
                        <button type="submit" title="Marquer comme fait" className="mt-0.5 text-muted-foreground hover:text-emerald-500 transition-colors shrink-0">
                          <Circle className="h-3.5 w-3.5" />
                        </button>
                      </form>
                      <Link href={`/contacts/${r.client.id}/rappels`} className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{r.client.name}</p>
                        {r.note && <p className="text-xs text-muted-foreground truncate">{r.note}</p>}
                        <p className={`text-xs ${isLate ? "text-red-500 font-medium" : "text-muted-foreground"}`}>
                          {new Date(r.dueDate).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                          {isLate && " · En retard"}
                        </p>
                      </Link>
                    </div>
                  )
                })}
              </div>
            </Section>
          )}

          {/* Activité récente */}
          {recentInteractions.length > 0 && (
            <Section title="Activité récente" icon={<Users className="h-4 w-4" />} href="/contacts">
              <div className="space-y-1.5">
                {recentInteractions.map((i) => (
                  <Link key={i.id} href={`/contacts/${i.client.id}/interactions`} className="flex items-start gap-3 rounded-lg px-3 py-2 hover:bg-muted/50 transition-colors">
                    <span className="h-2 w-2 rounded-full bg-muted-foreground mt-1.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{i.client.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{i.summary}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(i.date).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </Section>
          )}

          {/* Clients à relancer */}
          {followUpClients.length > 0 && (
            <Section title="Clients à relancer" icon={<UserMinus className="h-4 w-4" />} href="/contacts">
              <div className="space-y-1.5">
                {followUpClients.map((c) => {
                  // eslint-disable-next-line react-hooks/purity
                  const days = Math.floor((Date.now() - c.lastTouch.getTime()) / (24 * 60 * 60 * 1000))
                  return (
                    <Link key={c.id} href={`/contacts/${c.id}/interactions`} className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-muted/50 transition-colors">
                      <span className="h-2 w-2 rounded-full bg-muted-foreground/40 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{c.company ?? c.name}</p>
                        <p className="text-xs text-muted-foreground">Sans contact depuis {days} j</p>
                      </div>
                    </Link>
                  )
                })}
              </div>
            </Section>
          )}

          {/* Tous ok */}
          {tasksInProgress.length === 0 && tasksDueToday.length === 0 && unpaidInvoices.length === 0 && upcomingReminders.length === 0 && (
            <div className="rounded-xl border border-dashed border-border p-8 text-center text-muted-foreground text-sm">
              Tout est à jour ✓
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function KPICard({
  href, icon, label, value, color,
}: {
  href: string
  icon: React.ReactNode
  label: string
  value: string | number
  color: "indigo" | "blue" | "amber" | "red" | "emerald" | "muted"
}) {
  const colorMap = {
    indigo: "text-indigo-600",
    blue: "text-blue-600",
    amber: "text-amber-600",
    red: "text-red-600",
    emerald: "text-emerald-600",
    muted: "text-muted-foreground",
  }
  return (
    <Link href={href}>
      <div className="rounded-xl border border-border/50 bg-card p-4 hover:border-border hover:shadow-sm transition-all space-y-1">
        <div className={`flex items-center gap-1.5 text-xs ${colorMap[color]}`}>{icon}{label}</div>
        <p className="text-xl font-bold">{value}</p>
      </div>
    </Link>
  )
}

function Section({
  title, icon, href, children,
}: {
  title: string
  icon: React.ReactNode
  href: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-xl border border-border/50 bg-card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <span className="text-muted-foreground">{icon}</span>
          {title}
        </div>
        <Link href={href} className="text-xs text-primary hover:underline">Voir tout →</Link>
      </div>
      <div className="p-2">{children}</div>
    </div>
  )
}
