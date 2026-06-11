"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { ChevronLeft, ChevronRight, FileDown, Users, CalendarDays } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"

// ── Types ──────────────────────────────────────────────────────────────────────

type FiscalSourceMeta = {
  id:                string
  name:              string
  bucket:            string
  color:             string
  emitterProfileIds: string[]
}

type RevenueEntry = {
  id:             string
  label:          string
  amount:         number
  status:         string
  period:         string
  receivedAt:     string | null
  fiscalSourceId: string | null
  clientName:     string | null
  clientCompany:  string | null
  projectName:    string | null
}

type InvoiceEntry = {
  id:             string
  number:         string
  totalHT:        number   // net après dépôt
  paidAt:         string
  fiscalSourceId: string
  clientName:     string | null
  clientCompany:  string | null
  projectName:    string | null
}

// ── Constants ──────────────────────────────────────────────────────────────────

const MONTHS = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
]

const BUCKET_LABELS: Record<string, string> = {
  AE_URSSAF:     "AE — Déclaré URSSAF",
  NON_IMPOSABLE: "Non imposable",
  OTHER:         "Autre",
}

const BUCKET_BADGE: Record<string, string> = {
  AE_URSSAF:     "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  NON_IMPOSABLE: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  OTHER:         "bg-slate-500/15 text-slate-600 dark:text-slate-400",
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return n.toLocaleString("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })
}

function periodToMonthIndex(period: string): number {
  const parts = period.split("-")
  if (parts.length < 2) return -1
  return parseInt(parts[1]) - 1
}

function paidAtToMonthIndex(paidAt: string): number {
  return new Date(paidAt).getMonth()
}

/** Nom d'affichage du client : "Prénom Nom · Société" ou juste l'un ou l'autre */
function clientDisplayName(clientName: string | null, clientCompany: string | null): string {
  if (clientName && clientCompany && clientCompany !== clientName) return `${clientName} · ${clientCompany}`
  return clientName ?? clientCompany ?? "Sans client"
}

// ── Aggregation types ──────────────────────────────────────────────────────────

type LineItem = {
  id:          string
  kind:        "invoice" | "revenue"
  label:       string          // numéro facture ou libellé revenu
  projectName: string | null
  amount:      number
  date:        string          // paidAt ou period/receivedAt
  href?:       string
}

type ClientGroup = {
  clientKey:    string          // clientName·clientCompany
  clientName:   string | null
  clientCompany: string | null
  total:        number
  lines:        LineItem[]
}

// ── Main component ─────────────────────────────────────────────────────────────

export function FiscalSummary({
  year,
  fiscalSources,
  revenues,
  paidInvoices,
}: {
  year:          number
  fiscalSources: FiscalSourceMeta[]
  revenues:      RevenueEntry[]
  paidInvoices:  InvoiceEntry[]
}) {
  const router = useRouter()
  const [expandedSource, setExpandedSource] = useState<string | null>(null)
  const [detailView, setDetailView] = useState<"monthly" | "clients">("monthly")

  // ── Agrégation mensuelle (vue mensuelle) ──────────────────────────────────

  type MonthDetail = { label: string; amount: number }
  type MonthData = { total: number; details: MonthDetail[] }
  type SourceGrid = { months: MonthData[]; yearTotal: number }

  const grids = new Map<string, SourceGrid>()

  for (const src of fiscalSources) {
    const months: MonthData[] = Array.from({ length: 12 }, () => ({ total: 0, details: [] }))

    for (const r of revenues) {
      if (r.fiscalSourceId !== src.id) continue
      const mi = r.period ? periodToMonthIndex(r.period) : (r.receivedAt ? paidAtToMonthIndex(r.receivedAt) : -1)
      if (mi < 0 || mi > 11) continue
      months[mi].total += r.amount
      months[mi].details.push({ label: r.label, amount: r.amount })
    }

    for (const inv of paidInvoices) {
      if (inv.fiscalSourceId !== src.id) continue
      const mi = paidAtToMonthIndex(inv.paidAt)
      if (mi < 0 || mi > 11) continue
      months[mi].total += inv.totalHT
      months[mi].details.push({ label: `Facture ${inv.number}`, amount: inv.totalHT })
    }

    const yearTotal = months.reduce((s, m) => s + m.total, 0)
    grids.set(src.id, { months, yearTotal })
  }

  // ── Agrégation par client (vue clients) ───────────────────────────────────

  const clientGroups = new Map<string, Map<string, ClientGroup>>()  // sourceId → clientKey → group

  for (const src of fiscalSources) {
    const groups = new Map<string, ClientGroup>()

    for (const inv of paidInvoices) {
      if (inv.fiscalSourceId !== src.id) continue
      const key = `${inv.clientName ?? ""}|${inv.clientCompany ?? ""}`
      if (!groups.has(key)) {
        groups.set(key, {
          clientKey:    key,
          clientName:   inv.clientName,
          clientCompany: inv.clientCompany,
          total: 0,
          lines: [],
        })
      }
      const g = groups.get(key)!
      g.total += inv.totalHT
      g.lines.push({
        id:          inv.id,
        kind:        "invoice",
        label:       `Facture ${inv.number}`,
        projectName: inv.projectName,
        amount:      inv.totalHT,
        date:        inv.paidAt,
        href:        `/facturation/factures/${inv.id}`,
      })
    }

    for (const r of revenues) {
      if (r.fiscalSourceId !== src.id) continue
      const key = `${r.clientName ?? ""}|${r.clientCompany ?? ""}`
      if (!groups.has(key)) {
        groups.set(key, {
          clientKey:    key,
          clientName:   r.clientName,
          clientCompany: r.clientCompany,
          total: 0,
          lines: [],
        })
      }
      const g = groups.get(key)!
      g.total += r.amount
      g.lines.push({
        id:          r.id,
        kind:        "revenue",
        label:       r.label,
        projectName: r.projectName,
        amount:      r.amount,
        date:        r.receivedAt ?? `${r.period}-01`,
      })
    }

    // Trier les groupes par total décroissant
    const sorted = new Map([...groups.entries()].sort((a, b) => b[1].total - a[1].total))
    clientGroups.set(src.id, sorted)
  }

  // ── Totaux ─────────────────────────────────────────────────────────────────

  const grandTotal = [...grids.values()].reduce((s, g) => s + g.yearTotal, 0)
  const activeSources = fiscalSources.filter(src => (grids.get(src.id)?.yearTotal ?? 0) > 0)
  const emptySources  = fiscalSources.filter(src => (grids.get(src.id)?.yearTotal ?? 0) === 0)

  // ── Export texte enrichi ───────────────────────────────────────────────────
  function handleExport() {
    const lines: string[] = [`Récapitulatif fiscal ${year}`, ""]
    for (const src of activeSources) {
      const grid = grids.get(src.id)!
      lines.push(`=== ${src.name} (${BUCKET_LABELS[src.bucket] ?? src.bucket}) ===`)
      lines.push(`  Total : ${fmt(grid.yearTotal)} €`)
      lines.push("")

      // Détail par client
      const groups = clientGroups.get(src.id)
      if (groups) {
        for (const g of groups.values()) {
          lines.push(`  ▸ ${clientDisplayName(g.clientName, g.clientCompany)} — ${fmt(g.total)} €`)
          for (const line of g.lines) {
            const proj = line.projectName ? ` [${line.projectName}]` : ""
            lines.push(`      ${line.label}${proj}   ${fmt(line.amount)} €   ${fmtDate(line.date)}`)
          }
          lines.push("")
        }
      }
    }
    lines.push(`TOTAL GÉNÉRAL : ${fmt(grandTotal)} €`)
    navigator.clipboard.writeText(lines.join("\n"))
    alert("Récapitulatif copié dans le presse-papiers ✓")
  }

  return (
    <div className="space-y-6">

      {/* ── Navigation année + vue toggle ──────────────────────────────── */}
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={() => router.push(`/revenus/recapitulatif?year=${year - 1}`)}
          className="rounded-md border border-border p-1.5 hover:bg-accent transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-lg font-bold tabular-nums w-16 text-center">{year}</span>
        <button
          onClick={() => router.push(`/revenus/recapitulatif?year=${year + 1}`)}
          className="rounded-md border border-border p-1.5 hover:bg-accent transition-colors"
        >
          <ChevronRight className="h-4 w-4" />
        </button>

        {/* Toggle vue */}
        <div className="flex rounded-lg border border-border overflow-hidden text-xs">
          <button
            onClick={() => setDetailView("monthly")}
            className={`flex items-center gap-1.5 px-3 py-1.5 border-r border-border transition-colors ${
              detailView === "monthly" ? "bg-accent font-medium" : "text-muted-foreground hover:bg-muted/50"
            }`}
          >
            <CalendarDays className="h-3.5 w-3.5" />
            Mensuel
          </button>
          <button
            onClick={() => setDetailView("clients")}
            className={`flex items-center gap-1.5 px-3 py-1.5 transition-colors ${
              detailView === "clients" ? "bg-accent font-medium" : "text-muted-foreground hover:bg-muted/50"
            }`}
          >
            <Users className="h-3.5 w-3.5" />
            Par client
          </button>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Total {year}</span>
          <span className="text-lg font-bold tabular-nums">{fmt(grandTotal)} €</span>
          <Button variant="outline" size="sm" onClick={handleExport} className="gap-1.5">
            <FileDown className="h-3.5 w-3.5" />
            Copier
          </Button>
        </div>
      </div>

      {/* ── Aucune source configurée ─────────────────────────────────────── */}
      {fiscalSources.length === 0 && (
        <div className="rounded-xl border border-border/50 bg-card p-12 text-center">
          <p className="text-sm text-muted-foreground">Aucune source fiscale configurée.</p>
          <p className="text-xs text-muted-foreground mt-1">
            Rendez-vous dans{" "}
            <a href="/settings" className="underline hover:text-foreground">Paramètres → Sources fiscales</a>{" "}
            pour créer vos premières sources.
          </p>
        </div>
      )}

      {/* ── Sources avec données ──────────────────────────────────────────── */}
      {activeSources.map(src => {
        const grid = grids.get(src.id)!
        const isExpanded = expandedSource === src.id
        const groups = clientGroups.get(src.id)

        return (
          <div key={src.id} className="rounded-xl border border-border/50 bg-card overflow-hidden">
            {/* Header */}
            <div className="flex items-center gap-3 px-5 py-3.5 border-b border-border/50">
              <span
                className="h-3 w-3 rounded-full shrink-0 ring-2 ring-border"
                style={{ backgroundColor: src.color }}
              />
              <div>
                <h3 className="font-semibold text-sm">{src.name}</h3>
                <span className={`inline-block text-[10px] font-medium rounded-full px-2 py-0.5 mt-0.5 ${BUCKET_BADGE[src.bucket] ?? BUCKET_BADGE.OTHER}`}>
                  {BUCKET_LABELS[src.bucket] ?? src.bucket}
                </span>
              </div>
              <div className="ml-auto text-right">
                <p className="text-lg font-bold tabular-nums">{fmt(grid.yearTotal)} €</p>
                <p className="text-xs text-muted-foreground">total {year}</p>
              </div>
            </div>

            {/* ── Vue mensuelle ─────────────────────────────────────────── */}
            {detailView === "monthly" && (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border/30">
                        {MONTHS.map(m => (
                          <th key={m} className="px-2 py-2 text-center text-[10px] font-medium text-muted-foreground whitespace-nowrap">
                            {m.slice(0, 3)}
                          </th>
                        ))}
                        <th className="px-3 py-2 text-right text-[10px] font-medium text-muted-foreground">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        {grid.months.map((m, mi) => (
                          <td
                            key={mi}
                            className={`px-2 py-3 text-center tabular-nums text-xs ${
                              m.total > 0 ? "font-semibold" : "text-muted-foreground/40"
                            }`}
                          >
                            {m.total > 0 ? fmt(m.total) : "—"}
                          </td>
                        ))}
                        <td className="px-3 py-3 text-right font-bold tabular-nums text-sm">
                          {fmt(grid.yearTotal)} €
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Détails mensuels (toggle) */}
                <div className="border-t border-border/30">
                  <button
                    onClick={() => setExpandedSource(isExpanded ? null : src.id)}
                    className="w-full px-5 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-accent/50 text-left transition-colors flex items-center gap-1"
                  >
                    {isExpanded ? "Masquer le détail" : "Voir le détail mensuel"}
                  </button>

                  {isExpanded && (
                    <div className="px-5 pb-4 space-y-3">
                      {grid.months.map((m, mi) => {
                        if (m.details.length === 0) return null
                        return (
                          <div key={mi}>
                            <p className="text-xs font-medium text-muted-foreground mb-1">{MONTHS[mi]}</p>
                            <div className="space-y-1">
                              {m.details.map((d, i) => (
                                <div key={i} className="flex justify-between text-xs">
                                  <span className="text-muted-foreground truncate max-w-xs">{d.label}</span>
                                  <span className="tabular-nums font-medium ml-4 shrink-0">{fmt(d.amount)} €</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </>
            )}

            {/* ── Vue par client ─────────────────────────────────────────── */}
            {detailView === "clients" && groups && (
              <div className="divide-y divide-border/30">
                {[...groups.values()].map(g => (
                  <ClientGroupRow key={g.clientKey} group={g} />
                ))}
              </div>
            )}
          </div>
        )
      })}

      {/* ── Sources sans données cette année ─────────────────────────────── */}
      {emptySources.length > 0 && (
        <div className="rounded-xl border border-border/30 bg-muted/20 px-5 py-3">
          <p className="text-xs text-muted-foreground font-medium mb-1.5">
            Sources sans revenu en {year}
          </p>
          <div className="flex flex-wrap gap-2">
            {emptySources.map(src => (
              <span
                key={src.id}
                className="inline-flex items-center gap-1.5 text-xs text-muted-foreground bg-card border border-border/50 rounded-full px-2.5 py-1"
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: src.color }} />
                {src.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── Tableau de synthèse global (si plusieurs sources actives) ────── */}
      {activeSources.length > 1 && (
        <div className="rounded-xl border border-border/50 bg-card overflow-hidden">
          <div className="px-5 py-3.5 border-b border-border/50">
            <h3 className="font-semibold text-sm">Synthèse globale {year}</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/30 text-xs text-muted-foreground">
                  <th className="px-5 py-2.5 text-left font-medium">Source</th>
                  <th className="px-5 py-2.5 text-left font-medium">Catégorie</th>
                  {MONTHS.map(m => (
                    <th key={m} className="px-2 py-2.5 text-center font-medium hidden xl:table-cell whitespace-nowrap">
                      {m.slice(0, 3)}
                    </th>
                  ))}
                  <th className="px-5 py-2.5 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {activeSources.map(src => {
                  const grid = grids.get(src.id)!
                  return (
                    <tr key={src.id} className="border-b border-border/20 last:border-0">
                      <td className="px-5 py-2.5">
                        <div className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: src.color }} />
                          <span className="font-medium text-xs">{src.name}</span>
                        </div>
                      </td>
                      <td className="px-5 py-2.5">
                        <span className={`inline-block text-[10px] font-medium rounded-full px-2 py-0.5 ${BUCKET_BADGE[src.bucket] ?? BUCKET_BADGE.OTHER}`}>
                          {BUCKET_LABELS[src.bucket] ?? src.bucket}
                        </span>
                      </td>
                      {grid.months.map((m, mi) => (
                        <td key={mi} className="px-2 py-2.5 text-center text-xs tabular-nums hidden xl:table-cell">
                          {m.total > 0 ? fmt(m.total) : <span className="text-muted-foreground/30">—</span>}
                        </td>
                      ))}
                      <td className="px-5 py-2.5 text-right font-bold tabular-nums">
                        {fmt(grid.yearTotal)} €
                      </td>
                    </tr>
                  )
                })}
                <tr className="bg-muted/30 font-bold">
                  <td colSpan={2} className="px-5 py-2.5 text-xs">Total général</td>
                  {Array.from({ length: 12 }, (_, mi) => {
                    const monthTotal = [...grids.values()].reduce((s, g) => s + g.months[mi].total, 0)
                    return (
                      <td key={mi} className="px-2 py-2.5 text-center text-xs tabular-nums hidden xl:table-cell">
                        {monthTotal > 0 ? fmt(monthTotal) : <span className="text-muted-foreground/30">—</span>}
                      </td>
                    )
                  })}
                  <td className="px-5 py-2.5 text-right tabular-nums">{fmt(grandTotal)} €</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// ── ClientGroupRow — ligne expandable par client ───────────────────────────────

function ClientGroupRow({ group }: { group: { clientKey: string; clientName: string | null; clientCompany: string | null; total: number; lines: { id: string; kind: "invoice" | "revenue"; label: string; projectName: string | null; amount: number; date: string; href?: string }[] } }) {
  const [open, setOpen] = useState(false)

  function fmt(n: number) {
    return n.toLocaleString("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })
  }

  function fmtDate(iso: string) {
    return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })
  }

  function clientDisplayName(clientName: string | null, clientCompany: string | null): string {
    if (clientName && clientCompany && clientCompany !== clientName) return `${clientName} · ${clientCompany}`
    return clientName ?? clientCompany ?? "Sans client"
  }

  const displayName = clientDisplayName(group.clientName, group.clientCompany)

  return (
    <div>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-3 hover:bg-accent/40 transition-colors text-left"
      >
        <div className="flex items-center gap-2.5">
          <span className={`text-xs transition-transform ${open ? "rotate-90" : ""}`}>▶</span>
          <div>
            <p className="text-sm font-medium">{displayName}</p>
            <p className="text-xs text-muted-foreground">{group.lines.length} entrée{group.lines.length > 1 ? "s" : ""}</p>
          </div>
        </div>
        <span className="font-bold tabular-nums text-sm shrink-0">{fmt(group.total)} €</span>
      </button>

      {open && (
        <div className="border-t border-border/20 bg-muted/20">
          {group.lines.map(line => (
            <div
              key={line.id}
              className="flex items-start justify-between px-8 py-2.5 gap-4 border-b border-border/10 last:border-0"
            >
              <div className="min-w-0">
                {line.href ? (
                  <Link
                    href={line.href}
                    className="text-sm font-medium hover:text-primary hover:underline transition-colors"
                  >
                    {line.label}
                  </Link>
                ) : (
                  <p className="text-sm font-medium">{line.label}</p>
                )}
                <div className="flex items-center gap-2 mt-0.5">
                  {line.projectName && (
                    <span className="text-xs text-muted-foreground">
                      📁 {line.projectName}
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground">{fmtDate(line.date)}</span>
                  <span className={`text-[10px] font-medium rounded-full px-1.5 py-0.5 ${
                    line.kind === "invoice"
                      ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                      : "bg-blue-500/10 text-blue-700 dark:text-blue-400"
                  }`}>
                    {line.kind === "invoice" ? "Facture" : "Revenu"}
                  </span>
                </div>
              </div>
              <span className="tabular-nums font-semibold text-sm shrink-0">{fmt(line.amount)} €</span>
            </div>
          ))}
          <div className="flex justify-end px-8 py-2.5 bg-muted/30">
            <span className="text-xs text-muted-foreground mr-2">Sous-total {displayName}</span>
            <span className="text-sm font-bold tabular-nums">{fmt(group.total)} €</span>
          </div>
        </div>
      )}
    </div>
  )
}
