import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { notFound } from "next/navigation"
import Link from "next/link"
import { Calendar, Clock, CheckSquare, BookOpen, FileText, Receipt, Flag, Wallet } from "lucide-react"
import { createJournalEntry } from "@/actions/projet"
import { QuickNoteForm } from "@/components/modules/projet/QuickNoteForm"
import { JournalEntryItem } from "@/components/modules/projet/JournalEntryItem"
import { MilestoneDialog, MILESTONE_TYPE_LABELS, MILESTONE_TYPE_COLORS } from "@/components/modules/projet/MilestoneDialog"
import { MilestoneToggle } from "@/components/modules/projet/MilestoneToggle"
import { ProjectTasksCard } from "@/components/modules/projet/ProjectTasksCard"
import { ProjectLinksCard } from "@/components/modules/projet/ProjectLinksCard"
import { REVENUE_TYPE_LABELS } from "@/lib/revenue-constants"

function fmtTime(d: Date | string) {
  return new Date(d).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
}
function hasTime(d: Date | string) {
  const dt = new Date(d)
  return dt.getHours() !== 0 || dt.getMinutes() !== 0
}

const quoteStatusLabel: Record<string, string> = {
  DRAFT: "Brouillon", VALIDATED: "Validé", SENT: "Envoyé",
  WAITING_DEPOSIT: "Attente acompte", DEPOSIT_RECEIVED: "Acompte reçu",
  ACCEPTED: "Accepté", IN_PROGRESS: "En cours", SIGNED: "Signé", REJECTED: "Refusé",
}
const quoteStatusCls: Record<string, string> = {
  DRAFT: "bg-muted text-muted-foreground",
  VALIDATED: "bg-violet-500/15 text-violet-600",
  SENT: "bg-blue-500/15 text-blue-600",
  WAITING_DEPOSIT: "bg-amber-500/15 text-amber-600",
  DEPOSIT_RECEIVED: "bg-emerald-500/15 text-emerald-600",
  ACCEPTED: "bg-emerald-500/15 text-emerald-600",
  IN_PROGRESS: "bg-indigo-500/15 text-indigo-600",
  SIGNED: "bg-teal-500/15 text-teal-600",
  REJECTED: "bg-red-500/15 text-red-600",
}
const invoiceStatusLabel: Record<string, string> = {
  DRAFT: "Brouillon", SENT: "Envoyée", PAID: "Payée", LATE: "En retard",
}
const invoiceStatusCls: Record<string, string> = {
  DRAFT: "bg-muted text-muted-foreground",
  SENT: "bg-blue-500/15 text-blue-600",
  PAID: "bg-emerald-500/15 text-emerald-600",
  LATE: "bg-red-500/15 text-red-600",
}
const invoiceTypeLabel: Record<string, string> = {
  DEPOSIT: "Acompte", FINAL: "Solde", RECURRING: "Récurrent", STANDALONE: "Standard",
}
const revenueStatusLabel: Record<string, string> = { PENDING: "En attente", RECEIVED: "Reçu" }
const revenueStatusCls: Record<string, string> = {
  PENDING: "bg-amber-500/15 text-amber-600",
  RECEIVED: "bg-emerald-500/15 text-emerald-600",
}

export default async function ProjectOverviewPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const session = await auth()
  const userId = session!.user.id

  const project = await prisma.project.findFirst({
    where: { id, OR: [{ userId }, { members: { some: { userId } } }] },
    include: {
      tasks: {
        where: { parentTaskId: null },
        select: {
          id: true,
          title: true,
          status: true,
          priority: true,
          dueDate: true,
          timeEntries: { where: { userId, endedAt: { not: null } }, select: { duration: true } },
          subTasks: {
            select: {
              timeEntries: { where: { userId, endedAt: { not: null } }, select: { duration: true } },
            },
          },
        },
      },
      milestones: { orderBy: { date: "asc" } },
      deliverables: true,
      journalEntries: { orderBy: { createdAt: "desc" }, take: 8 },
      usefulLinks: { orderBy: { createdAt: "asc" } },
      quotes: {
        select: { id: true, number: true, status: true, totalHT: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      },
      invoices: {
        select: { id: true, number: true, status: true, type: true, totalHT: true, depositDeducted: true, dueDate: true },
        orderBy: { createdAt: "desc" },
      },
      revenues: {
        select: { id: true, type: true, label: true, amount: true, currency: true, status: true, receivedAt: true, expectedAt: true },
        orderBy: { createdAt: "desc" },
      },
      members: {
        include: { user: { select: { name: true, email: true, image: true } } },
        orderBy: { createdAt: "asc" },
      },
      user: { select: { name: true, email: true, image: true } },
    },
  })

  if (!project) notFound()

  const totalTasks = project.tasks.length
  const doneTasks = project.tasks.filter((t) => t.status === "DONE").length
  const inProgressTasks = project.tasks.filter((t) => t.status === "IN_PROGRESS").length

  const totalTrackedSeconds = project.tasks.reduce((sum, t) => {
    const direct = t.timeEntries.reduce((s, e) => s + (e.duration ?? 0), 0)
    const sub = t.subTasks.reduce((s, st) => s + st.timeEntries.reduce((ss, e) => ss + (e.duration ?? 0), 0), 0)
    return sum + direct + sub
  }, 0)
  const totalTrackedHours = totalTrackedSeconds / 3600
  const budgetPct = project.estimatedHours
    ? Math.min(100, Math.round((totalTrackedHours / project.estimatedHours) * 100))
    : null
  const isOver = project.estimatedHours ? totalTrackedHours > project.estimatedHours : false

  function fmtH(h: number) {
    const int = Math.floor(h)
    const min = Math.round((h - int) * 60)
    if (int > 0 && min > 0) return `${int}h${String(min).padStart(2, "0")}`
    if (int > 0) return `${int}h`
    return `${min}m`
  }

  // Tâches ouvertes d'abord (échéance croissante, sans échéance à la fin), terminées ensuite
  const sortedTasks = [...project.tasks].sort((a, b) => {
    const aDone = a.status === "DONE" ? 1 : 0
    const bDone = b.status === "DONE" ? 1 : 0
    if (aDone !== bDone) return aDone - bDone
    const aTime = a.dueDate ? new Date(a.dueDate).getTime() : Infinity
    const bTime = b.dueDate ? new Date(b.dueDate).getTime() : Infinity
    return aTime - bTime
  })

  const hasBilling = project.quotes.length > 0 || project.invoices.length > 0
  const invoicedTotal = project.invoices.reduce((s, inv) => s + (inv.totalHT - inv.depositDeducted), 0)
  const invoicedReceived = project.invoices
    .filter((inv) => inv.status === "PAID")
    .reduce((s, inv) => s + (inv.totalHT - inv.depositDeducted), 0)

  const hasRevenue = project.revenues.length > 0
  const totalRevenue = project.revenues.reduce((s, r) => s + r.amount, 0)
  const receivedRevenue = project.revenues
    .filter((r) => r.status === "RECEIVED")
    .reduce((s, r) => s + r.amount, 0)

  // Jalons (carte Suivi)
  const totalMilestones = project.milestones.length
  const doneMilestones = project.milestones.filter((m) => m.status === "DONE").length

  // Vue argent consolidée facturation + revenus (carte Facturation)
  const grandTotal = invoicedTotal + totalRevenue
  const grandReceived = invoicedReceived + receivedRevenue
  const pendingRevenue = totalRevenue - receivedRevenue // non déclaré + pas encore reçu → couleur distincte
  const fmtEur = (n: number) => n.toLocaleString("fr-FR")

  return (
    <div className="space-y-6">

      {/* Grille uniforme : cartes 1/3 de largeur, 3 par rangée sur desktop */}
      {/* Ordre visuel via order-* : Tâches → Jalons → Facturation/Revenus → Liens → Suivi → Notes */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 items-start">

        {/* Jalons */}
        <div className="order-2 rounded-xl border border-border/50 bg-card p-5 space-y-3">
          <div className="flex items-center gap-2 font-semibold text-sm">
            <Flag className="h-4 w-4 text-muted-foreground" />
            Jalons
          </div>
          {project.milestones.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">Aucun jalon défini</p>
          ) : (
            <div className="space-y-1.5">
              {project.milestones.map((m) => {
                const isPast = m.status !== "DONE" && m.status !== "CANCELLED" && new Date(m.date) < new Date()
                const statusCls =
                  m.status === "DONE" ? "bg-emerald-500/15 text-emerald-600" :
                  m.status === "CANCELLED" ? "bg-red-500/15 text-red-600" :
                  m.status === "IN_PROGRESS" ? "bg-blue-500/15 text-blue-600" :
                  isPast ? "bg-red-500/15 text-red-600" :
                  "bg-muted text-muted-foreground"
                const statusLabel =
                  m.status === "DONE" ? "Terminé" :
                  m.status === "CANCELLED" ? "Annulé" :
                  m.status === "IN_PROGRESS" ? "En cours" :
                  isPast ? "En retard" : "À venir"
                return (
                  <div key={m.id} className="flex items-center gap-2 py-1 group">
                    <MilestoneToggle milestoneId={m.id} projectId={id} status={m.status} />
                    <span className="flex-1 text-sm truncate min-w-0">{m.name}</span>
                    <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${MILESTONE_TYPE_COLORS[m.type] ?? MILESTONE_TYPE_COLORS.OTHER}`}>
                      {MILESTONE_TYPE_LABELS[m.type] ?? m.type}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(m.date).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                      {hasTime(m.date) && ` · ${fmtTime(m.date)}`}
                      {m.endDate && ` – ${fmtTime(m.endDate)}`}
                    </span>
                    <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-xs font-medium ${statusCls}`}>
                      {statusLabel}
                    </span>
                    <MilestoneDialog projectId={id} milestone={m} />
                  </div>
                )
              })}
            </div>
          )}
          <MilestoneDialog projectId={id} />
        </div>

        {/* Tâches — liste cochable */}
        <div className="order-1">
          <ProjectTasksCard
            projectId={id}
            tasks={sortedTasks.map((t) => ({
              id: t.id, title: t.title, status: t.status, priority: t.priority, dueDate: t.dueDate,
            }))}
          />
        </div>

        {/* Liens — liste avec health check + ajout inline */}
        <div className="order-4">
          <ProjectLinksCard projectId={id} links={project.usefulLinks} />
        </div>

        {/* Suivi — temps, budget, livrables, période */}
        <div className={`order-5 rounded-xl border p-5 space-y-3 ${isOver ? "border-red-500/30 bg-red-500/5" : budgetPct && budgetPct > 80 ? "border-amber-500/30 bg-amber-500/5" : "border-border/50 bg-card"}`}>
          <div className="flex items-center gap-2 font-semibold text-sm">
            <Clock className="h-4 w-4 text-muted-foreground" />
            Suivi
          </div>

          <div className="space-y-1">
            <div className="flex items-baseline justify-between">
              <p className={`text-2xl font-bold ${isOver ? "text-red-500" : ""}`}>
                {totalTrackedSeconds > 0 ? fmtH(totalTrackedHours) : "0h"}
              </p>
              <p className="text-xs text-muted-foreground">temps suivi</p>
            </div>
            {project.estimatedHours ? (
              <>
                <div className="h-1 rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${isOver ? "bg-red-500" : budgetPct && budgetPct > 80 ? "bg-amber-500" : "bg-blue-500"}`}
                    style={{ width: `${budgetPct ?? 0}%` }}
                  />
                </div>
                <p className={`text-xs ${isOver ? "text-red-500 font-medium" : "text-muted-foreground"}`}>
                  {isOver ? `+${fmtH(totalTrackedHours - project.estimatedHours)} de dépassement` : `${fmtH(project.estimatedHours)} estimé`}
                </p>
              </>
            ) : (
              <p className="text-xs text-muted-foreground">pas d&apos;estimé défini</p>
            )}
          </div>

          <div className="border-t border-border/40 pt-2.5 space-y-1.5 text-sm">
            {totalTasks > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground flex items-center gap-1.5"><CheckSquare className="h-3.5 w-3.5" /> Tâches</span>
                <span className="font-medium tabular-nums">{doneTasks}/{totalTasks}{inProgressTasks > 0 && <span className="text-xs text-muted-foreground font-normal"> · {inProgressTasks} en cours</span>}</span>
              </div>
            )}
            {totalMilestones > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground flex items-center gap-1.5"><Flag className="h-3.5 w-3.5" /> Jalons</span>
                <span className="font-medium tabular-nums">{doneMilestones}/{totalMilestones}</span>
              </div>
            )}
            {project.deliverables.length > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground flex items-center gap-1.5"><BookOpen className="h-3.5 w-3.5" /> Livrables validés</span>
                <span className="font-medium tabular-nums">
                  {project.deliverables.filter((d) => d.status === "VALIDATED").length}/{project.deliverables.length}
                </span>
              </div>
            )}
            {hasRevenue && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground flex items-center gap-1.5"><Receipt className="h-3.5 w-3.5" /> Revenus reçus</span>
                <span className="font-medium tabular-nums">{fmtEur(receivedRevenue)} / {fmtEur(totalRevenue)} €</span>
              </div>
            )}
            {(project.startDate || project.endDate) && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" /> Période</span>
                <span className="font-medium text-xs">
                  {project.startDate ? new Date(project.startDate).toLocaleDateString("fr-FR", { day: "numeric", month: "short" }) : "?"}
                  {" → "}
                  {project.endDate ? new Date(project.endDate).toLocaleDateString("fr-FR", { day: "numeric", month: "short" }) : "?"}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Notes rapides */}
        <div className="order-6 rounded-xl border border-border/50 bg-card p-5 space-y-3">
          <div className="flex items-center gap-2 font-semibold text-sm">
            <BookOpen className="h-4 w-4 text-muted-foreground" />
            Notes rapides
          </div>

          <QuickNoteForm action={async (fd: FormData) => {
            "use server"
            await createJournalEntry(id, fd)
          }} />

          {project.journalEntries.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">Aucune note pour l&apos;instant</p>
          ) : (
            <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
              {project.journalEntries.map((entry) => (
                <JournalEntryItem key={entry.id} entry={entry} projectId={id} />
              ))}
            </div>
          )}
        </div>

        {/* Facturation / Revenus */}
        <div className="order-3">
        {hasBilling ? (
            <div className="rounded-xl border border-border/50 bg-card p-5 space-y-4">
              <Link href={`/facturation/factures?projet=${project.id}`} className="flex items-center gap-2 font-semibold text-sm hover:text-primary transition-colors">
                <Receipt className="h-4 w-4 text-muted-foreground" />
                Facturation{hasRevenue ? " & revenus" : ""} →
              </Link>

              {grandTotal > 0 && (
                <div className="space-y-1">
                  <div className="flex items-baseline justify-between">
                    <p className="text-lg font-bold">
                      {fmtEur(grandReceived)} <span className="text-xs font-normal text-muted-foreground">/ {fmtEur(grandTotal)} € reçus</span>
                    </p>
                  </div>
                  {/* Barre empilée : reçu (vert) + revenu non déclaré en attente (ambre, distinct) */}
                  <div className="flex h-1 rounded-full bg-muted overflow-hidden">
                    <div className="bg-emerald-500 transition-all" style={{ width: `${Math.round((grandReceived / grandTotal) * 100)}%` }} />
                    {pendingRevenue > 0 && (
                      <div className="bg-amber-500 transition-all" style={{ width: `${Math.round((pendingRevenue / grandTotal) * 100)}%` }} />
                    )}
                  </div>
                  {pendingRevenue > 0 && (
                    <p className="text-xs text-amber-600">dont {fmtEur(pendingRevenue)} € de revenu non déclaré en attente</p>
                  )}
                </div>
              )}

              {project.quotes.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide flex items-center gap-1">
                    <FileText className="h-3 w-3" /> Devis
                  </p>
                  {project.quotes.map((q) => (
                    <Link
                      key={q.id}
                      href={`/facturation/devis/${q.id}`}
                      className="flex items-center gap-2 text-sm hover:text-primary transition-colors py-0.5"
                    >
                      <span className="font-mono text-xs text-muted-foreground">{q.number}</span>
                      <span className={`rounded-full px-1.5 py-0.5 text-xs font-medium ${quoteStatusCls[q.status] ?? ""}`}>
                        {quoteStatusLabel[q.status] ?? q.status}
                      </span>
                      <span className="ml-auto text-xs font-medium tabular-nums">{q.totalHT.toLocaleString("fr-FR")} €</span>
                    </Link>
                  ))}
                </div>
              )}

              {project.invoices.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide flex items-center gap-1">
                    <Receipt className="h-3 w-3" /> Factures
                  </p>
                  {project.invoices.map((inv) => {
                    const amount = inv.totalHT - inv.depositDeducted
                    const isLate = inv.dueDate && inv.status === "SENT" && new Date(inv.dueDate) < new Date()
                    return (
                      <Link
                        key={inv.id}
                        href={`/facturation/factures/${inv.id}`}
                        className="flex items-center gap-2 text-sm hover:text-primary transition-colors py-0.5"
                      >
                        <span className="font-mono text-xs text-muted-foreground">{inv.number}</span>
                        <span className="text-xs text-muted-foreground">{invoiceTypeLabel[inv.type] ?? inv.type}</span>
                        <span className={`rounded-full px-1.5 py-0.5 text-xs font-medium ${invoiceStatusCls[inv.status] ?? ""}`}>
                          {invoiceStatusLabel[inv.status] ?? inv.status}
                        </span>
                        <span className={`ml-auto text-xs font-medium tabular-nums ${isLate ? "text-red-500" : ""}`}>
                          {amount.toLocaleString("fr-FR")} €
                        </span>
                      </Link>
                    )
                  })}
                </div>
              )}

              {hasRevenue && (
                <div className="space-y-1.5">
                  <Link href="/revenus" className="text-xs text-muted-foreground font-medium uppercase tracking-wide flex items-center gap-1 hover:text-primary transition-colors">
                    <Wallet className="h-3 w-3" /> Revenus
                  </Link>
                  {project.revenues.map((r) => (
                    <div key={r.id} className="flex items-center gap-2 text-sm py-0.5">
                      <span className="text-xs text-muted-foreground shrink-0">{REVENUE_TYPE_LABELS[r.type] ?? r.type}</span>
                      <span className="flex-1 truncate">{r.label}</span>
                      <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-xs font-medium ${revenueStatusCls[r.status] ?? ""}`}>
                        {revenueStatusLabel[r.status] ?? r.status}
                      </span>
                      <span className="shrink-0 text-xs font-medium tabular-nums">{r.amount.toLocaleString("fr-FR")} €</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : hasRevenue ? (
            <div className="rounded-xl border border-border/50 bg-card p-5 space-y-4">
              <Link href="/revenus" className="flex items-center gap-2 font-semibold text-sm hover:text-primary transition-colors">
                <Receipt className="h-4 w-4 text-muted-foreground" />
                Revenus →
              </Link>

              <div className="space-y-1">
                <p className="text-lg font-bold">
                  {receivedRevenue.toLocaleString("fr-FR")} <span className="text-xs font-normal text-muted-foreground">/ {totalRevenue.toLocaleString("fr-FR")} € reçus</span>
                </p>
                <div className="h-1 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-all"
                    style={{ width: `${totalRevenue > 0 ? Math.min(100, Math.round((receivedRevenue / totalRevenue) * 100)) : 0}%` }}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                {project.revenues.map((r) => (
                  <div key={r.id} className="flex items-center gap-2 text-sm py-0.5">
                    <span className="text-xs text-muted-foreground shrink-0">{REVENUE_TYPE_LABELS[r.type] ?? r.type}</span>
                    <span className="flex-1 truncate">{r.label}</span>
                    <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-xs font-medium ${revenueStatusCls[r.status] ?? ""}`}>
                      {revenueStatusLabel[r.status] ?? r.status}
                    </span>
                    <span className="ml-auto shrink-0 text-xs font-medium tabular-nums">{r.amount.toLocaleString("fr-FR")} €</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border/50 p-5 text-center space-y-1">
              <Receipt className="h-6 w-6 text-muted-foreground mx-auto" />
              <p className="text-xs text-muted-foreground">Aucune facturation liée à ce projet</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
