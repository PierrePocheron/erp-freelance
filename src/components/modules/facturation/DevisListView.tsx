"use client"

import { useState, useMemo, useCallback } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { FileText, LayoutGrid, List, Download, Search, X } from "lucide-react"
import { useSortState, cmp } from "@/hooks/use-sortable"
import { Th } from "@/components/ui/sortable-header"
import { CreateQuoteDialog } from "./CreateQuoteDialog"

type Quote = {
  id: string
  number: string
  status: string
  totalHT: number
  depositPercent: number
  createdAt: Date
  client: { id: string; name: string; company: string | null; companyId: string | null }
  project: { id: string; name: string; companyId: string | null } | null
  _count: { lines: number }
}

type Company = { id: string; name: string; city: string | null }
type Client = { id: string; name: string; company: string | null; type: string; companyId: string | null }
type Project = { id: string; name: string; clientId: string | null; companyId: string | null }
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

const DEVIS_FILTERS = [
  { value: "ALL", label: "Tous" },
  { value: "DRAFT", label: "Brouillon" },
  { value: "SENT", label: "Envoyés" },
  { value: "ACCEPTED", label: "Acceptés" },
  { value: "SIGNED", label: "Signés" },
  { value: "REJECTED", label: "Refusés" },
]

export function DevisListView({
  userId,
  quotes,
  clients,
  companies = [],
  projects,
  products,
  defaultConditions,
}: {
  userId: string
  quotes: Quote[]
  clients: Client[]
  companies?: Company[]
  projects: Project[]
  products: Product[]
  defaultConditions: string
}) {
  const [view, setView] = useState<"list" | "cards">("list")
  const [q, setQ] = useState("")
  const { sortCol, sortDir, toggle } = useSortState("createdAt", "desc")

  // ── Filtres pilotés par l'URL — même mécanique que la liste des factures ──
  const searchParams = useSearchParams()
  const statusFilter = searchParams.get("statut") ?? "ALL"
  const projectFilter = searchParams.get("projet")
  const clientFilter = searchParams.get("client")
  const societeFilter = searchParams.get("societe")

  const setParam = useCallback((key: string, value: string | null) => {
    const params = new URLSearchParams(window.location.search)
    if (value === null) params.delete(key)
    else params.set(key, value)
    const qs = params.toString()
    window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname)
  }, [])

  const hasFilters = statusFilter !== "ALL" || !!projectFilter || !!clientFilter || !!societeFilter || q.trim() !== ""

  function resetFilters() {
    setQ("")
    window.history.replaceState(null, "", window.location.pathname)
  }

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return quotes.filter((quote) => {
      if (statusFilter !== "ALL" && quote.status !== statusFilter) return false
      if (projectFilter && quote.project?.id !== projectFilter) return false
      if (clientFilter && quote.client.id !== clientFilter) return false
      if (societeFilter && quote.client.companyId !== societeFilter && quote.project?.companyId !== societeFilter) return false
      if (needle) {
        const haystack = [quote.number, quote.client.name, quote.client.company ?? "", quote.project?.name ?? ""]
          .join(" ")
          .toLowerCase()
        if (!haystack.includes(needle)) return false
      }
      return true
    })
  }, [quotes, statusFilter, projectFilter, clientFilter, societeFilter, q])

  const sorted = useMemo(() => {
    if (!sortCol) return filtered
    return [...filtered].sort((a, b) => {
      switch (sortCol) {
        case "number":    return cmp(a.number, b.number, sortDir)
        case "client":    return cmp(a.client.company ?? a.client.name, b.client.company ?? b.client.name, sortDir)
        case "project":   return cmp(a.project?.name ?? null, b.project?.name ?? null, sortDir)
        case "status":    return cmp(a.status, b.status, sortDir)
        case "totalHT":   return cmp(a.totalHT, b.totalHT, sortDir)
        case "createdAt": return cmp(new Date(a.createdAt), new Date(b.createdAt), sortDir)
        default: return 0
      }
    })
  }, [filtered, sortCol, sortDir])

  // Libellés des filtres contextuels actifs (chips)
  const projectName = projectFilter ? projects.find((p) => p.id === projectFilter)?.name ?? "Projet inconnu" : null
  const clientName = clientFilter ? clients.find((c) => c.id === clientFilter)?.name ?? "Client inconnu" : null
  const societeName = societeFilter ? companies.find((c) => c.id === societeFilter)?.name ?? "Société inconnue" : null

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-semibold">Devis</h2>
          <p className="text-sm text-muted-foreground">{filtered.length} / {quotes.length} devis</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
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
            companies={companies}
            projects={projects}
            products={products}
            defaultConditions={defaultConditions}
          />
        </div>
      </div>

      {/* ── Barre de filtres ─────────────────────────────────────────────── */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="N°, client, projet…"
              className="w-full rounded-lg border border-border bg-background pl-8 pr-2.5 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          <select
            className="rounded-lg border border-border px-2.5 py-1.5 text-xs bg-background text-foreground max-w-[180px]"
            value={projectFilter ?? ""}
            onChange={(e) => setParam("projet", e.target.value || null)}
          >
            <option value="">Tous les projets</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>

          <select
            className="rounded-lg border border-border px-2.5 py-1.5 text-xs bg-background text-foreground max-w-[180px]"
            value={clientFilter ?? ""}
            onChange={(e) => setParam("client", e.target.value || null)}
          >
            <option value="">Tous les clients</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.company ? `${c.name} — ${c.company}` : c.name}</option>
            ))}
          </select>

          {/* Statut — select en mobile, boutons en sm+ */}
          <select
            className="sm:hidden rounded-lg border border-border px-2.5 py-1.5 text-xs bg-background text-foreground"
            value={statusFilter}
            onChange={(e) => setParam("statut", e.target.value === "ALL" ? null : e.target.value)}
          >
            {DEVIS_FILTERS.map((f) => (
              <option key={f.value} value={f.value}>{f.label}</option>
            ))}
          </select>
          <div className="hidden sm:flex rounded-lg border border-border overflow-hidden text-xs">
            {DEVIS_FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => setParam("statut", f.value === "ALL" ? null : f.value)}
                className={`px-3 py-1.5 border-r last:border-r-0 border-border transition-colors ${
                  statusFilter === f.value ? "bg-accent font-medium" : "text-muted-foreground hover:bg-muted/50"
                }`}
              >
                {f.label}
                {f.value !== "ALL" && (
                  <span className="ml-1 text-[10px] opacity-60">
                    ({quotes.filter((quote) => quote.status === f.value).length})
                  </span>
                )}
              </button>
            ))}
          </div>

          {hasFilters && (
            <button
              onClick={resetFilters}
              className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <X className="h-3 w-3" />
              Réinitialiser
            </button>
          )}
        </div>

        {(projectName || clientName || societeName) && (
          <div className="flex items-center gap-1.5 flex-wrap text-xs">
            {projectName && <FilterChip label={`Projet : ${projectName}`} onRemove={() => setParam("projet", null)} />}
            {clientName && <FilterChip label={`Client : ${clientName}`} onRemove={() => setParam("client", null)} />}
            {societeName && <FilterChip label={`Société : ${societeName}`} onRemove={() => setParam("societe", null)} />}
          </div>
        )}
      </div>

      {quotes.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-20 text-center">
          <FileText className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="font-medium">Aucun devis</p>
          <p className="text-sm text-muted-foreground mt-1">Créez votre premier devis</p>
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground italic text-center py-10">
          Aucun devis pour ces filtres
        </p>
      ) : view === "list" ? (
        <div className="rounded-xl border border-border/50 bg-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <Th label="Numéro"   col="number"    sortCol={sortCol} sortDir={sortDir} onSort={toggle} className="px-4 py-3" />
                <Th label="Client"   col="client"    sortCol={sortCol} sortDir={sortDir} onSort={toggle} className="px-4 py-3" />
                <Th label="Projet"   col="project"   sortCol={sortCol} sortDir={sortDir} onSort={toggle} className="px-4 py-3 hidden sm:table-cell" />
                <Th label="Statut"   col="status"    sortCol={sortCol} sortDir={sortDir} onSort={toggle} className="px-4 py-3" />
                <Th label="Total HT" col="totalHT"   sortCol={sortCol} sortDir={sortDir} onSort={toggle} className="px-4 py-3" align="right" />
                <Th label="Date"     col="createdAt" sortCol={sortCol} sortDir={sortDir} onSort={toggle} className="px-4 py-3 hidden sm:table-cell" />
              </tr>
            </thead>
            <tbody>
              {sorted.map((quote) => {
                const status = statusConfig[quote.status] ?? { label: quote.status, cls: "bg-muted text-muted-foreground border-border" }
                return (
                  <tr key={quote.id} className="border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <Link href={`/facturation/devis/${quote.id}`} className="text-primary hover:underline font-mono text-xs font-medium">{quote.number}</Link>
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/contacts/${quote.client.id}`} className="text-muted-foreground hover:text-primary hover:underline transition-colors">
                        {quote.client.company ?? quote.client.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-xs hidden sm:table-cell">
                      {quote.project ? (
                        <Link href={`/projets/${quote.project.id}`} className="text-muted-foreground hover:text-primary hover:underline transition-colors">
                          {quote.project.name}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground/50">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${status.cls}`}>{status.label}</span>
                    </td>
                    <td className="px-4 py-3 text-right font-medium">{quote.totalHT.toLocaleString("fr-FR")} €</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground hidden sm:table-cell">
                      {new Date(quote.createdAt).toLocaleDateString("fr-FR")}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {sorted.map((quote) => {
            const status = statusConfig[quote.status] ?? { label: quote.status, cls: "bg-muted text-muted-foreground border-border" }
            return (
              // Carte cliquable via un overlay — les liens client/projet restent
              // des <a> propres, pas d'ancres imbriquées (HTML invalide).
              <div
                key={quote.id}
                className="relative rounded-xl border border-border/50 bg-card p-4 hover:border-border hover:shadow-sm transition-all space-y-3"
              >
                <Link
                  href={`/facturation/devis/${quote.id}`}
                  className="absolute inset-0 rounded-xl"
                  aria-label={`Devis ${quote.number}`}
                />
                <div className="flex items-start justify-between gap-2">
                  <span className="font-mono text-xs font-semibold text-muted-foreground">{quote.number}</span>
                  <span className={`rounded-full border px-2 py-0.5 text-xs font-medium shrink-0 ${status.cls}`}>{status.label}</span>
                </div>
                <div>
                  <Link
                    href={`/contacts/${quote.client.id}`}
                    className="relative z-10 font-semibold text-sm leading-tight hover:text-primary hover:underline transition-colors"
                  >
                    {quote.client.company ?? quote.client.name}
                  </Link>
                  {quote.project && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      <Link
                        href={`/projets/${quote.project.id}`}
                        className="relative z-10 hover:text-primary hover:underline transition-colors"
                      >
                        {quote.project.name}
                      </Link>
                    </p>
                  )}
                </div>
                <div className="flex items-end justify-between pt-1 border-t border-border/50">
                  <span className="text-xl font-bold tabular-nums">{quote.totalHT.toLocaleString("fr-FR")} €</span>
                  <span className="text-xs text-muted-foreground">{new Date(quote.createdAt).toLocaleDateString("fr-FR")}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 text-primary px-2.5 py-0.5 font-medium">
      {label}
      <button onClick={onRemove} className="hover:bg-primary/20 rounded-full p-0.5 transition-colors" title="Retirer ce filtre">
        <X className="h-3 w-3" />
      </button>
    </span>
  )
}
