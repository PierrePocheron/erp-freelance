import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import Link from "next/link"
import { CreateInvoiceDialog } from "@/components/modules/facturation/CreateInvoiceDialog"
import { Receipt } from "lucide-react"

const statusConfig = {
  DRAFT: { label: "Brouillon", cls: "bg-muted text-muted-foreground border-border" },
  SENT: { label: "Envoyée", cls: "bg-blue-500/15 text-blue-600 border-blue-500/20" },
  PAID: { label: "Payée", cls: "bg-emerald-500/15 text-emerald-600 border-emerald-500/20" },
  LATE: { label: "En retard", cls: "bg-red-500/15 text-red-600 border-red-500/20" },
}

const typeLabels: Record<string, string> = {
  DEPOSIT: "Acompte",
  FINAL: "Solde",
  RECURRING: "Récurrent",
  STANDALONE: "Standard",
}

export default async function FacturesListPage() {
  const session = await auth()
  const userId = session!.user.id

  const [invoices, clients, projects] = await Promise.all([
    prisma.invoice.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: {
        client: { select: { name: true, company: true } },
        project: { select: { name: true } },
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
          <h2 className="text-xl font-semibold">Factures</h2>
          <p className="text-sm text-muted-foreground">{invoices.length} facture{invoices.length !== 1 ? "s" : ""}</p>
        </div>
        <CreateInvoiceDialog userId={userId} clients={clients} projects={projects} />
      </div>

      {invoices.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-20 text-center">
          <Receipt className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="font-medium">Aucune facture</p>
          <p className="text-sm text-muted-foreground mt-1">Créez votre première facture</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border/50 bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground">
                <th className="px-4 py-3 text-left font-medium">Numéro</th>
                <th className="px-4 py-3 text-left font-medium">Client</th>
                <th className="px-4 py-3 text-left font-medium">Type</th>
                <th className="px-4 py-3 text-left font-medium">Statut</th>
                <th className="px-4 py-3 text-right font-medium">Montant HT</th>
                <th className="px-4 py-3 text-left font-medium">Échéance</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => {
                const status = statusConfig[inv.status as keyof typeof statusConfig]
                const isLate = inv.dueDate && inv.status === "SENT" && new Date(inv.dueDate) < new Date()
                return (
                  <tr key={inv.id} className={`border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors ${isLate ? "bg-red-500/5" : ""}`}>
                    <td className="px-4 py-3">
                      <Link href={`/facturation/factures/${inv.id}`} className="text-primary hover:underline font-mono text-xs font-medium">{inv.number}</Link>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{inv.client.company ?? inv.client.name}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{typeLabels[inv.type] ?? inv.type}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${status.cls}`}>{status.label}</span>
                    </td>
                    <td className="px-4 py-3 text-right font-medium">
                      {(inv.totalHT - inv.depositDeducted).toLocaleString("fr-FR")} €
                    </td>
                    <td className={`px-4 py-3 text-xs ${isLate ? "text-red-500 font-medium" : "text-muted-foreground"}`}>
                      {inv.dueDate ? new Date(inv.dueDate).toLocaleDateString("fr-FR") : "—"}
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
