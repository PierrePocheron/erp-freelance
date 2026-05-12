"use client"

import { useState, useTransition } from "react"
import { ChevronLeft, ChevronRight, BarChart3 } from "lucide-react"
import { getMonthlyRevenue } from "@/actions/facturation"
import { cn } from "@/lib/utils"

const MONTHS_FR = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"]

export function MonthlyRevenueChart({
  initialData,
  currentYear,
  currentMonth,
}: {
  initialData: number[]
  currentYear: number
  currentMonth: number
}) {
  const [year, setYear] = useState(currentYear)
  const [data, setData] = useState(initialData)
  const [hovered, setHovered] = useState<number | null>(null)
  const [isPending, startTransition] = useTransition()

  function changeYear(delta: number) {
    const next = year + delta
    startTransition(async () => {
      const monthly = await getMonthlyRevenue(next)
      setYear(next)
      setData(monthly)
    })
  }

  const maxVal = Math.max(...data, 1)
  const yearTotal = data.reduce((s, v) => s + v, 0)

  return (
    <div className="rounded-xl border border-border/50 bg-card p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <BarChart3 className="h-4 w-4 text-muted-foreground shrink-0" />
        <h2 className="font-semibold text-sm">Revenus mensuels</h2>

        {/* Year nav */}
        <div className="flex items-center gap-0.5 ml-1">
          <button
            onClick={() => changeYear(-1)}
            disabled={isPending}
            className="h-6 w-6 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors disabled:opacity-40"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <span
            className={cn(
              "text-sm font-semibold w-12 text-center tabular-nums transition-opacity",
              isPending && "opacity-40",
              year === currentYear ? "text-primary" : "text-foreground"
            )}
          >
            {year}
          </span>
          <button
            onClick={() => changeYear(1)}
            disabled={isPending || year >= currentYear}
            className="h-6 w-6 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors disabled:opacity-40"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>

        <span className="ml-auto text-xs text-muted-foreground tabular-nums">
          {yearTotal > 0 ? yearTotal.toLocaleString("fr-FR") + " € encaissé" : "factures payées"}
        </span>
      </div>

      {/* Bars */}
      <div className={cn("flex items-end gap-1.5 h-32 transition-opacity duration-200", isPending && "opacity-50")}>
        {data.map((v, m) => {
          const rawPct = (v / maxVal) * 100
          const displayPct = Math.max(rawPct, v > 0 ? 3 : 0)
          const isCurrent = year === currentYear && m === currentMonth
          const isFuture = year === currentYear && m > currentMonth
          const isHovered = hovered === m

          return (
            <div
              key={m}
              className="relative flex-1 flex flex-col items-center gap-1"
              onMouseEnter={() => setHovered(m)}
              onMouseLeave={() => setHovered(null)}
            >
              {/* Tooltip */}
              <div
                className={cn(
                  "absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-20 pointer-events-none",
                  "whitespace-nowrap rounded-lg border border-border bg-popover px-2.5 py-1.5 shadow-lg text-xs",
                  "transition-all duration-150",
                  isHovered ? "opacity-100 translate-y-0" : "opacity-0 translate-y-1"
                )}
              >
                <p className="font-semibold text-foreground">{MONTHS_FR[m]} {year}</p>
                <p className={cn("tabular-nums", v > 0 ? "text-primary font-medium" : "text-muted-foreground")}>
                  {v > 0 ? v.toLocaleString("fr-FR") + " €" : "Aucun encaissement"}
                </p>
              </div>

              {/* Bar area */}
              <div className="w-full flex items-end" style={{ height: "104px" }}>
                <div
                  className={cn(
                    "w-full rounded-t-md cursor-default",
                    "transition-all duration-200 ease-out",
                    isFuture
                      ? "bg-muted/30"
                      : isCurrent
                      ? isHovered ? "bg-primary" : "bg-primary/70"
                      : isHovered ? "bg-primary/70" : "bg-primary/35"
                  )}
                  style={{
                    height: `${displayPct}%`,
                    transform: isHovered ? "scaleY(1.06) scaleX(0.82)" : "scaleY(1) scaleX(1)",
                    transformOrigin: "bottom",
                  }}
                />
              </div>

              {/* Label */}
              <span
                className={cn(
                  "text-[10px] transition-colors duration-150",
                  isCurrent ? "text-primary font-semibold" : isHovered ? "text-foreground font-medium" : "text-muted-foreground"
                )}
              >
                {MONTHS_FR[m]}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
