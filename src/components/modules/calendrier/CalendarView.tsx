"use client"

import { useState } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import Link from "next/link"

export type CalendarEvent = {
  id: string
  date: Date
  title: string
  type: "task" | "milestone" | "reminder" | "invoice" | "renewal" | "manual"
  href?: string
  isLate?: boolean
}

const typeConfig = {
  task: { dot: "bg-amber-500", label: "Tâche" },
  milestone: { dot: "bg-indigo-500", label: "Jalon" },
  reminder: { dot: "bg-orange-500", label: "Rappel" },
  invoice: { dot: "bg-blue-500", label: "Facture" },
  renewal: { dot: "bg-red-500", label: "Renouvellement" },
  manual: { dot: "bg-muted-foreground", label: "Événement" },
}

export function CalendarView({ events }: { events: CalendarEvent[] }) {
  const [currentDate, setCurrentDate] = useState(new Date())

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()

  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)

  // Day of week of first day (Monday=0)
  const startOffset = (firstDay.getDay() + 6) % 7
  const daysInMonth = lastDay.getDate()

  const cells: (number | null)[] = [
    ...Array(startOffset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  // pad to complete last week
  while (cells.length % 7 !== 0) cells.push(null)

  const monthStr = currentDate.toLocaleDateString("fr-FR", { month: "long", year: "numeric" })

  function eventsByDay(day: number) {
    return events.filter((e) => {
      const d = new Date(e.date)
      return d.getFullYear() === year && d.getMonth() === month && d.getDate() === day
    })
  }

  const today = new Date()
  const isToday = (day: number) =>
    day === today.getDate() && month === today.getMonth() && year === today.getFullYear()

  const weekDays = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"]

  return (
    <div className="space-y-4">
      {/* Nav */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => setCurrentDate(new Date(year, month - 1, 1))}
          className="rounded-lg border border-border p-1.5 hover:bg-muted transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <h2 className="text-base font-semibold capitalize flex-1 text-center">{monthStr}</h2>
        <button
          onClick={() => setCurrentDate(new Date(year, month + 1, 1))}
          className="rounded-lg border border-border p-1.5 hover:bg-muted transition-colors"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3">
        {Object.entries(typeConfig).map(([k, v]) => (
          <div key={k} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className={`h-2 w-2 rounded-full ${v.dot}`} />
            {v.label}
          </div>
        ))}
      </div>

      {/* Grid */}
      <div className="rounded-xl border border-border/50 bg-card overflow-hidden">
        {/* Days header */}
        <div className="grid grid-cols-7 border-b border-border">
          {weekDays.map((d) => (
            <div key={d} className="py-2 text-center text-xs font-medium text-muted-foreground">
              {d}
            </div>
          ))}
        </div>

        {/* Cells */}
        <div className="grid grid-cols-7">
          {cells.map((day, i) => {
            if (!day) {
              return <div key={`empty-${i}`} className="min-h-20 border-b border-r border-border/30 bg-muted/20" />
            }
            const dayEvents = eventsByDay(day)
            const isWeekend = (i % 7) >= 5

            return (
              <div
                key={`day-${day}`}
                className={cn(
                  "min-h-20 border-b border-r border-border/30 p-1.5 space-y-0.5",
                  isWeekend && "bg-muted/10",
                  i % 7 === 6 && "border-r-0"
                )}
              >
                <span
                  className={cn(
                    "flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium",
                    isToday(day) ? "bg-primary text-primary-foreground" : "text-foreground"
                  )}
                >
                  {day}
                </span>
                <div className="space-y-0.5">
                  {dayEvents.slice(0, 3).map((ev) => {
                    const cfg = typeConfig[ev.type]
                    const content = (
                      <div
                        className={cn(
                          "flex items-center gap-1 rounded px-1 py-0.5 text-xs truncate hover:bg-muted transition-colors cursor-pointer",
                          ev.isLate && "bg-red-500/10"
                        )}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${cfg.dot}`} />
                        <span className="truncate">{ev.title}</span>
                      </div>
                    )
                    return ev.href ? (
                      <Link key={ev.id} href={ev.href}>{content}</Link>
                    ) : (
                      <div key={ev.id}>{content}</div>
                    )
                  })}
                  {dayEvents.length > 3 && (
                    <p className="text-xs text-muted-foreground pl-1">+{dayEvents.length - 3}</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
