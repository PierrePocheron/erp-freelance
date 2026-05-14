import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { notFound } from "next/navigation"
import Link from "next/link"
import { Calendar, Clock, CheckSquare, BookOpen, Link2, ExternalLink, FileText, Receipt, Flag } from "lucide-react"
import { Button } from "@/components/ui/button"
import { createJournalEntry } from "@/actions/projet"
import { QuickNoteForm } from "@/components/modules/projet/QuickNoteForm"
import { JournalEntryItem } from "@/components/modules/projet/JournalEntryItem"
import { LINK_CATEGORY_CONFIG, normalizeUrl } from "@/lib/link-categories"

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

export default async function ProjectOverviewPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const session = await auth()
  const userId = session!.user.id

  const project = await prisma.project.findFirst({
    where: { id, userId },
    include: {
      tasks: {
        where: { parentTaskId: null },
        select: {
          status: true,
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

  const nextMilestone = project.milestones
    .filter((m) => m.status !== "DONE")
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0]

  const hasBilling = project.quotes.length > 0 || project.invoices.length > 0

  return (
    <div className="space-y-6">

      {/* Bento stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-xl border border-border/50 bg-card p-4 space-y-1.5">
          <div className="flex items-center gap-2 text-muted-foreground text-xs">
            <CheckSquare className="h-3.5 w-3.5" />
            Tâches
          </div>
          <p className="text-2xl font-bold">{doneTasks}<span className="text-sm font-normal text-muted-foreground">/{totalTasks}</span></p>
          {totalTasks > 0 && (
            <div className="space-y-1">
              <div className="h-1 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all"
                  style={{ width: `${Math.round((doneTasks / totalTasks) * 100)}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground">{inProgressTasks} en cours</p>
            </div>
          )}
        </div>

        <div className={`rounded-xl border p-4 space-y-1.5 ${isOver ? "border-red-500/30 bg-red-500/5" : budgetPct && budgetPct > 80 ? "border-amber-500/30 bg-amber-500/5" : "border-border/50 bg-card"}`}>
          <div className="flex items-center gap-2 text-muted-foreground text-xs">
            <Clock className="h-3.5 w-3.5" />
            Temps suivi
          </div>
          <p className={`text-2xl font-bold ${isOver ? "text-red-500" : ""}`}>
            {totalTrackedSeconds > 0 ? fmtH(totalTrackedHours) : "—"}
          </p>
          {project.estimatedHours ? (
            <div className="space-y-1">
              <div className="h-1 rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${isOver ? "bg-red-500" : budgetPct && budgetPct > 80 ? "bg-amber-500" : "bg-blue-500"}`}
                  style={{ width: `${budgetPct ?? 0}%` }}
                />
              </div>
              <p className={`text-xs ${isOver ? "text-red-500 font-medium" : "text-muted-foreground"}`}>
                {isOver ? `+${fmtH(totalTrackedHours - project.estimatedHours)} dépassement` : `${fmtH(project.estimatedHours)} estimé`}
              </p>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">pas d&apos;estimé</p>
          )}
        </div>

        <div className="rounded-xl border border-border/50 bg-card p-4 space-y-1">
          <div className="flex items-center gap-2 text-muted-foreground text-xs">
            <Calendar className="h-3.5 w-3.5" />
            Prochain jalon
          </div>
          {nextMilestone ? (
            <>
              <p className="text-sm font-semibold leading-tight">{nextMilestone.name}</p>
              <p className="text-xs text-muted-foreground">
                {new Date(nextMilestone.date).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
              </p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Aucun jalon</p>
          )}
        </div>

        <div className="rounded-xl border border-border/50 bg-card p-4 space-y-1">
          <div className="flex items-center gap-2 text-muted-foreground text-xs">
            <BookOpen className="h-3.5 w-3.5" />
            Livrables
          </div>
          <p className="text-2xl font-bold">
            {project.deliverables.filter((d) => d.status === "VALIDATED").length}
            <span className="text-sm font-normal text-muted-foreground">/{project.deliverables.length}</span>
          </p>
          <p className="text-xs text-muted-foreground">validés</p>
        </div>
      </div>

      {/* Liens rapides — raccourcis */}
      {project.usefulLinks.length > 0 && (
        <div className="rounded-xl border border-border/50 bg-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <Link2 className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Liens rapides</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {project.usefulLinks.map((l) => {
              const cat = LINK_CATEGORY_CONFIG[l.category] ?? LINK_CATEGORY_CONFIG.OTHER
              return (
                <a
                  key={l.id}
                  href={normalizeUrl(l.url)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-opacity hover:opacity-80 ${cat.cls}`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${cat.dot}`} />
                  {l.label}
                  <ExternalLink className="h-2.5 w-2.5 opacity-60" />
                </a>
              )
            })}
          </div>
        </div>
      )}

      {/* Contenu principal : 2 colonnes */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">

        {/* Colonne gauche : Notes rapides */}
        <div className="lg:col-span-2 space-y-6">

          {/* Notes rapides */}
          <div className="rounded-xl border border-border/50 bg-card p-5 space-y-4">
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-muted-foreground" />
              <h2 className="font-semibold">Notes rapides</h2>
            </div>

            <QuickNoteForm action={async (fd: FormData) => {
              "use server"
              await createJournalEntry(id, fd)
            }} />

            {project.journalEntries.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">Aucune note pour l&apos;instant</p>
            ) : (
              <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                {project.journalEntries.map((entry) => (
                  <JournalEntryItem key={entry.id} entry={entry} projectId={id} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Colonne droite : Jalons + Facturation */}
        <div className="space-y-6">

          {/* Jalons */}
          <div className="rounded-xl border border-border/50 bg-card p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Flag className="h-4 w-4 text-muted-foreground" />
                <h2 className="font-semibold text-sm">Jalons</h2>
              </div>
              <Link href={`/projets/${id}/dev`} className="text-xs text-primary hover:underline">Gérer →</Link>
            </div>
            {project.milestones.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">Aucun jalon défini</p>
            ) : (
              <div className="space-y-1.5">
                {project.milestones.map((m) => {
                  const isPast = m.status !== "DONE" && new Date(m.date) < new Date()
                  const statusCls =
                    m.status === "DONE" ? "bg-emerald-500/15 text-emerald-600" :
                    m.status === "IN_PROGRESS" ? "bg-blue-500/15 text-blue-600" :
                    isPast ? "bg-red-500/15 text-red-600" :
                    "bg-muted text-muted-foreground"
                  const statusLabel =
                    m.status === "DONE" ? "Terminé" :
                    m.status === "IN_PROGRESS" ? "En cours" :
                    isPast ? "En retard" : "À venir"
                  return (
                    <div key={m.id} className="flex items-center gap-2 py-1">
                      <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-xs font-medium ${statusCls}`}>
                        {statusLabel}
                      </span>
                      <span className="flex-1 text-sm truncate">{m.name}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {new Date(m.date).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {hasBilling ? (
            <div className="rounded-xl border border-border/50 bg-card p-5 space-y-4">
              <Link href="/facturation" className="block font-semibold text-sm hover:text-primary transition-colors">
                Facturation →
              </Link>

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
