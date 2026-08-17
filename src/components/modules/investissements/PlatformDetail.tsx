"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { AlertTriangle, ChevronLeft, ExternalLink, Pencil, Plus } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  computePlatformStats, INVESTMENT_TYPE_META, fmtEur2, fmtPct, fmtPctSigned, type InvestmentType,
} from "@/lib/investments"
import { PlatformDialog } from "./PlatformDialog"
import { EntryDialog, type EntryForEdit } from "./EntryDialog"
import { InvestmentQuickAdd } from "./InvestmentQuickAdd"

type EntryData = { id: string; date: string; capital: number; contribution: number; note: string | null }
type PlatformData = { id: string; name: string; type: InvestmentType; url: string | null; notes: string | null; entries: EntryData[] }

export function PlatformDetail({ platform }: { platform: PlatformData }) {
  const [platformDialog, setPlatformDialog] = useState(false)
  const [entryDialog, setEntryDialog] = useState<{ open: boolean; entry?: EntryForEdit }>({ open: false })
  const [adding, setAdding] = useState(false)

  const meta = INVESTMENT_TYPE_META[platform.type]
  const { stats, rows } = useMemo(() => {
    const sorted = [...platform.entries].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    const s = computePlatformStats(platform.entries)
    const r = sorted.map((e, i) => ({ entry: e, interval: i > 0 ? s.intervals[i - 1] : null })).reverse()
    return { stats: s, rows: r }
  }, [platform.entries])

  return (
    <div className="space-y-6">
      <div>
        <Link href="/investissements" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ChevronLeft className="h-4 w-4" /> Investissements
        </Link>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold tracking-tight">{platform.name}</h1>
            <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium", meta.cls)}>
              <span aria-hidden>{meta.icon}</span> {meta.label}
            </span>
            {platform.url && (
              <a href={platform.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                <ExternalLink className="h-3.5 w-3.5" /> Ouvrir
              </a>
            )}
          </div>
          <button onClick={() => setPlatformDialog(true)} className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-sm text-muted-foreground hover:bg-muted/50 hover:text-foreground">
            <Pencil className="h-3.5 w-3.5" /> Modifier
          </button>
        </div>
        {platform.notes && <p className="mt-1 text-sm text-muted-foreground">{platform.notes}</p>}
      </div>

      {stats.contributionsMissing && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/8 px-4 py-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <div>
            <p className="text-sm font-medium text-amber-700 dark:text-amber-400">Apports à renseigner</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Indique combien tu as déposé de ta poche (ouvre un relevé ci-dessous → champ «&nbsp;dont apport&nbsp;»). Tant que ce n&apos;est pas fait, les bénéfices ne sont pas calculés, et les «&nbsp;gains&nbsp;» par relevé ci-dessous incluent peut-être des dépôts.
            </p>
          </div>
        </div>
      )}

      {/* KPI */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Kpi label="Posé de ma poche" value={stats.contributionsMissing ? "à renseigner" : fmtEur2(stats.totalContributions)} muted={stats.contributionsMissing} />
        <Kpi label="Valeur actuelle" value={fmtEur2(stats.currentCapital)} strong />
        <Kpi label="Bénéfices" value={stats.contributionsMissing ? "à renseigner" : `${stats.profit >= 0 ? "+" : ""}${fmtEur2(stats.profit)}`} muted={stats.contributionsMissing} tone={stats.contributionsMissing ? undefined : stats.profit >= 0 ? "pos" : "neg"} sub={stats.contributionsMissing ? undefined : `${fmtPctSigned(stats.roi)} total`} />
        <Kpi label="Annualisé" value={stats.contributionsMissing ? "à renseigner" : fmtPctSigned(stats.annualizedPct)} muted={stats.contributionsMissing} tone={stats.contributionsMissing ? undefined : stats.annualizedPct >= 0 ? "pos" : "neg"} sub={stats.contributionsMissing ? undefined : "rendement/an"} />
        <Kpi label="≈ par mois" value={stats.contributionsMissing ? "à renseigner" : fmtPctSigned(stats.monthlyAvgPct)} muted={stats.contributionsMissing} tone={stats.contributionsMissing ? undefined : stats.monthlyAvgPct >= 0 ? "pos" : "neg"} sub={stats.contributionsMissing ? undefined : "lissé"} />
      </div>

      {/* Relevés */}
      <div className="rounded-xl border border-border/50 bg-card">
        <div className="flex items-center justify-between border-b border-border/50 px-4 py-2.5">
          <h2 className="text-sm font-semibold">Relevés de capital</h2>
          {!adding && (
            <button onClick={() => setAdding(true)} className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
              <Plus className="h-3.5 w-3.5" /> Nouveau relevé
            </button>
          )}
        </div>
        {adding && (
          <div className="border-b border-border/50 p-3">
            <InvestmentQuickAdd platformId={platform.id} onClose={() => setAdding(false)} />
          </div>
        )}
        {rows.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">Aucun relevé. Ajoute le capital actuel pour démarrer le suivi.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50 text-left text-xs text-muted-foreground">
                  <th className="px-4 py-2 font-medium">Date</th>
                  <th className="px-4 py-2 text-right font-medium">Capital</th>
                  <th className="px-4 py-2 text-right font-medium">Apport</th>
                  <th className="px-4 py-2 text-right font-medium">Gain</th>
                  <th className="px-4 py-2 text-right font-medium">%</th>
                  <th className="px-4 py-2 text-right font-medium">%/mois</th>
                  <th className="px-2 py-2" />
                </tr>
              </thead>
              <tbody>
                {rows.map(({ entry, interval }) => (
                  <tr key={entry.id} className="border-b border-border/40 last:border-0 hover:bg-muted/30">
                    <td className="whitespace-nowrap px-4 py-2">
                      {new Date(entry.date).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })}
                    </td>
                    <td className="px-4 py-2 text-right font-medium tabular-nums amount-sensitive">{fmtEur2(entry.capital)}</td>
                    <td className={cn("px-4 py-2 text-right tabular-nums amount-sensitive", entry.contribution ? "text-blue-600 dark:text-blue-400" : "text-muted-foreground")}>
                      {entry.contribution ? `${entry.contribution > 0 ? "+" : ""}${fmtEur2(entry.contribution)}` : "—"}
                    </td>
                    <td className={cn("px-4 py-2 text-right tabular-nums amount-sensitive", interval ? (interval.gain >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400") : "text-muted-foreground")}>
                      {interval ? `${interval.gain >= 0 ? "+" : ""}${fmtEur2(interval.gain)}` : "—"}
                    </td>
                    <td className={cn("px-4 py-2 text-right tabular-nums", interval ? (interval.returnPct >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400") : "text-muted-foreground")}>
                      {interval ? fmtPctSigned(interval.returnPct) : "—"}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">
                      {interval ? fmtPct(interval.monthlyPct) : "—"}
                    </td>
                    <td className="px-2 py-2 text-right">
                      <button
                        onClick={() => setEntryDialog({ open: true, entry: { id: entry.id, date: entry.date, capital: entry.capital, contribution: entry.contribution, note: entry.note } })}
                        className="text-muted-foreground hover:text-foreground"
                        aria-label="Modifier le relevé"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <PlatformDialog
        open={platformDialog}
        onOpenChange={setPlatformDialog}
        platformForEdit={{ id: platform.id, name: platform.name, type: platform.type, url: platform.url, notes: platform.notes }}
      />
      <EntryDialog
        open={entryDialog.open}
        onOpenChange={(v) => setEntryDialog((d) => ({ ...d, open: v }))}
        entry={entryDialog.entry}
      />
    </div>
  )
}

function Kpi({ label, value, sub, tone, strong, muted }: { label: string; value: string; sub?: string; tone?: "pos" | "neg"; strong?: boolean; muted?: boolean }) {
  return (
    <div className="rounded-xl border border-border/50 bg-card px-3 py-2.5">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className={cn(
        "mt-0.5 tabular-nums",
        !muted && "amount-sensitive",
        strong ? "text-lg font-bold" : "text-sm font-semibold",
        muted && "text-sm font-medium text-amber-600 dark:text-amber-400",
        tone === "pos" && "text-emerald-600 dark:text-emerald-400",
        tone === "neg" && "text-red-600 dark:text-red-400",
      )}>{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground tabular-nums">{sub}</p>}
    </div>
  )
}
