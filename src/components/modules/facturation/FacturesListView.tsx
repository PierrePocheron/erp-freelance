"use client"

import { useState } from "react"
import Link from "next/link"
import { Receipt, LayoutGrid, List, Download } from "lucide-react"
import { CreateInvoiceDialog } from "./CreateInvoiceDialog"

type Invoice = {
  id: string
  number: string
  type: string
  status: string
  totalHT: number
  depositDeducted: number
  dueDate: Date | null
  createdAt: Date
  client: { name: string; company: string | null }
  project: { name: string } | null
}

type Client = { id: string; name: string; company: string | null; type: string }
type Project = { id: string; name: string; clientId: string }
type Quote = { id: string; number: string; clientId: string; projectId: string | null; totalHT: number; depositPercent: number; status: string; client: { name: string; company: string | null } }

const statusConfig: Record<string, { label: string; cls: string }> = {
  DRAFT: { label: "Brouillon", cls: "bg-muted text-muted-foreground border-border" },
  ISSUED: { label: "Émise", cls: "bg-violet-500/15 text-violet-600 border-violet-500/20" },
  SENT: { label: "Envoyée", cls: "bg-blue-500/15 text-blue-600 border-blue-500/20" },
  PAID: { label: "Payée", cls: "bg-emerald-500/15 text-emerald-600 border-emerald-500/20" },
  LATE: { label: "En retard", cls: "bg-red-500/15 text-red-600 border-red-500/20" },
  CANCELLED: { label: "Annulée", cls: "bg-muted text-muted-foreground border-border line-through" },
}

const typeLabels: Record<string, string> = {
  DEPOSIT: "Acompte",
  FINAL: "Solde",
  RECURRING: "Récurrent",
  STANDALONE: "Standard",
}

const STATUS_FILTERS = [
  { value: "ALL", label: "Toutes" },
  { value: "DRAFT", label: "Brouillon" },
  { value: "ISSUED", label: "Émises" },
  { value: "SENT", label: "Envoyées" },
  { value: "LATE", label: "En retard" },
  { value: "PAID", label: "Payées" },
  { value: "CANCELLED", label: "Annulées" },
]

export function FacturesListView({
  userId,
  invoices,
  clients,
  projects,
  quotes = [],
}: {
  userId: string
  invoices: Invoice[]
  clients: Client[]
  projects: Project[]
  quotes?: Quote[]
}) {
  const [view, setView] = useState<"list" | "cards">("list")
  const [statusFilter, setStatusFilter] = useState("ALL")

  const filtered = statusFilter === "ALL" ? invoices : invoices.filter((i) => i.status === statusFilter)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-semibold">Factures</h2>
          <p className="text-sm text-muted-foreground">{filtered.length} / {invoices.length} facture{invoices.length !== 1 ? "s" : ""}</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Status filters */}
          <div className="flex rounded-lg border border-border overflow-hidden text-xs">
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => setStatusFilter(f.value)}
                className={`px-3 py-1.5 border-r last:border-r-0 border-border transition-colors ${
                  statusFilter === f.value ? "bg-accent font-medium" : "text-muted-foreground hover:bg-muted/50"
                }`}
              >
                {f.label}
                {f.value !== "ALL" && (
                  <span className="ml-1 text-[10px] opacity-60">
                    ({invoices.filter((i) => i.status === f.value).length})
                  </span>
                )}
              </button>
            ))}
          </div>
          <div className="flex rounded-lg border border-border overflow-hidden">
            <button
              type="button"
              onClick={() => setView("list")}
              className={`px-2.5 py-1.5 transition-colors ${view === "list" ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              title="Vue liste"
            >
              <List className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setView("cards")}
              className={`px-2.5 py-1.5 border-l border-border transition-colors ${view === "cards" ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              title="Vue cartes"
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
          </div>
          <a
            href={`/api/export/factures${statusFilter !== "ALL" ? `?status=${statusFilter}` : ""}`}
            download
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-muted transition-colors"
            title="Exporter en CSV"
          >
            <Download className="h-3.5 w-3.5" />
            CSV
          </a>
          <CreateInvoiceDialog userId={userId} clients={clients} projects={projects} quotes={quotes} />
        </div>
      </div>

      {invoices.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-20 text-center">
          <Receipt className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="font-medium">Aucune facture</p>
          <p className="text-sm text-muted-foreground mt-1">Créez votre première facture</p>
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground italic text-center py-10">
          Aucune facture pour ce filtre
        </p>
      ) : view === "list" ? (
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
              {filtered.map((inv) => {
                const status = statusConfig[inv.status] ?? { label: inv.status, cls: "bg-muted text-muted-foreground border-border" }
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
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((inv) => {
            const status = statusConfig[inv.status] ?? { label: inv.status, cls: "bg-muted text-muted-foreground border-border" }
            const isLate = inv.dueDate && inv.status === "SENT" && new Date(inv.dueDate) < new Date()
            const amount = inv.totalHT - inv.depositDeducted
            return (
              <Link
                key={inv.id}
                href={`/facturation/factures/${inv.id}`}
                className={`rounded-xl border bg-card p-4 hover:shadow-sm transition-all space-y-3 ${isLate ? "border-red-500/40 bg-red-500/5" : "border-border/50 hover:border-border"}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-mono text-xs font-semibold text-muted-foreground">{inv.number}</span>
                  <div className="flex gap-1 flex-wrap justify-end">
                    <span className="rounded-full bg-muted text-muted-foreground px-2 py-0.5 text-xs font-medium">
                      {typeLabels[inv.type] ?? inv.type}
                    </span>
                    <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${status.cls}`}>{status.label}</span>
                  </div>
                </div>
                <div>
                  <p className="font-semibold text-sm leading-tight">{inv.client.company ?? inv.client.name}</p>
                  {inv.project && (
                    <p className="text-xs text-muted-foreground mt-0.5">{inv.project.name}</p>
                  )}
                </div>
                <div className="flex items-end justify-between pt-1 border-t border-border/50">
                  <span className={`text-xl font-bold tabular-nums ${isLate ? "text-red-600" : ""}`}>
                    {amount.toLocaleString("fr-FR")} €
                  </span>
                  <span className={`text-xs ${isLate ? "text-red-500 font-medium" : "text-muted-foreground"}`}>
                    {inv.dueDate ? new Date(inv.dueDate).toLocaleDateString("fr-FR") : new Date(inv.createdAt).toLocaleDateString("fr-FR")}
                  </span>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
