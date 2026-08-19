"use client"

import Link from "next/link"
import { LineChart, ArrowRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { useModules } from "@/hooks/use-modules"
import {
  computePlatformStats, aggregateGlobal, metaForType,
  fmtEur, fmtEur2, fmtPctSigned,
} from "@/lib/investments"

export type DashboardInvestPlatform = {
  id: string
  name: string
  type: string
  entries: { date: string; capital: number | null; contribution: number }[]
}

/**
 * Widget dashboard du module Investissements : capital total, bénéfices (ou « à
 * renseigner » si les apports manquent) et les plus grosses positions. Masqué si le
 * module est inactif ou s'il n'y a aucune plateforme.
 */
export function InvestmentsCard({ platforms }: { platforms: DashboardInvestPlatform[] }) {
  const { isActive } = useModules()
  if (!isActive("investissements") || platforms.length === 0) return null

  const withStats = platforms.map((p) => ({ ...p, stats: computePlatformStats(p.entries) }))
  const agg = aggregateGlobal(withStats.map((p) => p.stats))
  const incomplete = withStats.some((p) => p.stats.contributionsMissing)
  const top = [...withStats].sort((a, b) => b.stats.currentCapital - a.stats.currentCapital).slice(0, 4)

  return (
    <div className="overflow-hidden rounded-xl border border-border/50 bg-card">
      <Link href="/investissements" className="flex items-center justify-between border-b border-border/50 px-4 py-3 transition-colors hover:bg-muted/30">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <LineChart className="h-4 w-4 text-muted-foreground" /> Investissements
        </h2>
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          {platforms.length} plateforme{platforms.length > 1 ? "s" : ""} <ArrowRight className="h-3.5 w-3.5" />
        </span>
      </Link>
      <div className="space-y-3 p-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-[11px] text-muted-foreground">Valeur actuelle</p>
            <p className="text-2xl font-bold tabular-nums amount-sensitive">{fmtEur(agg.currentCapital)}</p>
          </div>
          <div className="text-right">
            <p className="text-[11px] text-muted-foreground">Bénéfices</p>
            {incomplete ? (
              <p className="text-sm font-medium text-amber-600 dark:text-amber-400">à renseigner</p>
            ) : (
              <p className={cn("text-sm font-semibold tabular-nums amount-sensitive", agg.profit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400")}>
                {agg.profit >= 0 ? "+" : ""}{fmtEur2(agg.profit)}
                <span className="text-[11px] font-normal"> ({fmtPctSigned(agg.roi)})</span>
              </p>
            )}
          </div>
        </div>
        <div className="space-y-1 border-t border-border/40 pt-2">
          {top.map((p) => {
            const meta = metaForType(p.type)
            return (
              <div key={p.id} className="flex items-center gap-2 text-xs">
                <span aria-hidden>{meta.icon}</span>
                <span className="truncate">{p.name}</span>
                <span className="ml-auto font-medium tabular-nums amount-sensitive">{fmtEur(p.stats.currentCapital)}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
