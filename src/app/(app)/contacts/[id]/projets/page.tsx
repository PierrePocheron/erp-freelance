import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { notFound } from "next/navigation"
import Link from "next/link"
import { Code2, ExternalLink } from "lucide-react"
import { CreateProjectDialog } from "@/components/modules/projet/CreateProjectDialog"

const statusConfig = {
  ACTIVE: { label: "Actif", className: "bg-emerald-500/15 text-emerald-600 border-emerald-500/20" },
  PAUSED: { label: "En pause", className: "bg-amber-500/15 text-amber-600 border-amber-500/20" },
  COMPLETED: { label: "Terminé", className: "bg-blue-500/15 text-blue-600 border-blue-500/20" },
  ARCHIVED: { label: "Archivé", className: "bg-muted text-muted-foreground border-border" },
}

export default async function ClientProjetsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const session = await auth()
  const userId = session!.user.id

  const [client, allCompanies, allContacts] = await Promise.all([
  prisma.client.findFirst({
    where: { id, userId: session!.user.id },
    include: {
      projects: {
        orderBy: { createdAt: "desc" },
        include: {
          tasks: { select: { status: true }, where: { parentTaskId: null } },
        },
      },
      quotes: { orderBy: { createdAt: "desc" }, select: { id: true, number: true, status: true, totalHT: true, createdAt: true } },
      invoices: { orderBy: { createdAt: "desc" }, select: { id: true, number: true, status: true, totalHT: true, createdAt: true } },
    },
  }),
  prisma.company.findMany({
    where: { userId },
    orderBy: { name: "asc" },
    select: { id: true, name: true, city: true },
  }),
  prisma.client.findMany({
    where: { userId },
    orderBy: [{ name: "asc" }],
    select: { id: true, name: true, company: true, companyId: true },
  }),
  ])

  if (!client) notFound()

  return (
    <div className="space-y-8">
      {/* Projets */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Projets</h2>
          <CreateProjectDialog
            userId={userId}
            companies={allCompanies}
            contacts={allContacts}
            defaultCompanyId={client.companyId ?? undefined}
          />
        </div>
        {client.projects.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun projet pour ce client</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {client.projects.map((p) => {
              const done = p.tasks.filter((t) => t.status === "DONE").length
              const status = statusConfig[p.status as keyof typeof statusConfig]
              return (
                <Link key={p.id} href={`/projets/${p.id}`}>
                  <div className="group flex items-center gap-3 rounded-xl border border-border/50 bg-card p-4 hover:border-border hover:shadow-sm transition-all">
                    <Code2 className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium group-hover:text-primary truncate">{p.name}</p>
                      <p className="text-xs text-muted-foreground">{done}/{p.tasks.length} tâches</p>
                    </div>
                    <span className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium ${status.className}`}>
                      {status.label}
                    </span>
                    <ExternalLink className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </section>

      {/* Devis */}
      {client.quotes.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Devis</h2>
          <div className="rounded-xl border border-border/50 bg-card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th className="px-4 py-2.5 text-left font-medium">Numéro</th>
                  <th className="px-4 py-2.5 text-left font-medium">Statut</th>
                  <th className="px-4 py-2.5 text-right font-medium">Total HT</th>
                  <th className="px-4 py-2.5 text-left font-medium">Date</th>
                </tr>
              </thead>
              <tbody>
                {client.quotes.map((q) => (
                  <tr key={q.id} className="border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-2.5">
                      <Link href={`/facturation/devis/${q.id}`} className="text-primary hover:underline font-mono text-xs">{q.number}</Link>
                    </td>
                    <td className="px-4 py-2.5">
                      <QuoteStatusBadge status={q.status} />
                    </td>
                    <td className="px-4 py-2.5 text-right font-medium">{q.totalHT.toLocaleString("fr-FR")} €</td>
                    <td className="px-4 py-2.5 text-muted-foreground text-xs">
                      {new Date(q.createdAt).toLocaleDateString("fr-FR")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Factures */}
      {client.invoices.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Factures</h2>
          <div className="rounded-xl border border-border/50 bg-card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th className="px-4 py-2.5 text-left font-medium">Numéro</th>
                  <th className="px-4 py-2.5 text-left font-medium">Statut</th>
                  <th className="px-4 py-2.5 text-right font-medium">Total HT</th>
                  <th className="px-4 py-2.5 text-left font-medium">Date</th>
                </tr>
              </thead>
              <tbody>
                {client.invoices.map((inv) => (
                  <tr key={inv.id} className="border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-2.5">
                      <Link href={`/facturation/factures/${inv.id}`} className="text-primary hover:underline font-mono text-xs">{inv.number}</Link>
                    </td>
                    <td className="px-4 py-2.5">
                      <InvoiceStatusBadge status={inv.status} />
                    </td>
                    <td className="px-4 py-2.5 text-right font-medium">{inv.totalHT.toLocaleString("fr-FR")} €</td>
                    <td className="px-4 py-2.5 text-muted-foreground text-xs">
                      {new Date(inv.createdAt).toLocaleDateString("fr-FR")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  )
}

function QuoteStatusBadge({ status }: { status: string }) {
  const config: Record<string, string> = {
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
  const labels: Record<string, string> = {
    DRAFT: "Brouillon", VALIDATED: "Validé", SENT: "Envoyé",
    WAITING_DEPOSIT: "Attente acompte", DEPOSIT_RECEIVED: "Acompte reçu",
    ACCEPTED: "Accepté", IN_PROGRESS: "En cours", SIGNED: "Signé", REJECTED: "Refusé",
  }
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${config[status] ?? "bg-muted text-muted-foreground"}`}>{labels[status] ?? status}</span>
}

function InvoiceStatusBadge({ status }: { status: string }) {
  const config: Record<string, string> = {
    DRAFT: "bg-muted text-muted-foreground",
    SENT: "bg-blue-500/15 text-blue-600",
    PAID: "bg-emerald-500/15 text-emerald-600",
    LATE: "bg-red-500/15 text-red-600",
  }
  const labels: Record<string, string> = { DRAFT: "Brouillon", SENT: "Envoyée", PAID: "Payée", LATE: "En retard" }
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${config[status] ?? ""}`}>{labels[status] ?? status}</span>
}
