"use client"

import { useState } from "react"
import { ChevronLeft, ChevronRight, ExternalLink } from "lucide-react"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"

export type CalendarEvent = {
  id: string
  date: Date
  title: string
  subtitle?: string
  type: "task" | "milestone" | "reminder" | "invoice" | "renewal" | "manual"
  href?: string
  isLate?: boolean
}

const typeConfig = {
  task:      { dot: "bg-amber-500",        badge: "bg-amber-500/15 text-amber-700 border-amber-500/20",         label: "Tâche" },
  milestone: { dot: "bg-indigo-500",       badge: "bg-indigo-500/15 text-indigo-700 border-indigo-500/20",      label: "Jalon" },
  reminder:  { dot: "bg-orange-500",       badge: "bg-orange-500/15 text-orange-700 border-orange-500/20",      label: "Rappel" },
  invoice:   { dot: "bg-blue-500",         badge: "bg-blue-500/15 text-blue-700 border-blue-500/20",            label: "Facture" },
  renewal:   { dot: "bg-red-500",          badge: "bg-red-500/15 text-red-700 border-red-500/20",               label: "Renouvellement" },
  manual:    { dot: "bg-muted-foreground", badge: "bg-muted text-muted-foreground border-border",               label: "Événement" },
}

const weekDays = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"]

export function CalendarView({ events, className }: { events: CalendarEvent[]; className?: string }) {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDay, setSelectedDay] = useState<number | null>(null)

  const year  = currentDate.getFullYear()
  const month = currentDate.getMonth()

  const firstDay    = new Date(year, month, 1)
  const lastDay     = new Date(year, month + 1, 0)
  const startOffset = (firstDay.getDay() + 6) % 7
  const daysInMonth = lastDay.getDate()

  const cells: (number | null)[] = [
    ...Array(startOffset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  while (cells.length % 7 !== 0) cells.push(null)
  const numRows = cells.length / 7

  const monthStr = currentDate.toLocaleDateString("fr-FR", { month: "long", year: "numeric" })

  const today = new Date()
  const isToday = (day: number) =>
    day === today.getDate() && month === today.getMonth() && year === today.getFullYear()

  function eventsByDay(day: number) {
    return events.filter((e) => {
      const d = new Date(e.date)
      return d.getFullYear() === year && d.getMonth() === month && d.getDate() === day
    })
  }

  // Counts for current month
  const monthEvents = events.filter((e) => {
    const d = new Date(e.date)
    return d.getFullYear() === year && d.getMonth() === month
  })
  const countByType = Object.fromEntries(
    Object.keys(typeConfig).map((k) => [k, monthEvents.filter((e) => e.type === k).length])
  )

  const selectedDayEvents = selectedDay ? eventsByDay(selectedDay) : []
  const selectedDateLabel = selectedDay
    ? new Date(year, month, selectedDay).toLocaleDateString("fr-FR", {
        weekday: "long", day: "numeric", month: "long",
      })
    : ""

  return (
    <div className={cn("flex flex-col gap-3", className)}>

      {/* Navigation */}
      <div className="flex items-center gap-4 shrink-0">
        <button
          onClick={() => { setCurrentDate(new Date(year, month - 1, 1)); setSelectedDay(null) }}
          className="rounded-lg border border-border p-1.5 hover:bg-muted transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <h2 className="text-base font-semibold capitalize flex-1 text-center">{monthStr}</h2>
        <button
          onClick={() => { setCurrentDate(new Date(year, month + 1, 1)); setSelectedDay(null) }}
          className="rounded-lg border border-border p-1.5 hover:bg-muted transition-colors"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Légende + compteurs */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 shrink-0">
        {Object.entries(typeConfig).map(([k, v]) => {
          const count = countByType[k] ?? 0
          return (
            <div
              key={k}
              className={cn(
                "flex items-center gap-1.5 text-xs transition-opacity",
                count === 0 ? "opacity-30" : "text-muted-foreground"
              )}
            >
              <span className={`h-2 w-2 rounded-full shrink-0 ${v.dot}`} />
              <span>{v.label}</span>
              {count > 0 && <span className="font-semibold text-foreground">{count}</span>}
            </div>
          )
        })}
      </div>

      {/* Grille — flex-1 pour remplir la hauteur disponible */}
      <div className="rounded-xl border border-border/50 bg-card overflow-hidden flex flex-col flex-1 min-h-0">

        {/* En-têtes jours */}
        <div className="grid grid-cols-7 border-b border-border shrink-0">
          {weekDays.map((d) => (
            <div key={d} className="py-2 text-center text-xs font-medium text-muted-foreground">
              {d}
            </div>
          ))}
        </div>

        {/* Cellules — rows distribués équitablement */}
        <div
          className="grid grid-cols-7 flex-1"
          style={{ gridTemplateRows: `repeat(${numRows}, minmax(0, 1fr))` }}
        >
          {cells.map((day, i) => {
            if (!day) {
              return (
                <div
                  key={`empty-${i}`}
                  className={cn(
                    "border-b border-r border-border/30 bg-muted/20",
                    i % 7 === 6 && "border-r-0"
                  )}
                />
              )
            }

            const dayEvents = eventsByDay(day)
            const isWeekend = (i % 7) >= 5
            const isSelected = selectedDay === day

            return (
              <button
                key={`day-${day}`}
                type="button"
                onClick={() => setSelectedDay(isSelected ? null : day)}
                className={cn(
                  "border-b border-r border-border/30 p-1 text-left transition-colors hover:bg-muted/30 min-w-0 overflow-hidden",
                  isWeekend && "bg-muted/10",
                  i % 7 === 6 && "border-r-0",
                  isSelected && "ring-1 ring-inset ring-primary/40 bg-primary/5"
                )}
              >
                <span
                  className={cn(
                    "flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-medium mb-0.5",
                    isToday(day)
                      ? "bg-primary text-primary-foreground"
                      : "text-foreground"
                  )}
                >
                  {day}
                </span>

                <div className="space-y-px">
                  {dayEvents.slice(0, 2).map((ev) => {
                    const cfg = typeConfig[ev.type]
                    return (
                      <div
                        key={ev.id}
                        className={cn(
                          "flex items-center gap-1 rounded px-1 py-px text-[10px] leading-tight truncate",
                          ev.isLate ? "bg-red-500/10" : "bg-muted/50"
                        )}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${cfg.dot}`} />
                        <span className="truncate">{ev.title}</span>
                      </div>
                    )
                  })}
                  {dayEvents.length > 2 && (
                    <p className="text-[10px] text-muted-foreground pl-1 leading-tight">
                      +{dayEvents.length - 2}
                    </p>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Dialog détail du jour */}
      <Dialog open={selectedDay !== null} onOpenChange={(v) => { if (!v) setSelectedDay(null) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="capitalize">{selectedDateLabel}</DialogTitle>
          </DialogHeader>

          <div className="pt-1">
            {selectedDayEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground italic py-6 text-center">
                Aucun événement ce jour
              </p>
            ) : (
              <div className="space-y-2">
                {selectedDayEvents.map((ev) => {
                  const cfg = typeConfig[ev.type]
                  const inner = (
                    <div
                      className={cn(
                        "flex items-start gap-3 rounded-lg border p-3 transition-colors",
                        ev.href && "hover:bg-muted/40",
                        ev.isLate
                          ? "border-red-500/30 bg-red-500/5"
                          : "border-border/50 bg-card"
                      )}
                    >
                      <span className={`mt-1 h-2 w-2 rounded-full shrink-0 ${cfg.dot}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium leading-snug">{ev.title}</p>
                        {ev.subtitle && (
                          <p className="text-xs text-muted-foreground mt-px">{ev.subtitle}</p>
                        )}
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className={cn("text-xs rounded-full border px-2 py-px font-medium", cfg.badge)}>
                            {cfg.label}
                          </span>
                          {ev.isLate && (
                            <span className="text-xs text-red-500 font-medium">En retard</span>
                          )}
                        </div>
                      </div>
                      {ev.href && (
                        <ExternalLink className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-1" />
                      )}
                    </div>
                  )

                  return ev.href ? (
                    <Link key={ev.id} href={ev.href} onClick={() => setSelectedDay(null)}>
                      {inner}
                    </Link>
                  ) : (
                    <div key={ev.id}>{inner}</div>
                  )
                })}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
