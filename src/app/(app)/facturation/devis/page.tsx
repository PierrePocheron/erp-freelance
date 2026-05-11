import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import Link from "next/link"
import { CreateQuoteDialog } from "@/components/modules/facturation/CreateQuoteDialog"
import { FileText } from "lucide-react"

const statusConfig = {
  DRAFT: { label: "Brouillon", cls: "bg-muted text-muted-foreground border-border" },
  SENT: { label: "Envoyé", cls: "bg-blue-500/15 text-blue-600 border-blue-500/20" },
  ACCEPTED: { label: "Accepté", cls: "bg-emerald-500/15 text-emerald-600 border-emerald-500/20" },
  REJECTED: { label: "Refusé", cls: "bg-red-500/15 text-red-600 border-red-500/20" },
}

export default async function DevisListPage() {
  const session = await auth()
  const userId = session!.user.id

  const [quotes, clients, projects] = await Promise.all([
    prisma.quote.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: {
        client: { select: { name: true, company: true } },
        project: { select: { name: true } },
        _count: { select: { lines: true } },
      },
    }),
    prisma.client.findMany({
      where: { userId, type: { not: "SELF" } },
      orderBy: { name: "asc" },
      select: { id: true, name: true, company: true, type: true },
    }),
    prisma.project.findMany({
      where: { userId },
      orderBy: { name: "asc" },
      select: { id: true, name: true, clientId: true },
    }),
  ])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Devis</h2>
          <p className="text-sm text-muted-foreground">{quotes.length} devis</p>
        </div>
        <CreateQuoteDialog userId={userId} clients={clients} projects={projects} />
      </div>

      {quotes.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-20 text-center">
          <FileText className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="font-medium">Aucun devis</p>
          <p className="text-sm text-muted-foreground mt-1">Créez votre premier devis</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border/50 bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground">
                <th className="px-4 py-3 text-left font-medium">Numéro</th>
                <th className="px-4 py-3 text-left font-medium">Client</th>
                <th className="px-4 py-3 text-left font-medium">Projet</th>
                <th className="px-4 py-3 text-left font-medium">Statut</th>
                <th className="px-4 py-3 text-right font-medium">Total HT</th>
                <th className="px-4 py-3 text-left font-medium">Date</th>
              </tr>
            </thead>
            <tbody>
              {quotes.map((q) => {
                const status = statusConfig[q.status as keyof typeof statusConfig]
                return (
                  <tr key={q.id} className="border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <Link href={`/facturation/devis/${q.id}`} className="text-primary hover:underline font-mono text-xs font-medium">{q.number}</Link>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{q.client.company ?? q.client.name}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{q.project?.name ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${status.cls}`}>{status.label}</span>
                    </td>
                    <td className="px-4 py-3 text-right font-medium">{q.totalHT.toLocaleString("fr-FR")} €</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {new Date(q.createdAt).toLocaleDateString("fr-FR")}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
