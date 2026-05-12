"use client"

import { useState } from "react"
import Link from "next/link"
import { FileText, LayoutGrid, List, Download } from "lucide-react"
import { CreateQuoteDialog } from "./CreateQuoteDialog"

type Quote = {
  id: string
  number: string
  status: string
  totalHT: number
  depositPercent: number
  createdAt: Date
  client: { name: string; company: string | null }
  project: { name: string } | null
  _count: { lines: number }
}

type Client = { id: string; name: string; company: string | null; type: string }
type Project = { id: string; name: string; clientId: string }
type Product = { id: string; name: string; description: string | null; unitPrice: number; unit: string; isActive: boolean; billingType: string; defaultTaxRate: number }

const statusConfig: Record<string, { label: string; cls: string }> = {
  DRAFT: { label: "Brouillon", cls: "bg-muted text-muted-foreground border-border" },
  VALIDATED: { label: "Validé", cls: "bg-violet-500/15 text-violet-600 border-violet-500/20" },
  SENT: { label: "Envoyé", cls: "bg-blue-500/15 text-blue-600 border-blue-500/20" },
  WAITING_DEPOSIT: { label: "Attente acompte", cls: "bg-amber-500/15 text-amber-600 border-amber-500/20" },
  DEPOSIT_RECEIVED: { label: "Acompte reçu", cls: "bg-emerald-500/15 text-emerald-600 border-emerald-500/20" },
  ACCEPTED: { label: "Accepté", cls: "bg-emerald-500/15 text-emerald-600 border-emerald-500/20" },
  IN_PROGRESS: { label: "En cours", cls: "bg-indigo-500/15 text-indigo-600 border-indigo-500/20" },
  SIGNED: { label: "Signé", cls: "bg-teal-500/15 text-teal-600 border-teal-500/20" },
  REJECTED: { label: "Refusé", cls: "bg-red-500/15 text-red-600 border-red-500/20" },
}

export function DevisListView({
  userId,
  quotes,
  clients,
  projects,
  products,
  defaultConditions,
}: {
  userId: string
  quotes: Quote[]
  clients: Client[]
  projects: Project[]
  products: Product[]
  defaultConditions: string
}) {
  const [view, setView] = useState<"list" | "cards">("list")
  const [statusFilter, setStatusFilter] = useState("ALL")

  const DEVIS_FILTERS = [
    { value: "ALL", label: "Tous" },
    { value: "DRAFT", label: "Brouillon" },
    { value: "SENT", label: "Envoyés" },
    { value: "ACCEPTED", label: "Acceptés" },
    { value: "SIGNED", label: "Signés" },
    { value: "REJECTED", label: "Refusés" },
  ]

  const filtered = statusFilter === "ALL" ? quotes : quotes.filter((q) => q.status === statusFilter)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-semibold">Devis</h2>
          <p className="text-sm text-muted-foreground">{filtered.length} / {quotes.length} devis</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex rounded-lg border border-border overflow-hidden text-xs">
            {DEVIS_FILTERS.map((f) => (
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
                    ({quotes.filter((q) => q.status === f.value).length})
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
            href="/api/export/devis"
            download
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted/50 transition-colors"
            title="Exporter en CSV"
          >
            <Download className="h-3.5 w-3.5" />
            CSV
          </a>
          <CreateQuoteDialog
            userId={userId}
            clients={clients}
            projects={projects}
            products={products}
            defaultConditions={defaultConditions}
          />
        </div>
      </div>

      {quotes.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-20 text-center">
          <FileText className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="font-medium">Aucun devis</p>
          <p className="text-sm text-muted-foreground mt-1">Créez votre premier devis</p>
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground italic text-center py-10">
          Aucun devis pour ce filtre
        </p>
      ) : view === "list" ? (
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
              {filtered.map((q) => {
                const status = statusConfig[q.status] ?? { label: q.status, cls: "bg-muted text-muted-foreground border-border" }
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
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((q) => {
            const status = statusConfig[q.status] ?? { label: q.status, cls: "bg-muted text-muted-foreground border-border" }
            return (
              <Link
                key={q.id}
                href={`/facturation/devis/${q.id}`}
                className="rounded-xl border border-border/50 bg-card p-4 hover:border-border hover:shadow-sm transition-all space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-mono text-xs font-semibold text-muted-foreground">{q.number}</span>
                  <span className={`rounded-full border px-2 py-0.5 text-xs font-medium shrink-0 ${status.cls}`}>{status.label}</span>
                </div>
                <div>
                  <p className="font-semibold text-sm leading-tight">{q.client.company ?? q.client.name}</p>
                  {q.project && (
                    <p className="text-xs text-muted-foreground mt-0.5">{q.project.name}</p>
                  )}
                </div>
                <div className="flex items-end justify-between pt-1 border-t border-border/50">
                  <span className="text-xl font-bold tabular-nums">{q.totalHT.toLocaleString("fr-FR")} €</span>
                  <span className="text-xs text-muted-foreground">{new Date(q.createdAt).toLocaleDateString("fr-FR")}</span>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
