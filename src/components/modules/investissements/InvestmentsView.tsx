"use client"

import { useEffect, useMemo, useState } from "react"
import { Plus, LineChart, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  computePlatformStats, computePeriodStats, rangeStartMs, RANGE_LABEL,
  fmtEur, fmtEur2, fmtPctSigned, PLATFORM_COLORS, type InvestmentType, type RangeKey,
} from "@/lib/investments"
import { PlatformCard } from "./PlatformCard"
import { PlatformDialog, type PlatformForEdit } from "./PlatformDialog"
import { InvestmentChart } from "./InvestmentChart"

export type EntryData = { id: string; date: string; capital: number | null; contribution: number; note: string | null }
export type PlatformData = { id: string; name: string; type: InvestmentType; url: string | null; notes: string | null; entries: EntryData[] }

export function InvestmentsView({ platforms }: { platforms: PlatformData[] }) {
  const [dialog, setDialog] = useState<{ open: boolean; editing?: PlatformForEdit }>({ open: false })
  const [range, setRange] = useState<RangeKey>("12M")
  const [nowMs, setNowMs] = useState(0)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNowMs(Date.now())
  }, [])

  const fromMs = rangeStartMs(range, nowMs)

  const withStats = useMemo(
    () => platforms.map((p, i) => ({
      ...p,
      color: PLATFORM_COLORS[i % PLATFORM_COLORS.length],
      all: computePlatformStats(p.entries),
      period: computePeriodStats(p.entries, fromMs),
    })),
    [platforms, fromMs],
  )

  // Agrégat global sur la période — la rentabilité n'a de sens que si les apports
  // sont renseignés (sinon on prendrait les dépôts pour des bénéfices).
  const agg = useMemo(() => {
    const currentCapital = withStats.reduce((s, p) => s + p.all.currentCapital, 0)
    const incomplete = withStats.filter((p) => p.all.contributionsMissing)
    const known = withStats.filter((p) => !p.all.contributionsMissing && p.all.entryCount > 0)
    const posed = known.reduce((s, p) => s + p.period.apports, 0)
    const profit = known.reduce((s, p) => s + p.period.gain, 0)
    const base = known.reduce((s, p) => s + p.period.startCapital + p.period.apports, 0)
    const roi = base > 0 ? profit / base : 0
    const wCap = known.reduce((s, p) => s + p.period.endCapital, 0)
    const monthly = wCap > 0 ? known.reduce((s, p) => s + p.period.monthlyPct * p.period.endCapital, 0) / wCap : 0
    return { currentCapital, incompleteCount: incomplete.length, hasKnown: known.length > 0, posed, profit, roi, monthly }
  }, [withStats])

  const openEdit = (p: PlatformData) =>
    setDialog({ open: true, editing: { id: p.id, name: p.name, type: p.type, url: p.url, notes: p.notes } })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-bold tracking-tight sm:hidden">Investissements</h1>
        <p className="text-sm text-muted-foreground">
          {platforms.length} plateforme{platforms.length !== 1 ? "s" : ""}
          {agg.currentCapital > 0 && <> · <span className="amount-sensitive font-medium text-foreground">{fmtEur(agg.currentCapital)}</span> de capital</>}
        </p>
      </div>

      {platforms.length === 0 ? (
        <EmptyState onCreate={() => setDialog({ open: true })} />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(260px,340px)_minmax(0,1fr)]">
          {/* Colonne gauche : plateformes empilées (triées par capital décroissant) */}
          <div className="min-w-0 space-y-3">
            <div className="rounded-xl border border-border/50 bg-card p-3">
              <div className="mb-2 flex items-center justify-between px-1">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Plateformes</h2>
                <span className="text-[11px] text-muted-foreground">Capital · date</span>
              </div>
              <div className="space-y-2">
                {[...withStats].sort((a, b) => b.all.currentCapital - a.all.currentCapital).map((p) => (
                  <PlatformCard key={p.id} platform={p} stats={p.all} period={p.period} rangeLabel={RANGE_LABEL[range]} color={p.color} onEdit={() => openEdit(p)} />
                ))}
              </div>
              <button
                type="button"
                onClick={() => setDialog({ open: true })}
                className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-border/70 py-2 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
              >
                <Plus className="h-4 w-4" /> Nouvelle plateforme
              </button>
            </div>
          </div>

          {/* Colonne droite : bannière + KPI globaux + graphe */}
          <div className="min-w-0 space-y-4">
            {agg.incompleteCount > 0 && (
              <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/8 px-4 py-3">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                <div>
                  <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
                    Apports à renseigner — {agg.incompleteCount} plateforme{agg.incompleteCount > 1 ? "s" : ""}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Renseigne en 1 clic : clique sur «&nbsp;Apports à renseigner&nbsp;» ou le bouton «&nbsp;Dépôt&nbsp;» d&apos;une plateforme, et saisis chaque dépôt d&apos;argent (montant + date). Sans ça, impossible de distinguer tes bénéfices de tes dépôts, donc la rentabilité n&apos;est pas calculée.
                  </p>
                </div>
              </div>
            )}

            <GlobalKpis
              rangeLabel={RANGE_LABEL[range]}
              value={agg.currentCapital}
              hasKnown={agg.hasKnown}
              posed={agg.posed}
              profit={agg.profit}
              roi={agg.roi}
              monthly={agg.monthly}
            />

            <div className="rounded-xl border border-border/50 bg-card p-4">
              <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold">
                <LineChart className="h-4 w-4 text-muted-foreground" /> Évolution du capital
              </h2>
              <InvestmentChart
                range={range}
                onRangeChange={setRange}
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

function GlobalKpis({
  rangeLabel, value, hasKnown, posed, profit, roi, monthly,
}: {
  rangeLabel: string
  value: number
  hasKnown: boolean
  posed: number
  profit: number
  roi: number
  monthly: number
}) {
  return (
    <div>
      <p className="mb-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">Statistiques · {rangeLabel}</p>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Valeur actuelle" value={fmtEur(value)} strong />
        <Kpi label={`Apporté · ${rangeLabel}`} value={hasKnown ? fmtEur(posed) : "à renseigner"} muted={!hasKnown} />
        <Kpi
          label={`Bénéfices · ${rangeLabel}`}
          value={hasKnown ? `${profit >= 0 ? "+" : ""}${fmtEur2(profit)}` : "à renseigner"}
          tone={hasKnown ? (profit >= 0 ? "pos" : "neg") : undefined}
          muted={!hasKnown}
          sub={hasKnown ? `${fmtPctSigned(roi)} de rentabilité` : undefined}
        />
        <Kpi
          label="≈ par mois"
          value={hasKnown ? fmtPctSigned(monthly) : "à renseigner"}
          tone={hasKnown ? (monthly >= 0 ? "pos" : "neg") : undefined}
          muted={!hasKnown}
          sub={hasKnown ? "rendement lissé" : undefined}
        />
      </div>
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
