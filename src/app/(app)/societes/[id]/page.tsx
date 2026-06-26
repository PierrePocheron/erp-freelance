import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import {
  ChevronLeft, Building2, Mail, Phone, Globe, MapPin,
  Users, FolderOpen, Trash2, ExternalLink, Receipt, FileText,
  TrendingUp, Clock, AlertTriangle, CheckCircle2, ListTodo,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { deleteCompany } from "@/actions/crm"
import { NewContactForCompanyButton } from "@/components/modules/societes/NewContactForCompanyButton"
import { NewProjectForCompanyButton } from "@/components/modules/societes/NewProjectForCompanyButton"
import { CompanyTypeSelect } from "@/components/modules/societes/CompanyTypeSelect"
import { STATUS_CONFIG, type JobAppStatus } from "@/components/modules/entretien/status-config"

const fmt = (n: number) => n.toLocaleString("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })
const fmtDate = (d: Date | string) =>
  new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })

export default async function CompanyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const session = await auth()
  const userId = session!.user.id

  const [company, invoices, quotes, tasks, allCompanies, allContacts] = await Promise.all([
    prisma.company.findFirst({
      where: { id, userId },
      include: {
        fiscalSource: { select: { id: true, name: true, color: true, bucket: true } },
        // companyType inclus via include (champ scalaire — toujours dans l'objet)
        contacts: {
          orderBy: { name: "asc" },
          select: { id: true, name: true, email: true, phone: true, type: true },
        },
        projects: {
          orderBy: { createdAt: "desc" },
          select: { id: true, name: true, status: true, estimatedHours: true, startDate: true, endDate: true },
        },
        _count: { select: { contacts: true, projects: true } },
      },
    }),

    // Factures via projet.companyId OU client.companyId
    prisma.invoice.findMany({
      where: {
        userId,
        OR: [
          { project: { companyId: id } },
          { client: { companyId: id } },
        ],
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        number: true,
        status: true,
        totalHT: true,
        depositDeducted: true,
        dueDate: true,
        createdAt: true,
        project: { select: { id: true, name: true } },
        client:  { select: { id: true, name: true } },
        emitter: {
          select: {
            fiscalSource: { select: { id: true, name: true, color: true, bucket: true } },
          },
        },
      },
    }),

    // Devis via projet.companyId OU client.companyId
    prisma.quote.findMany({
      where: {
        userId,
        OR: [
          { project: { companyId: id } },
          { client: { companyId: id } },
        ],
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        number: true,
        status: true,
        totalHT: true,
        createdAt: true,
        project: { select: { id: true, name: true } },
        client: { select: { id: true, name: true } },
      },
    }),

    // Tâches non terminées via projet.companyId OU client.companyId
    prisma.task.findMany({
      where: {
        status: { not: "DONE" },
        isGroup: false,
        OR: [
          { project: { companyId: id, userId } },
          { client: { companyId: id, userId } },
        ],
      },
      orderBy: [{ priority: "desc" }, { dueDate: "asc" }, { createdAt: "asc" }],
      take: 20,
      select: {
        id: true,
        title: true,
        status: true,
        priority: true,
        dueDate: true,
        project: { select: { id: true, name: true } },
        client: { select: { id: true, name: true } },
      },
    }),

    // Pour le dialog "Nouveau projet"
    prisma.company.findMany({
      where: { userId },
      orderBy: { name: "asc" },
      select: { id: true, name: true, city: true },
    }),
    prisma.client.findMany({
      where: { userId },
      orderBy: { name: "asc" },
      select: { id: true, name: true, company: true, companyId: true },
    }),
  ])

  if (!company) notFound()

  // Candidatures liées (ESN / RECRUTEMENT)
  const linkedApplications =
    company.companyType === "ESN" || company.companyType === "RECRUTEMENT"
      ? await prisma.jobApplication.findMany({
          where: { userId, companyId: id },
          select: { id: true, companyName: true, position: true, status: true, nextActionAt: true },
          orderBy: { updatedAt: "desc" },
        })
      : []

  // ── Métriques financières ─────────────────────────────────────────────────────

  const netAmount = (inv: { totalHT: number; depositDeducted: number }) =>
    inv.totalHT - inv.depositDeducted

  const totalPaid    = invoices.filter(i => i.status === "PAID").reduce((s, i) => s + netAmount(i), 0)
  const totalPending = invoices.filter(i => i.status === "SENT").reduce((s, i) => s + netAmount(i), 0)
  const totalLate    = invoices.filter(i => i.status === "LATE").reduce((s, i) => s + netAmount(i), 0)
  const totalBilled  = totalPaid + totalPending + totalLate  // émises (hors brouillon)

  const nbInvoices   = invoices.length
  const nbQuotes     = quotes.length
  const nbQuotesSent = quotes.filter(q => !["DRAFT"].includes(q.status)).length

  // ── Sources fiscales utilisées pour cette société ─────────────────────────────
  // Déduit depuis les profils émetteurs des factures (sans champ supplémentaire sur Company)

  type FiscalSourceInfo = { id: string; name: string; color: string; bucket: string }
  const fiscalSourceMap = new Map<string, FiscalSourceInfo>()
  for (const inv of invoices) {
    const fs = inv.emitter?.fiscalSource
    if (fs) fiscalSourceMap.set(fs.id, fs)
  }
  const usedFiscalSources = [...fiscalSourceMap.values()]

  // ── Métriques projets ─────────────────────────────────────────────────────────

  const projectsByStatus = company.projects.reduce<Record<string, number>>((acc, p) => {
    acc[p.status] = (acc[p.status] ?? 0) + 1
    return acc
  }, {})

  const totalEstimatedH = company.projects.reduce((s, p) => s + (p.estimatedHours ?? 0), 0)

  // ── Labels / couleurs ─────────────────────────────────────────────────────────

  const projectStatusLabel: Record<string, string> = {
    ACTIVE: "En cours", COMPLETED: "Terminé", ON_HOLD: "En pause",
    CANCELLED: "Annulé", DRAFT: "Brouillon", PAUSED: "En pause", ARCHIVED: "Archivé",
  }
  const projectStatusColor: Record<string, string> = {
    ACTIVE: "text-emerald-600 bg-emerald-500/10",
    COMPLETED: "text-blue-600 bg-blue-500/10",
    PAUSED: "text-amber-600 bg-amber-500/10",
    ON_HOLD: "text-amber-600 bg-amber-500/10",
    CANCELLED: "text-red-600 bg-red-500/10",
    ARCHIVED: "text-muted-foreground bg-muted",
    DRAFT: "text-muted-foreground bg-muted",
  }

  const invoiceStatusLabel: Record<string, string> = {
    DRAFT: "Brouillon", ISSUED: "Émise", SENT: "Envoyée", PAID: "Payée", LATE: "En retard",
  }
  const invoiceStatusColor: Record<string, string> = {
    DRAFT: "text-muted-foreground bg-muted",
    ISSUED: "text-violet-600 bg-violet-500/10",
    SENT:  "text-blue-600 bg-blue-500/10",
    PAID:  "text-emerald-600 bg-emerald-500/10",
    LATE:  "text-red-600 bg-red-500/10",
  }

  const quoteStatusLabel: Record<string, string> = {
    DRAFT: "Brouillon", VALIDATED: "Validé", SENT: "Envoyé",
    ACCEPTED: "Accepté", IN_PROGRESS: "En cours", SIGNED: "Signé", REJECTED: "Refusé",
    WAITING_DEPOSIT: "Acompte att.", DEPOSIT_RECEIVED: "Acompte reçu",
  }
  const quoteStatusColor: Record<string, string> = {
    DRAFT: "text-muted-foreground bg-muted",
    VALIDATED: "text-violet-600 bg-violet-500/10",
    SENT: "text-blue-600 bg-blue-500/10",
    ACCEPTED: "text-emerald-600 bg-emerald-500/10",
    IN_PROGRESS: "text-indigo-600 bg-indigo-500/10",
    SIGNED: "text-teal-600 bg-teal-500/10",
    REJECTED: "text-red-600 bg-red-500/10",
    WAITING_DEPOSIT: "text-amber-600 bg-amber-500/10",
    DEPOSIT_RECEIVED: "text-emerald-600 bg-emerald-500/10",
  }

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div>
        <Link
          href="/societes"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-3"
        >
          <ChevronLeft className="h-4 w-4" /> Sociétés
        </Link>

        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Building2 className="h-5 w-5 text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">{company.name}</h1>
              <CompanyTypeSelect companyId={company.id} value={company.companyType ?? null} />
            </div>
            {company.city && (
              <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
                <MapPin className="h-3.5 w-3.5" />
                {company.city}{company.country && company.country !== "France" ? `, ${company.country}` : ""}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* KPI row */}
      {(totalBilled > 0 || nbInvoices > 0) && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <KpiCard
            icon={<TrendingUp className="h-4 w-4 text-emerald-600" />}
            label="CA encaissé"
            value={`${fmt(totalPaid)} €`}
            sub={`${invoices.filter(i => i.status === "PAID").length} facture${invoices.filter(i => i.status === "PAID").length !== 1 ? "s" : ""} payée${invoices.filter(i => i.status === "PAID").length !== 1 ? "s" : ""}`}
            color="emerald"
          />
          {totalPending > 0 && (
            <KpiCard
              icon={<Clock className="h-4 w-4 text-blue-600" />}
              label="En attente"
              value={`${fmt(totalPending)} €`}
              sub={`${invoices.filter(i => i.status === "SENT").length} envoyée${invoices.filter(i => i.status === "SENT").length !== 1 ? "s" : ""}`}
              color="blue"
            />
          )}
          {totalLate > 0 && (
            <KpiCard
              icon={<AlertTriangle className="h-4 w-4 text-red-600" />}
              label="En retard"
              value={`${fmt(totalLate)} €`}
              sub={`${invoices.filter(i => i.status === "LATE").length} facture${invoices.filter(i => i.status === "LATE").length !== 1 ? "s" : ""}`}
              color="red"
            />
          )}
          <KpiCard
            icon={<FileText className="h-4 w-4 text-muted-foreground" />}
            label="Devis envoyés"
            value={String(nbQuotesSent)}
            sub={`${nbQuotes} au total`}
            color="muted"
          />
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* ── Colonne principale ── */}
        <div className="lg:col-span-2 space-y-6">

          {/* Informations */}
          <div className="rounded-xl border border-border/50 bg-card p-5 space-y-4">
            <h2 className="font-semibold text-sm">Informations</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {company.email && (
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                  <a href={`mailto:${company.email}`} className="hover:text-primary transition-colors truncate">{company.email}</a>
                </div>
              )}
              {company.phone && (
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                  <a href={`tel:${company.phone}`} className="hover:text-primary transition-colors">{company.phone}</a>
                </div>
              )}
              {company.website && (
                <div className="flex items-center gap-2 text-sm">
                  <Globe className="h-4 w-4 text-muted-foreground shrink-0" />
                  <a
                    href={company.website.startsWith("http") ? company.website : `https://${company.website}`}
                    target="_blank" rel="noopener noreferrer"
                    className="hover:text-primary transition-colors flex items-center gap-1 truncate"
                  >
                    {company.website}<ExternalLink className="h-3 w-3 shrink-0" />
                  </a>
                </div>
              )}
              {(company.address || company.postalCode || company.city) && (
                <div className="flex items-start gap-2 text-sm sm:col-span-2">
                  <MapPin className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                  <div className="text-muted-foreground">
                    {company.address && <p>{company.address}</p>}
                    <p>
                      {[company.postalCode, company.city].filter(Boolean).join(" ")}
                      {company.country && company.country !== "France" ? `, ${company.country}` : ""}
                    </p>
                  </div>
                </div>
              )}
            </div>
            {(company.siret || company.vatNumber) && (
              <div className="pt-2 border-t border-border/50 space-y-1.5">
                {company.siret && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">SIRET</span>
                    <span className="font-mono text-xs">{company.siret}</span>
                  </div>
                )}
                {company.vatNumber && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">N° TVA</span>
                    <span className="font-mono text-xs">{company.vatNumber}</span>
                  </div>
                )}
              </div>
            )}
            {company.notes && (
              <div className="pt-2 border-t border-border/50">
                <p className="text-xs text-muted-foreground mb-1">Notes</p>
                <p className="text-sm whitespace-pre-wrap">{company.notes}</p>
              </div>
            )}
            {!company.email && !company.phone && !company.website && !company.address
              && !company.siret && !company.vatNumber && !company.notes && (
              <p className="text-sm text-muted-foreground italic">Aucune information renseignée</p>
            )}
          </div>

          {/* Factures */}
          {invoices.length > 0 && (
            <div className="rounded-xl border border-border/50 bg-card overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-border/50">
                <div className="flex items-center gap-2">
                  <Receipt className="h-4 w-4 text-muted-foreground" />
                  <h2 className="font-semibold text-sm">
                    Factures
                    <span className="text-muted-foreground font-normal ml-1.5">({nbInvoices})</span>
                  </h2>
                </div>
                <Link href="/facturation/factures" className="text-xs text-primary hover:underline">
                  Voir toutes
                </Link>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50 text-xs text-muted-foreground">
                    <th className="px-5 py-2.5 text-left font-medium">Numéro</th>
                    <th className="px-5 py-2.5 text-left font-medium hidden sm:table-cell">Projet</th>
                    <th className="px-5 py-2.5 text-left font-medium">Statut</th>
                    <th className="px-5 py-2.5 text-right font-medium">Total HT</th>
                    <th className="px-5 py-2.5 text-right font-medium hidden md:table-cell">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.slice(0, 8).map((inv) => (
                    <tr key={inv.id} className="border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="px-5 py-3">
                        <Link
                          href={`/facturation/factures/${inv.id}`}
                          className="font-mono text-xs text-primary hover:underline"
                        >
                          {inv.number}
                        </Link>
                        {inv.client && (
                          <p className="text-xs text-muted-foreground mt-0.5">{inv.client.name}</p>
                        )}
                      </td>
                      <td className="px-5 py-3 text-muted-foreground hidden sm:table-cell">
                        {inv.project ? (
                          <Link href={`/projets/${inv.project.id}`} className="hover:text-primary transition-colors">
                            {inv.project.name}
                          </Link>
                        ) : "—"}
                      </td>
                      <td className="px-5 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${invoiceStatusColor[inv.status] ?? "text-muted-foreground bg-muted"}`}>
                          {invoiceStatusLabel[inv.status] ?? inv.status}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right font-medium tabular-nums">
                        {fmt(netAmount(inv))} €
                      </td>
                      <td className="px-5 py-3 text-right text-muted-foreground text-xs hidden md:table-cell">
                        {fmtDate(inv.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Devis */}
          {quotes.length > 0 && (
            <div className="rounded-xl border border-border/50 bg-card overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-border/50">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <h2 className="font-semibold text-sm">
                    Devis
                    <span className="text-muted-foreground font-normal ml-1.5">({nbQuotes})</span>
                  </h2>
                </div>
                <Link href="/facturation/devis" className="text-xs text-primary hover:underline">
                  Voir tous
                </Link>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50 text-xs text-muted-foreground">
                    <th className="px-5 py-2.5 text-left font-medium">Numéro</th>
                    <th className="px-5 py-2.5 text-left font-medium hidden sm:table-cell">Projet</th>
                    <th className="px-5 py-2.5 text-left font-medium">Statut</th>
                    <th className="px-5 py-2.5 text-right font-medium">Total HT</th>
                    <th className="px-5 py-2.5 text-right font-medium hidden md:table-cell">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {quotes.slice(0, 6).map((q) => (
                    <tr key={q.id} className="border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="px-5 py-3">
                        <Link
                          href={`/facturation/devis/${q.id}`}
                          className="font-mono text-xs text-primary hover:underline"
                        >
                          {q.number}
                        </Link>
                        {q.client && (
                          <p className="text-xs text-muted-foreground mt-0.5">{q.client.name}</p>
                        )}
                      </td>
                      <td className="px-5 py-3 text-muted-foreground hidden sm:table-cell">
                        {q.project ? (
                          <Link href={`/projets/${q.project.id}`} className="hover:text-primary transition-colors">
                            {q.project.name}
                          </Link>
                        ) : "—"}
                      </td>
                      <td className="px-5 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${quoteStatusColor[q.status] ?? "text-muted-foreground bg-muted"}`}>
                          {quoteStatusLabel[q.status] ?? q.status}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right font-medium tabular-nums">
                        {fmt(q.totalHT)} €
                      </td>
                      <td className="px-5 py-3 text-right text-muted-foreground text-xs hidden md:table-cell">
                        {fmtDate(q.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Contacts */}
          <div className="rounded-xl border border-border/50 bg-card overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border/50">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <h2 className="font-semibold text-sm">
                  Contacts
                  <span className="text-muted-foreground font-normal ml-1.5">({company._count.contacts})</span>
                </h2>
              </div>
              <NewContactForCompanyButton userId={userId} company={{ id: company.id, name: company.name }} />
            </div>
            {company.contacts.length === 0 ? (
              <div className="px-5 py-8 text-center">
                <p className="text-sm text-muted-foreground">Aucun contact associé</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <tbody>
                  {company.contacts.map((c) => (
                    <tr key={c.id} className="border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="px-5 py-3">
                        <Link href={`/contacts/${c.id}`} className="font-medium hover:text-primary transition-colors">
                          {c.name}
                        </Link>
                        {c.email && <p className="text-xs text-muted-foreground mt-0.5">{c.email}</p>}
                      </td>
                      <td className="px-5 py-3 text-muted-foreground text-right text-xs">{c.phone ?? ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Tâches */}
          {tasks.length > 0 && (
            <div className="rounded-xl border border-border/50 bg-card overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-border/50">
                <div className="flex items-center gap-2">
                  <ListTodo className="h-4 w-4 text-muted-foreground" />
                  <h2 className="font-semibold text-sm">
                    Tâches en cours
                    <span className="text-muted-foreground font-normal ml-1.5">({tasks.length})</span>
                  </h2>
                </div>
              </div>
              <div className="divide-y divide-border/50">
                {tasks.map((t) => (
                  <div key={t.id} className="flex items-center gap-3 px-5 py-3 hover:bg-muted/30 transition-colors">
                    {/* Priorité */}
                    <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${
                      t.priority === "URGENT" ? "bg-red-500" :
                      t.priority === "HIGH"   ? "bg-amber-500" :
                      t.priority === "MEDIUM" ? "bg-blue-400" :
                      "bg-muted-foreground/40"
                    }`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">{t.title}</p>
                      {(t.project || t.client) && (
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">
                          {t.project ? (
                            <Link href={`/projets/${t.project.id}`} className="hover:text-primary transition-colors">
                              {t.project.name}
                            </Link>
                          ) : t.client?.name}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {t.dueDate && (
                        <span className={`text-xs ${new Date(t.dueDate) < new Date() ? "text-red-500 font-medium" : "text-muted-foreground"}`}>
                          {fmtDate(t.dueDate)}
                        </span>
                      )}
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        t.status === "IN_PROGRESS" ? "text-blue-600 bg-blue-500/10" : "text-muted-foreground bg-muted"
                      }`}>
                        {t.status === "IN_PROGRESS" ? "En cours" : "À faire"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Projets */}
          <div className="rounded-xl border border-border/50 bg-card overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border/50">
              <div className="flex items-center gap-2">
                <FolderOpen className="h-4 w-4 text-muted-foreground" />
                <h2 className="font-semibold text-sm">
                  Projets
                  <span className="text-muted-foreground font-normal ml-1.5">({company._count.projects})</span>
                </h2>
              </div>
              <NewProjectForCompanyButton
                userId={userId}
                companyId={company.id}
                companies={allCompanies}
                contacts={allContacts}
              />
            </div>
            {company.projects.length === 0 ? (
              <div className="px-5 py-8 text-center">
                <p className="text-sm text-muted-foreground">Aucun projet associé</p>
              </div>
            ) : (
              <div className="divide-y divide-border/50">
                {company.projects.map((p) => (
                  <div key={p.id} className="flex items-center justify-between px-5 py-3 hover:bg-muted/30 transition-colors gap-3">
                    <div className="min-w-0">
                      <Link href={`/projets/${p.id}`} className="text-sm font-medium hover:text-primary transition-colors">
                        {p.name}
                      </Link>
                      {(p.startDate || p.endDate) && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {p.startDate ? fmtDate(p.startDate) : ""}
                          {p.startDate && p.endDate ? " → " : ""}
                          {p.endDate ? fmtDate(p.endDate) : ""}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {p.estimatedHours != null && p.estimatedHours > 0 && (
                        <span className="text-xs text-muted-foreground">{p.estimatedHours} h</span>
                      )}
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${projectStatusColor[p.status] ?? "text-muted-foreground bg-muted"}`}>
                        {projectStatusLabel[p.status] ?? p.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* ── Colonne droite ── */}
        <div className="space-y-6">

          {/* Candidatures liées (ESN / RECRUTEMENT) */}
          {linkedApplications.length > 0 && (
            <div className="rounded-xl border border-border/50 bg-card p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-sm">Candidatures</h2>
                <Link href="/entretiens" className="text-xs text-primary hover:underline">Voir tout →</Link>
              </div>
              <div className="space-y-1.5">
                {linkedApplications.map((a) => {
                  const cfg = STATUS_CONFIG[a.status as JobAppStatus] ?? STATUS_CONFIG.WISHLIST
                  return (
                    <Link key={a.id} href={`/entretiens/${a.id}`}
                      className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-muted/50 transition-colors"
                    >
                      <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${cfg.dot}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{a.position}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{a.companyName}</p>
                      </div>
                      <span className={`text-[10px] rounded-full border px-1.5 py-0.5 shrink-0 ${cfg.cls}`}>
                        {cfg.short}
                      </span>
                    </Link>
                  )
                })}
              </div>
            </div>
          )}

          {/* Bilan financier */}
          <div className="rounded-xl border border-border/50 bg-card p-5 space-y-4">
            <h2 className="font-semibold text-sm flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              Bilan financier
            </h2>

            {nbInvoices === 0 && nbQuotes === 0 ? (
              <p className="text-sm text-muted-foreground italic">Aucune facturation</p>
            ) : (
              <div className="space-y-2.5">
                {totalPaid > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground flex items-center gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                      CA encaissé
                    </span>
                    <span className="font-semibold text-emerald-600">{fmt(totalPaid)} €</span>
                  </div>
                )}
                {totalBilled > 0 && totalBilled !== totalPaid && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Total émis</span>
                    <span className="font-medium">{fmt(totalBilled)} €</span>
                  </div>
                )}
                {totalPending > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 text-blue-500" />
                      En attente
                    </span>
                    <span className="font-medium text-blue-600">{fmt(totalPending)} €</span>
                  </div>
                )}
                {totalLate > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground flex items-center gap-1.5">
                      <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
                      En retard
                    </span>
                    <span className="font-semibold text-red-600">{fmt(totalLate)} €</span>
                  </div>
                )}

                <div className="border-t border-border/50 pt-2.5 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Factures</span>
                    <span className="font-medium">{nbInvoices}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Devis</span>
                    <span className="font-medium">{nbQuotes}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Activité */}
          <div className="rounded-xl border border-border/50 bg-card p-5 space-y-3">
            <h2 className="font-semibold text-sm">Activité</h2>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5" /> Contacts
                </span>
                <span className="font-medium">{company._count.contacts}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <FolderOpen className="h-3.5 w-3.5" /> Projets
                </span>
                <span className="font-medium">{company._count.projects}</span>
              </div>
              {(projectsByStatus["ACTIVE"] ?? 0) > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground pl-5">En cours</span>
                  <span className="font-medium text-emerald-600">{projectsByStatus["ACTIVE"]}</span>
                </div>
              )}
              {(projectsByStatus["COMPLETED"] ?? 0) > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground pl-5">Terminés</span>
                  <span className="font-medium text-blue-600">{projectsByStatus["COMPLETED"]}</span>
                </div>
              )}
              {totalEstimatedH > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground pl-5">Heures estimées</span>
                  <span className="font-medium">{totalEstimatedH} h</span>
                </div>
              )}
            </div>
          </div>

          {/* Sources fiscales */}
          {(company.fiscalSource || usedFiscalSources.length > 0) && (
            <div className="rounded-xl border border-border/50 bg-card p-5 space-y-3">
              <h2 className="font-semibold text-sm">Sources fiscales</h2>
              <div className="space-y-2">
                {/* Source par défaut (champ direct sur la société) */}
                {company.fiscalSource && (
                  <div className="flex items-center gap-2.5">
                    <span
                      className="h-2.5 w-2.5 rounded-full shrink-0 ring-2 ring-border"
                      style={{ backgroundColor: company.fiscalSource.color }}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium leading-tight">{company.fiscalSource.name}</p>
                      <p className="text-[10px] text-muted-foreground">{FISCAL_BUCKET_LABELS[company.fiscalSource.bucket] ?? company.fiscalSource.bucket}</p>
                    </div>
                    <span className="text-[10px] text-muted-foreground bg-muted border border-border px-1.5 py-0.5 rounded font-mono shrink-0">défaut</span>
                  </div>
                )}
                {/* Autres sources utilisées via facturation (profils émetteurs) */}
                {usedFiscalSources
                  .filter(fs => fs.id !== company.fiscalSource?.id)
                  .map(fs => (
                    <div key={fs.id} className="flex items-center gap-2.5">
                      <span
                        className="h-2.5 w-2.5 rounded-full shrink-0 ring-2 ring-border"
                        style={{ backgroundColor: fs.color }}
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-medium leading-tight">{fs.name}</p>
                        <p className="text-[10px] text-muted-foreground">{FISCAL_BUCKET_LABELS[fs.bucket] ?? fs.bucket}</p>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Danger zone */}
          <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-5 space-y-3">
            <h2 className="font-semibold text-sm text-destructive">Zone dangereuse</h2>
            <p className="text-xs text-muted-foreground">
              La suppression détache contacts et projets, mais ne les supprime pas.
            </p>
            <form
              action={async () => {
                "use server"
                await deleteCompany(id)
                redirect("/societes")
              }}
            >
              <Button type="submit" variant="destructive" size="sm" className="w-full gap-1.5">
                <Trash2 className="h-3.5 w-3.5" />
                Supprimer cette société
              </Button>
            </form>
          </div>

        </div>
      </div>
    </div>
  )
}

// ── Constantes ────────────────────────────────────────────────────────────────

const FISCAL_BUCKET_LABELS: Record<string, string> = {
  AE_URSSAF:     "AE — Déclaré URSSAF",
  NON_IMPOSABLE: "Non imposable",
  OTHER:         "Autre",
}

// ── Composant KPI ─────────────────────────────────────────────────────────────

function KpiCard({
  icon, label, value, sub, color,
}: {
  icon: React.ReactNode
  label: string
  value: string
  sub?: string
  color: "emerald" | "blue" | "red" | "amber" | "muted"
}) {
  const valueColor = {
    emerald: "text-emerald-600",
    blue: "text-blue-600",
    red: "text-red-600",
    amber: "text-amber-600",
    muted: "text-foreground",
  }[color]

  return (
    <div className="rounded-xl border border-border/50 bg-card p-4 space-y-1">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon}
        {label}
      </div>
      <p className={`text-xl font-bold tabular-nums ${valueColor}`}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  )
}
