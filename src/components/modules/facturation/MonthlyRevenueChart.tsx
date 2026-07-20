"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { ChevronLeft, ChevronRight, BarChart3 } from "lucide-react"
import { getMonthlyRevenue } from "@/actions/facturation"
import { cn } from "@/lib/utils"

const MONTHS_FR = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"]

function monthKey(year: number, m: number) {
  return `${year}-${String(m + 1).padStart(2, "0")}`
}

/**
 * Barres des revenus mensuels — composant présentationnel entièrement piloté
 * par le parent (données, année affichée, sélection). Les mois sont cliquables
 * quand `onMonthClick` est fourni : clic simple = un mois, Maj+clic = ajout ou
 * retrait de la sélection (multi-mois). `selectedKeys` contient des clés
 * "YYYY-MM" pour que la sélection survive à la navigation entre années.
 */
export function RevenueBars({
  data,
  year,
  currentYear,
  currentMonth,
  onYearChange,
  canPrev = true,
  canNext,
  pending = false,
  selectedKeys = [],
  onMonthClick,
  clickHint,
}: {
  data: number[]
  year: number
  currentYear: number
  currentMonth: number
  onYearChange: (delta: number) => void
  canPrev?: boolean
  canNext?: boolean
  pending?: boolean
  selectedKeys?: string[]
  onMonthClick?: (key: string, shiftKey: boolean) => void
  clickHint?: string
}) {
  const [hovered, setHovered] = useState<number | null>(null)

  const maxVal = Math.max(...data, 1)
  const yearTotal = data.reduce((s, v) => s + v, 0)
  const nextAllowed = canNext ?? year < currentYear

  return (
    <div className="rounded-xl border border-border/50 bg-card p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <BarChart3 className="h-4 w-4 text-muted-foreground shrink-0" />
        <h2 className="font-semibold text-sm">Revenus mensuels</h2>

        {/* Year nav */}
        <div className="flex items-center gap-0.5 ml-1">
          <button
            onClick={() => onYearChange(-1)}
            disabled={pending || !canPrev}
            className="h-6 w-6 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors disabled:opacity-40"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <span
            className={cn(
              "text-sm font-semibold w-12 text-center tabular-nums transition-opacity",
              pending && "opacity-40",
              year === currentYear ? "text-primary" : "text-foreground"
            )}
          >
            {year}
          </span>
          <button
            onClick={() => onYearChange(1)}
            disabled={pending || !nextAllowed}
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
      <div className={cn("flex items-end gap-1.5 h-32 transition-opacity duration-200", pending && "opacity-50")}>
        {data.map((v, m) => {
          const rawPct = (v / maxVal) * 100
          const displayPct = Math.max(rawPct, v > 0 ? 3 : 0)
          const key = monthKey(year, m)
          const isCurrent = year === currentYear && m === currentMonth
          const isFuture = year === currentYear && m > currentMonth
          const isHovered = hovered === m
          const isSelected = selectedKeys.includes(key)
          const clickable = !!onMonthClick && !isFuture

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
                {clickable && clickHint && (
                  <p className="text-muted-foreground mt-0.5">{clickHint}</p>
                )}
              </div>

              {/* Bar area — toute la colonne est cliquable, pas juste la barre */}
              <button
                type="button"
                disabled={!clickable}
                onClick={(e) => onMonthClick?.(key, e.shiftKey)}
                className={cn("w-full flex items-end", clickable ? "cursor-pointer" : "cursor-default")}
                style={{ height: "104px" }}
                aria-pressed={isSelected}
                aria-label={`${MONTHS_FR[m]} ${year}`}
              >
                <div
                  className={cn(
                    "w-full rounded-t-md",
                    "transition-all duration-200 ease-out",
                    isFuture
                      ? "bg-muted/30"
                      : isSelected
                      ? "bg-primary ring-2 ring-primary/40"
                      : isCurrent
                      ? isHovered ? "bg-primary" : "bg-primary/70"
                      : isHovered ? "bg-primary/70" : "bg-primary/35"
                  )}
                  style={{
                    height: `${displayPct}%`,
                    // Un mois vide reste sélectionnable : on lui donne un socle visible
                    minHeight: isSelected || (isHovered && clickable) ? "4px" : undefined,
                    transform: isHovered && !isSelected ? "scaleY(1.06) scaleX(0.82)" : "scaleY(1) scaleX(1)",
                    transformOrigin: "bottom",
                  }}
                />
              </button>

              {/* Label */}
              <span
                className={cn(
                  "text-[10px] transition-colors duration-150",
                  isSelected
                    ? "text-primary font-bold"
                    : isCurrent ? "text-primary font-semibold" : isHovered ? "text-foreground font-medium" : "text-muted-foreground"
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

/**
 * Variante autonome pour la vue d'ensemble Facturation : charge les données
 * par année via server action, et un clic sur un mois emmène sur la liste
 * des factures filtrée sur ce mois.
 */
export function MonthlyRevenueChart({
  initialData,
  currentYear,
  currentMonth,
}: {
  initialData: number[]
  currentYear: number
  currentMonth: number
}) {
  const router = useRouter()
  const [year, setYear] = useState(currentYear)
  const [data, setData] = useState(initialData)
  const [isPending, startTransition] = useTransition()

  function changeYear(delta: number) {
    const next = year + delta
    startTransition(async () => {
      const monthly = await getMonthlyRevenue(next)
      setYear(next)
      setData(monthly)
    })
  }

  return (
    <RevenueBars
      data={data}
      year={year}
      currentYear={currentYear}
      currentMonth={currentMonth}
      onYearChange={changeYear}
      pending={isPending}
      onMonthClick={(key) => router.push(`/facturation/factures?mois=${key}`)}
      clickHint="Clic : voir les factures du mois"
    />
  )
}
