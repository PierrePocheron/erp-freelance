"use client"

import { useState } from "react"
import Link from "next/link"
import { ExternalLink, Pencil, Plus, ArrowDownToLine } from "lucide-react"
import { cn } from "@/lib/utils"
import { INVESTMENT_TYPE_META, fmtEur, fmtEur2, fmtPctSigned, type PlatformStats, type PeriodStats } from "@/lib/investments"
import { InvestmentQuickAdd } from "./InvestmentQuickAdd"
import type { PlatformData } from "./InvestmentsView"

function relDays(d: number | null): string {
  if (d === null) return "—"
  if (d < 1) return "aujourd'hui"
  if (d < 2) return "hier"
  return `il y a ${Math.floor(d)} j`
}

export function PlatformCard({
  platform, stats, period, rangeLabel, color, onEdit,
}: {
  platform: PlatformData
  stats: PlatformStats
  period: PeriodStats
  rangeLabel: string
  color: string
  onEdit: () => void
}) {
  const [adding, setAdding] = useState<null | "releve" | "depot">(null)
  const meta = INVESTMENT_TYPE_META[platform.type]
  // Coloration du capital si le dernier relevé est ancien (> 1 mois → ambre, > 2 mois → rouge)
  const staleCls =
    stats.daysSinceLast === null ? ""
    : stats.daysSinceLast > 62 ? "text-red-600 dark:text-red-400"
    : stats.daysSinceLast > 31 ? "text-amber-600 dark:text-amber-400"
    : "text-foreground"

  return (
    <div className="rounded-lg border border-border/50 bg-background/40 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} aria-hidden />
          <Link href={`/investissements/${platform.id}`} className="truncate text-sm font-semibold hover:underline">
            {platform.name}
          </Link>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {platform.url && (
            <a
              href={platform.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground"
              title="Ouvrir la plateforme"
              aria-label={`Ouvrir ${platform.name}`}
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
          <button onClick={onEdit} className="text-muted-foreground hover:text-foreground" aria-label="Modifier la plateforme">
            <Pencil className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="mt-1 flex items-center gap-1.5">
        <span className={cn("inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium", meta.cls)}>
          <span aria-hidden>{meta.icon}</span> {meta.label}
        </span>
      </div>

      {stats.entryCount > 0 ? (
        <>
          <div className="mt-2 flex items-end justify-between gap-2">
            <div>
              <p className={cn("text-xl font-bold tabular-nums amount-sensitive", staleCls)}>{fmtEur(stats.currentCapital)}</p>
              <p className="text-[11px] text-muted-foreground">
                {stats.lastDate?.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}
                {" · "}{relDays(stats.daysSinceLast)}
              </p>
            </div>
            {stats.contributionsMissing ? (
              <button
                type="button"
                onClick={() => setAdding("depot")}
                className="text-right text-[11px] font-medium leading-tight text-amber-600 hover:underline dark:text-amber-400"
                title="Renseigner les apports en un clic"
              >
                Apports<br />à renseigner
              </button>
            ) : (
              <div className="text-right">
                <p className={cn("text-xs font-semibold tabular-nums amount-sensitive", period.gain >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400")}>
                  {period.gain >= 0 ? "+" : ""}{fmtEur2(period.gain)}
                </p>
                <p className="text-[11px] text-muted-foreground tabular-nums">{fmtPctSigned(period.returnPct)} · {rangeLabel}</p>
              </div>
            )}
          </div>
          {stats.isStale && (
            <p className="mt-1.5 text-[11px] text-amber-600 dark:text-amber-400">⚠ Capital à mettre à jour</p>
          )}
        </>
      ) : (
        <p className="mt-2 text-xs text-muted-foreground">Aucun relevé — ajoute le capital actuel.</p>
      )}

      {adding ? (
        <div className="mt-2">
          <InvestmentQuickAdd platformId={platform.id} mode={adding} onClose={() => setAdding(null)} />
        </div>
      ) : (
        <div className="mt-2 grid grid-cols-2 gap-1.5">
          <button
            onClick={() => setAdding("releve")}
            className="flex items-center justify-center gap-1 rounded-md border border-dashed border-border/60 py-1.5 text-xs text-muted-foreground transition-colors hover:border-border hover:text-foreground"
          >
            <Plus className="h-3.5 w-3.5" /> Relevé
          </button>
          <button
            onClick={() => setAdding("depot")}
            className="flex items-center justify-center gap-1 rounded-md border border-dashed border-blue-500/40 py-1.5 text-xs text-blue-600 transition-colors hover:bg-blue-500/5 dark:text-blue-400"
          >
            <ArrowDownToLine className="h-3.5 w-3.5" /> Dépôt
          </button>
        </div>
      )}
    </div>
  )
}
