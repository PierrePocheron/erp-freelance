"use client"

import { useState, useMemo, useCallback } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Receipt, LayoutGrid, List, Download, Search, X } from "lucide-react"
import { useSortState, cmp } from "@/hooks/use-sortable"
import { Th } from "@/components/ui/sortable-header"
import { CreateInvoiceDialog } from "./CreateInvoiceDialog"
import { ImportInvoiceModal } from "./ImportInvoiceModal"
import { RevenueBars } from "./MonthlyRevenueChart"

type Invoice = {
  id: string
  number: string
  type: string
  status: string
  totalHT: number
  depositDeducted: number
  dueDate: Date | null
  issuedAt: Date | null
  sentAt: Date | null
  paidAt: Date | null
  createdAt: Date
  clientId: string
  projectId: string | null
  client: { name: string; company: string | null; companyId: string | null }
  project: { id: string; name: string; companyId: string | null } | null
  payments: { amount: number; paidAt: Date | string }[]
}

/** Numéro affiché avec le préfixe FA (les anciens numéros « 250701 » n'en
 *  ont pas en base ; on l'ajoute à l'affichage sans le dupliquer). */
function displayNumber(number: string): string {
  return /^fa/i.test(number.trim()) ? number : `FA${number}`
}

const fmtEur = (n: number) =>
  n.toLocaleString("fr-FR", {
    minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
    maximumFractionDigits: 2,
  }) + " €"
const fmtDay = (d: Date | string) => new Date(d).toLocaleDateString("fr-FR")

/** Récapitulatif des encaissements d'une facture : montant total réglé + date(s)
 *  des versements. Gère les cas exceptionnels (impayé, paiement partiel, plusieurs
 *  versements étalés dans le temps). Vert = soldée, ambre = partiel. */
function PaidInfo({
  payments,
  net,
  status,
  align = "left",
}: {
  payments: { amount: number; paidAt: Date | string }[]
  net: number
  status: string
  align?: "left" | "right"
}) {
  const paid = payments.reduce((s, p) => s + p.amount, 0)
  const full = status === "PAID" || (paid > 0 && paid >= net - 0.01)
  const alignCls = align === "right" ? "text-right items-end" : ""

  if (payments.length === 0) {
    // Aucun versement enregistré : soit soldée sans détail, soit impayée
    return status === "PAID" ? (
      <span className="text-emerald-600 text-xs font-medium">Payée</span>
    ) : (
      <span className="text-muted-foreground/40 text-xs">Non réglée</span>
    )
  }

  return (
    <div className={`flex flex-col gap-0.5 ${alignCls}`}>
      <span className={`text-xs font-medium ${full ? "text-emerald-600" : "text-amber-600"}`}>
        {fmtEur(paid)}
        {!full && <span className="text-muted-foreground/70 font-normal"> / {fmtEur(net)}</span>}
      </span>
      <span className="text-[11px] text-muted-foreground leading-tight">
        {payments.map((p, i) => (
          <span key={i} className="block">
            {payments.length > 1 && `${fmtEur(p.amount)} · `}
            {fmtDay(p.paidAt)}
          </span>
        ))}
      </span>
    </div>
  )
}

type Company = { id: string; name: string; city: string | null }
type Client = { id: string; name: string; company: string | null; type: string; companyId: string | null }
type Project = { id: string; name: string; clientId: string | null; companyId: string | null }
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

/** Clé "YYYY-MM" du mois de référence d'une facture : encaissement (paidAt),
 *  sinon date d'émission — jamais createdAt en priorité, qui ne reflète que la
 *  date d'insertion en base (import, re-seed) et pas la vie de la facture. */
function invoiceMonthKey(inv: Invoice): string {
  const d = new Date(inv.paidAt ?? inv.issuedAt ?? inv.createdAt)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

/** Date de référence d'une facture pour le tri et le filtre par année :
 *  émission (soumission) en priorité, puis envoi, puis createdAt en dernier
 *  recours. createdAt ne reflète que l'insertion en base (import / re-seed) et
 *  ne doit jamais servir à ordonner ou classer les factures par année. */
function invoiceRefDate(inv: Invoice): Date {
  return new Date(inv.issuedAt ?? inv.sentAt ?? inv.createdAt)
}

function monthKeyLabel(key: string): string {
  const [y, m] = key.split("-").map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString("fr-FR", { month: "long", year: "numeric" })
}

export function FacturesListView({
  userId,
  invoices,
  clients,
  companies = [],
  projects,
  quotes = [],
}: {
  userId: string
  invoices: Invoice[]
  clients: Client[]
  companies?: Company[]
  projects: Project[]
  quotes?: Quote[]
}) {
  const [view, setView] = useState<"list" | "cards">("list")
  const [q, setQ] = useState("")
  const { sortCol, sortDir, toggle } = useSortState("issued", "desc")

  // Date de référence figée au premier rendu (règle react-hooks/purity)
  const [now] = useState(() => new Date())
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth()
  const [chartYear, setChartYear] = useState(currentYear)

  // ── Filtres pilotés par l'URL (source de vérité) ─────────────────────────
  // ?statut= ?projet= ?client= ?societe= ?mois=YYYY-MM[,YYYY-MM…]
  // Mise à jour en shallow routing (history.replaceState) : pas d'aller-retour
  // serveur, mais une URL partageable et des arrivées contextuelles possibles
  // depuis les fiches projet / client / société.
  const searchParams = useSearchParams()
  const statusFilter = searchParams.get("statut") ?? "ALL"
  const projectFilter = searchParams.get("projet")
  const clientFilter = searchParams.get("client")
  const societeFilter = searchParams.get("societe")
  const monthsFilter = useMemo(
    () => (searchParams.get("mois")?.split(",").filter(Boolean) ?? []),
    [searchParams]
  )
  const yearFilter = searchParams.get("annee")

  // Années présentes dans les factures (pour le filtre par année) — basées sur
  // la date d'émission de la facture, pas sur createdAt.
  const availableYears = useMemo(() => {
    const set = new Set(invoices.map((inv) => String(invoiceRefDate(inv).getFullYear())))
    return [...set].sort((a, b) => b.localeCompare(a))
  }, [invoices])

  const setParam = useCallback((key: string, value: string | null) => {
    const params = new URLSearchParams(window.location.search)
    if (value === null) params.delete(key)
    else params.set(key, value)
    const qs = params.toString()
    window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname)
  }, [])

  function toggleMonth(key: string, shift: boolean) {
    let next: string[]
    if (shift) {
      next = monthsFilter.includes(key)
        ? monthsFilter.filter((k) => k !== key)
        : [...monthsFilter, key]
    } else {
      next = monthsFilter.length === 1 && monthsFilter[0] === key ? [] : [key]
    }
    setParam("mois", next.length ? next.join(",") : null)
  }

  const hasFilters =
    statusFilter !== "ALL" || !!projectFilter || !!clientFilter || !!societeFilter || !!yearFilter || monthsFilter.length > 0 || q.trim() !== ""

  function resetFilters() {
    setQ("")
    window.history.replaceState(null, "", window.location.pathname)
  }

  // ── Application des filtres ───────────────────────────────────────────────
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return invoices.filter((inv) => {
      if (statusFilter !== "ALL" && inv.status !== statusFilter) return false
      if (projectFilter && inv.projectId !== projectFilter) return false
      if (clientFilter && inv.clientId !== clientFilter) return false
      if (societeFilter && inv.client.companyId !== societeFilter && inv.project?.companyId !== societeFilter) return false
      if (yearFilter && String(invoiceRefDate(inv).getFullYear()) !== yearFilter) return false
      if (monthsFilter.length > 0 && !monthsFilter.includes(invoiceMonthKey(inv))) return false
      if (needle) {
        const haystack = [inv.number, inv.client.name, inv.client.company ?? "", inv.project?.name ?? ""]
          .join(" ")
          .toLowerCase()
        if (!haystack.includes(needle)) return false
      }
      return true
    })
  }, [invoices, statusFilter, projectFilter, clientFilter, societeFilter, yearFilter, monthsFilter, q])

  const sorted = useMemo(() => {
    if (!sortCol) return filtered
    return [...filtered].sort((a, b) => {
      switch (sortCol) {
        case "number":  return cmp(a.number, b.number, sortDir)
        case "client":  return cmp(a.client.company ?? a.client.name, b.client.company ?? b.client.name, sortDir)
        case "project": return cmp(a.project?.name ?? "", b.project?.name ?? "", sortDir)
        case "type":    return cmp(a.type, b.type, sortDir)
        case "status":  return cmp(a.status, b.status, sortDir)
        case "amount":  return cmp(a.totalHT - a.depositDeducted, b.totalHT - b.depositDeducted, sortDir)
        case "issued":  return cmp(invoiceRefDate(a), invoiceRefDate(b), sortDir)
        case "sent":    return cmp(a.sentAt ? new Date(a.sentAt) : null, b.sentAt ? new Date(b.sentAt) : null, sortDir)
        case "dueDate": return cmp(a.dueDate ? new Date(a.dueDate) : null, b.dueDate ? new Date(b.dueDate) : null, sortDir)
        default: return 0
      }
    })
  }, [filtered, sortCol, sortDir])

  // Données du graphique : encaissements de l'année affichée, calculés
  // client-side depuis les factures déjà chargées (mêmes règles que la vue
  // d'ensemble : factures PAID, mois de paidAt — issuedAt en secours, jamais
  // createdAt qui ne reflète que la date d'insertion en base).
  const minYear = useMemo(
    () => invoices.reduce((min, inv) => {
      const d = inv.paidAt ?? inv.issuedAt
      return d ? Math.min(min, new Date(d).getFullYear()) : min
    }, currentYear),
    [invoices, currentYear]
  )
  const chartData = useMemo(() => {
    const arr = Array(12).fill(0) as number[]
    for (const inv of invoices) {
      if (inv.status !== "PAID") continue
      const date = inv.paidAt ?? inv.issuedAt
      if (!date) continue
      const d = new Date(date)
      if (d.getFullYear() !== chartYear) continue
      arr[d.getMonth()] += inv.totalHT - inv.depositDeducted
    }
    return arr
  }, [invoices, chartYear])

  // Libellés des filtres contextuels actifs (chips)
  const projectName = projectFilter ? projects.find((p) => p.id === projectFilter)?.name ?? "Projet inconnu" : null
  const clientName = clientFilter ? clients.find((c) => c.id === clientFilter)?.name ?? "Client inconnu" : null
  const societeName = societeFilter ? companies.find((c) => c.id === societeFilter)?.name ?? "Société inconnue" : null

  // L'export CSV porte tous les filtres actifs : il exporte ce que le tableau affiche
  const exportHref = useMemo(() => {
    const params = new URLSearchParams()
    if (statusFilter !== "ALL") params.set("status", statusFilter)
    if (projectFilter) params.set("projet", projectFilter)
    if (clientFilter) params.set("client", clientFilter)
    if (societeFilter) params.set("societe", societeFilter)
    if (monthsFilter.length > 0) params.set("mois", monthsFilter.join(","))
    if (q.trim()) params.set("q", q.trim())
    const qs = params.toString()
    return `/api/export/factures${qs ? `?${qs}` : ""}`
  }, [statusFilter, projectFilter, clientFilter, societeFilter, monthsFilter, q])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-semibold">Factures</h2>
          <p className="text-sm text-muted-foreground">{filtered.length} / {invoices.length} facture{invoices.length !== 1 ? "s" : ""}</p>
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
            href={exportHref}
            download
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-muted transition-colors"
            title="Exporter en CSV (filtres actifs inclus)"
          >
            <Download className="h-3.5 w-3.5" />
            CSV
          </a>
          <ImportInvoiceModal userId={userId} clients={clients} projects={projects} />
          <CreateInvoiceDialog userId={userId} clients={clients} companies={companies} projects={projects} quotes={quotes} />
        </div>
      </div>

      {/* ── Graphique mensuel interactif : clic = filtre mois, Maj+clic = multi ── */}
      <RevenueBars
        data={chartData}
        year={chartYear}
        currentYear={currentYear}
        currentMonth={currentMonth}
        onYearChange={(delta) => setChartYear((y) => y + delta)}
        canPrev={chartYear > minYear}
        canNext={chartYear < currentYear}
        selectedKeys={monthsFilter}
        onMonthClick={toggleMonth}
        clickHint="Clic : filtrer ce mois · Maj+clic : multi-sélection"
      />

      {/* ── Barre de filtres ─────────────────────────────────────────────── */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Recherche */}
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

          {/* Projet */}
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

          {/* Client */}
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

          {/* Année — toutes dates par défaut, filtrage optionnel */}
          <select
            className="rounded-lg border border-border px-2.5 py-1.5 text-xs bg-background text-foreground"
            value={yearFilter ?? ""}
            onChange={(e) => setParam("annee", e.target.value || null)}
          >
            <option value="">Toutes les années</option>
            {availableYears.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>

          {/* Statut — select en mobile, boutons en sm+ */}
          <select
            className="sm:hidden rounded-lg border border-border px-2.5 py-1.5 text-xs bg-background text-foreground"
            value={statusFilter}
            onChange={(e) => setParam("statut", e.target.value === "ALL" ? null : e.target.value)}
          >
            {STATUS_FILTERS.map((f) => (
              <option key={f.value} value={f.value}>{f.label}</option>
            ))}
          </select>
          <div className="hidden sm:flex rounded-lg border border-border overflow-hidden text-xs">
            {STATUS_FILTERS.map((f) => (
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
                    ({invoices.filter((i) => i.status === f.value).length})
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

        {/* Chips des filtres contextuels actifs */}
        {(projectName || clientName || societeName || yearFilter || monthsFilter.length > 0) && (
          <div className="flex items-center gap-1.5 flex-wrap text-xs">
            {yearFilter && (
              <FilterChip label={`Année : ${yearFilter}`} onRemove={() => setParam("annee", null)} />
            )}
            {projectName && (
              <FilterChip label={`Projet : ${projectName}`} onRemove={() => setParam("projet", null)} />
            )}
            {clientName && (
              <FilterChip label={`Client : ${clientName}`} onRemove={() => setParam("client", null)} />
            )}
            {societeName && (
              <FilterChip label={`Société : ${societeName}`} onRemove={() => setParam("societe", null)} />
            )}
            {[...monthsFilter].sort().map((key) => (
              <FilterChip key={key} label={monthKeyLabel(key)} onRemove={() => toggleMonth(key, true)} />
            ))}
          </div>
        )}
      </div>

      {invoices.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-20 text-center">
          <Receipt className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="font-medium">Aucune facture</p>
          <p className="text-sm text-muted-foreground mt-1">Créez votre première facture</p>
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground italic text-center py-10">
          Aucune facture pour ces filtres
        </p>
      ) : view === "list" ? (
        <div className="rounded-xl border border-border/50 bg-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <Th label="Numéro"    col="number"    sortCol={sortCol} sortDir={sortDir} onSort={toggle} className="px-4 py-3" />
                <Th label="Client"    col="client"    sortCol={sortCol} sortDir={sortDir} onSort={toggle} className="px-4 py-3" />
                <Th label="Projet"    col="project"   sortCol={sortCol} sortDir={sortDir} onSort={toggle} className="px-4 py-3 hidden lg:table-cell" />
                <Th label="Type"      col="type"      sortCol={sortCol} sortDir={sortDir} onSort={toggle} className="px-4 py-3 hidden sm:table-cell" />
                <Th label="Statut"    col="status"    sortCol={sortCol} sortDir={sortDir} onSort={toggle} className="px-4 py-3" />
                <Th label="Montant HT" col="amount"  sortCol={sortCol} sortDir={sortDir} onSort={toggle} className="px-4 py-3" align="right" />
                <th className="px-4 py-3 text-left font-medium text-muted-foreground whitespace-nowrap">Payé</th>
                <Th label="Émise le"  col="issued"    sortCol={sortCol} sortDir={sortDir} onSort={toggle} className="px-4 py-3 hidden md:table-cell" />
                <Th label="Envoyée"   col="sent"      sortCol={sortCol} sortDir={sortDir} onSort={toggle} className="px-4 py-3 hidden xl:table-cell" />
                <Th label="Échéance"  col="dueDate"   sortCol={sortCol} sortDir={sortDir} onSort={toggle} className="px-4 py-3 hidden lg:table-cell" />
              </tr>
            </thead>
            <tbody>
              {sorted.map((inv) => {
                const status = statusConfig[inv.status] ?? { label: inv.status, cls: "bg-muted text-muted-foreground border-border" }
                const isLate = inv.dueDate && inv.status === "SENT" && new Date(inv.dueDate) < new Date()
                return (
                  <tr key={inv.id} className={`border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors ${isLate ? "bg-red-500/5" : ""}`}>
                    <td className="px-4 py-3">
                      <Link href={`/facturation/factures/${inv.id}`} className="text-primary hover:underline font-mono text-xs font-medium">{displayNumber(inv.number)}</Link>
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/contacts/${inv.clientId}`} className="text-muted-foreground hover:text-primary hover:underline transition-colors">
                        {inv.client.company ?? inv.client.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-xs hidden lg:table-cell">
                      {inv.project ? (
                        <Link href={`/projets/${inv.project.id}`} className="text-muted-foreground hover:text-primary hover:underline transition-colors">
                          {inv.project.name}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground/50">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground hidden sm:table-cell">{typeLabels[inv.type] ?? inv.type}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${status.cls}`}>{status.label}</span>
                    </td>
                    <td className="px-4 py-3 text-right font-medium">
                      {(inv.totalHT - inv.depositDeducted).toLocaleString("fr-FR")} €
                    </td>
                    <td className="px-4 py-3">
                      <PaidInfo payments={inv.payments} net={inv.totalHT - inv.depositDeducted} status={inv.status} />
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground hidden md:table-cell">
                      {inv.issuedAt ? fmtDay(inv.issuedAt) : <span className="text-muted-foreground/40">—</span>}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground hidden xl:table-cell">
                      {inv.sentAt ? fmtDay(inv.sentAt) : <span className="text-muted-foreground/40">—</span>}
                    </td>
                    <td className={`px-4 py-3 text-xs hidden lg:table-cell ${isLate ? "text-red-500 font-medium" : "text-muted-foreground"}`}>
                      {inv.dueDate ? fmtDay(inv.dueDate) : "—"}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {sorted.map((inv) => {
            const status = statusConfig[inv.status] ?? { label: inv.status, cls: "bg-muted text-muted-foreground border-border" }
            const isLate = inv.dueDate && inv.status === "SENT" && new Date(inv.dueDate) < new Date()
            const amount = inv.totalHT - inv.depositDeducted
            return (
              // La carte entière est cliquable via un overlay, pour que client et
              // projet restent des liens propres (pas de <a> imbriqués).
              <div
                key={inv.id}
                className={`relative rounded-xl border bg-card p-4 hover:shadow-sm transition-all space-y-3 ${isLate ? "border-red-500/40 bg-red-500/5" : "border-border/50 hover:border-border"}`}
              >
                <Link
                  href={`/facturation/factures/${inv.id}`}
                  className="absolute inset-0 rounded-xl"
                  aria-label={`Facture ${displayNumber(inv.number)}`}
                />
                <div className="flex items-start justify-between gap-2">
                  <span className="font-mono text-xs font-semibold text-muted-foreground">{displayNumber(inv.number)}</span>
                  <div className="flex gap-1 flex-wrap justify-end">
                    <span className="rounded-full bg-muted text-muted-foreground px-2 py-0.5 text-xs font-medium">
                      {typeLabels[inv.type] ?? inv.type}
                    </span>
                    <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${status.cls}`}>{status.label}</span>
                  </div>
                </div>
                <div>
                  <Link
                    href={`/contacts/${inv.clientId}`}
                    className="relative z-10 font-semibold text-sm leading-tight hover:text-primary hover:underline transition-colors"
                  >
                    {inv.client.company ?? inv.client.name}
                  </Link>
                  {inv.project && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      <Link
                        href={`/projets/${inv.project.id}`}
                        className="relative z-10 hover:text-primary hover:underline transition-colors"
                      >
                        {inv.project.name}
                      </Link>
                    </p>
                  )}
                </div>
                <div className="pt-1 border-t border-border/50 space-y-1">
                  <div className="flex items-end justify-between">
                    <span className={`text-xl font-bold tabular-nums ${isLate ? "text-red-600" : ""}`}>
                      {amount.toLocaleString("fr-FR")} €
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {inv.issuedAt ? `émise le ${fmtDay(inv.issuedAt)}` : inv.sentAt ? `envoyée le ${fmtDay(inv.sentAt)}` : ""}
                    </span>
                  </div>
                  {inv.dueDate && (
                    <p className={`text-xs text-right ${isLate ? "text-red-500 font-medium" : "text-muted-foreground"}`}>
                      échéance {new Date(inv.dueDate).toLocaleDateString("fr-FR")}
                    </p>
                  )}
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[11px] uppercase tracking-wide text-muted-foreground/70">Payé</span>
                    <PaidInfo payments={inv.payments} net={amount} status={inv.status} align="right" />
                  </div>
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
