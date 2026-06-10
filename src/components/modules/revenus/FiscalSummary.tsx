"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { ChevronLeft, ChevronRight, FileDown } from "lucide-react"
import { Button } from "@/components/ui/button"

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
  fiscalSourceId: string | null
}

type InvoiceEntry = {
  id:             string
  number:         string
  totalHT:        number
  paidAt:         string
  fiscalSourceId: string
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

function periodToMonthIndex(period: string): number {
  const parts = period.split("-")
  if (parts.length < 2) return -1
  return parseInt(parts[1]) - 1
}

function paidAtToMonthIndex(paidAt: string): number {
  return new Date(paidAt).getMonth()
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

  // ── Agrégation ─────────────────────────────────────────────────────────────

  // Pour chaque source, construire la grille mensuelle
  type MonthData = { total: number; details: { label: string; amount: number }[] }
  type SourceGrid = { months: MonthData[]; yearTotal: number }

  const grids = new Map<string, SourceGrid>()

  for (const src of fiscalSources) {
    const months: MonthData[] = Array.from({ length: 12 }, () => ({ total: 0, details: [] }))

    // Revenus manuels liés à cette source
    for (const r of revenues) {
      if (r.fiscalSourceId !== src.id) continue
      const mi = periodToMonthIndex(r.period)
      if (mi < 0 || mi > 11) continue
      months[mi].total += r.amount
      months[mi].details.push({ label: r.label, amount: r.amount })
    }

    // Factures payées liées à cette source (bucket AE)
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

  // Total global toutes sources
  const grandTotal = [...grids.values()].reduce((s, g) => s + g.yearTotal, 0)

  // Sources avec et sans données
  const activeSources = fiscalSources.filter(src => (grids.get(src.id)?.yearTotal ?? 0) > 0)
  const emptySources  = fiscalSources.filter(src => (grids.get(src.id)?.yearTotal ?? 0) === 0)

  // ── Export simple (copier en texte) ────────────────────────────────────────
  function handleExport() {
    const lines: string[] = [`Récapitulatif fiscal ${year}`, ""]
    for (const src of fiscalSources) {
      const grid = grids.get(src.id)!
      lines.push(`=== ${src.name} (${BUCKET_LABELS[src.bucket] ?? src.bucket}) ===`)
      for (let mi = 0; mi < 12; mi++) {
        const m = grid.months[mi]
        if (m.total > 0) lines.push(`  ${MONTHS[mi]} : ${fmt(m.total)} €`)
      }
      lines.push(`  TOTAL : ${fmt(grid.yearTotal)} €`)
      lines.push("")
    }
    lines.push(`TOTAL GÉNÉRAL : ${fmt(grandTotal)} €`)
    navigator.clipboard.writeText(lines.join("\n"))
    alert("Récapitulatif copié dans le presse-papiers ✓")
  }

  return (
    <div className="space-y-6">

      {/* ── Navigation année ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
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

            {/* Grille mensuelle */}
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

            {/* Détails (toggle) */}
            <div className="border-t border-border/30">
              <button
                onClick={() => setExpandedSource(isExpanded ? null : src.id)}
                className="w-full px-5 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-accent/50 text-left transition-colors flex items-center gap-1"
              >
                {isExpanded ? "Masquer le détail" : "Voir le détail"}
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

      {/* ── Tableau de synthèse global (si plusieurs sources) ────────────── */}
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
                {/* Total row */}
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
