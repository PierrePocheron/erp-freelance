"use client"

import { useMemo, useState } from "react"
import { Plus, LineChart } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  computePlatformStats, aggregateGlobal, fmtEur, fmtEur2, fmtPctSigned,
  PLATFORM_COLORS, type InvestmentType,
} from "@/lib/investments"
import { PlatformCard } from "./PlatformCard"
import { PlatformDialog, type PlatformForEdit } from "./PlatformDialog"
import { InvestmentChart } from "./InvestmentChart"

export type EntryData = { id: string; date: string; capital: number; contribution: number; note: string | null }
export type PlatformData = { id: string; name: string; type: InvestmentType; url: string | null; notes: string | null; entries: EntryData[] }

export function InvestmentsView({ platforms }: { platforms: PlatformData[] }) {
  const [dialog, setDialog] = useState<{ open: boolean; editing?: PlatformForEdit }>({ open: false })

  const withStats = useMemo(
    () => platforms.map((p, i) => ({
      ...p,
      color: PLATFORM_COLORS[i % PLATFORM_COLORS.length],
      stats: computePlatformStats(p.entries),
    })),
    [platforms],
  )
  const agg = useMemo(() => aggregateGlobal(withStats.map((p) => p.stats)), [withStats])

  const openEdit = (p: PlatformData) =>
    setDialog({ open: true, editing: { id: p.id, name: p.name, type: p.type, url: p.url, notes: p.notes } })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-bold tracking-tight sm:hidden">Investissements</h1>
        <p className="hidden text-sm text-muted-foreground sm:block">
          {platforms.length} plateforme{platforms.length !== 1 ? "s" : ""} · {agg.currentCapital > 0 ? <span className="amount-sensitive font-medium text-foreground">{fmtEur(agg.currentCapital)}</span> : "—"} de capital
        </p>
        <Button onClick={() => setDialog({ open: true })}><Plus /> Plateforme</Button>
      </div>

      {platforms.length === 0 ? (
        <EmptyState onCreate={() => setDialog({ open: true })} />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(280px,360px)_1fr]">
          {/* Colonne gauche : plateformes empilées */}
          <div className="space-y-3">
            <div className="rounded-xl border border-border/50 bg-card p-3">
              <div className="mb-2 flex items-center justify-between px-1">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Plateformes</h2>
                <span className="text-[11px] text-muted-foreground">Capital · date</span>
              </div>
              <div className="space-y-2">
                {withStats.map((p) => (
                  <PlatformCard key={p.id} platform={p} stats={p.stats} color={p.color} onEdit={() => openEdit(p)} />
                ))}
              </div>
            </div>
          </div>

          {/* Colonne droite : KPI globaux + graphe */}
          <div className="space-y-6">
            <GlobalKpis
              posed={agg.totalContributions}
              value={agg.currentCapital}
              profit={agg.profit}
              roi={agg.roi}
              monthly={agg.monthlyAvgPct}
            />
            <div className="rounded-xl border border-border/50 bg-card p-4">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                <LineChart className="h-4 w-4 text-muted-foreground" /> Évolution du capital
              </h2>
              <InvestmentChart
                platforms={withStats.map((p) => ({ id: p.id, name: p.name, color: p.color, entries: p.entries }))}
              />
            </div>
          </div>
        </div>
      )}

      <PlatformDialog
        open={dialog.open}
        onOpenChange={(v) => setDialog((d) => ({ ...d, open: v }))}
        platformForEdit={dialog.editing}
      />
    </div>
  )
}

function GlobalKpis({ posed, value, profit, roi, monthly }: { posed: number; value: number; profit: number; roi: number; monthly: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Kpi label="Posé de ma poche" value={fmtEur(posed)} />
      <Kpi label="Valeur actuelle" value={fmtEur(value)} strong />
      <Kpi label="Bénéfices" value={`${profit >= 0 ? "+" : ""}${fmtEur2(profit)}`} tone={profit >= 0 ? "pos" : "neg"} sub={`${fmtPctSigned(roi)} de rentabilité`} />
      <Kpi label="≈ par mois" value={fmtPctSigned(monthly)} tone={monthly >= 0 ? "pos" : "neg"} sub="rendement lissé" />
    </div>
  )
}

function Kpi({ label, value, sub, tone, strong }: { label: string; value: string; sub?: string; tone?: "pos" | "neg"; strong?: boolean }) {
  return (
    <div className="rounded-xl border border-border/50 bg-card px-3 py-2.5">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className={cn(
        "mt-0.5 tabular-nums amount-sensitive",
        strong ? "text-lg font-bold" : "text-sm font-semibold",
        tone === "pos" && "text-emerald-600 dark:text-emerald-400",
        tone === "neg" && "text-red-600 dark:text-red-400",
      )}>{value}</p>
      {sub && <p className={cn("text-[11px] tabular-nums", tone === "pos" ? "text-emerald-600/80 dark:text-emerald-400/80" : tone === "neg" ? "text-red-600/80 dark:text-red-400/80" : "text-muted-foreground")}>{sub}</p>}
    </div>
  )
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="rounded-xl border border-dashed border-border/60 py-16 text-center">
      <LineChart className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden />
      <h2 className="mt-3 text-base font-semibold">Suivez vos investissements</h2>
      <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
        Ajoutez vos plateformes (crowdlending, immobilier, PEA…) et enregistrez le capital à chaque relevé pour suivre vos apports, bénéfices et rentabilité réelle.
      </p>
      <div className="mt-4"><Button onClick={onCreate}><Plus /> Ajouter une plateforme</Button></div>
    </div>
  )
}
