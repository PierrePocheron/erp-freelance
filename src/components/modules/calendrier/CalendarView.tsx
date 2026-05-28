"use client"

import { useState, useEffect } from "react"
import { ChevronLeft, ChevronRight, ExternalLink } from "lucide-react"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"

// ── Types ─────────────────────────────────────────────────────────────────────

export type CalendarEvent = {
  id: string
  date: Date
  title: string
  subtitle?: string
  type: "task" | "milestone" | "reminder" | "invoice" | "renewal" | "manual"
  href?: string
  isLate?: boolean
}

type ViewMode = "day" | "3day" | "week" | "month"

// ── Constants ─────────────────────────────────────────────────────────────────

const VIEW_STORAGE_KEY = "erp-calendar-view"

const typeConfig = {
  task:      { dot: "bg-amber-500",        badge: "bg-amber-500/15 text-amber-700 border-amber-500/20",    label: "Tâche" },
  milestone: { dot: "bg-indigo-500",       badge: "bg-indigo-500/15 text-indigo-700 border-indigo-500/20", label: "Jalon" },
  reminder:  { dot: "bg-orange-500",       badge: "bg-orange-500/15 text-orange-700 border-orange-500/20", label: "Rappel" },
  invoice:   { dot: "bg-blue-500",         badge: "bg-blue-500/15 text-blue-700 border-blue-500/20",       label: "Facture" },
  renewal:   { dot: "bg-red-500",          badge: "bg-red-500/15 text-red-700 border-red-500/20",          label: "Renouvellement" },
  manual:    { dot: "bg-muted-foreground", badge: "bg-muted text-muted-foreground border-border",          label: "Événement" },
}

const VIEW_LABELS: Record<ViewMode, string> = { day: "Jour", "3day": "3j", week: "7j", month: "Mois" }
const WEEK_DAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"]

// ── Helpers ───────────────────────────────────────────────────────────────────

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate()
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return d
}

function getWeekStart(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day))
  d.setHours(0, 0, 0, 0)
  return d
}

function eventsForDay(events: CalendarEvent[], date: Date): CalendarEvent[] {
  return events.filter(e => isSameDay(new Date(e.date), date))
}

/** Heatmap : couleur de fond selon la charge du jour (week-end exclus) */
function loadBg(count: number): string {
  if (count === 0) return ""
  if (count === 1) return "bg-emerald-500/8"
  if (count === 2) return "bg-amber-500/10"
  if (count <= 4)  return "bg-orange-500/12"
  return "bg-red-500/12"
}

// ── CalendarView (orchestrateur) ──────────────────────────────────────────────

export function CalendarView({ events, className }: { events: CalendarEvent[]; className?: string }) {
  const [viewMode, setViewMode]     = useState<ViewMode>("month")
  const [currentDate, setCurrentDate] = useState(() => {
    const d = new Date(); d.setHours(0, 0, 0, 0); return d
  })
  const [selectedDay, setSelectedDay] = useState<Date | null>(null)
  const [mounted, setMounted]       = useState(false)

  // Restaure la vue sauvegardée
  useEffect(() => {
    const stored = localStorage.getItem(VIEW_STORAGE_KEY) as ViewMode | null
    if (stored && ["day", "3day", "week", "month"].includes(stored)) setViewMode(stored)
    setMounted(true)
  }, [])

  function changeView(v: ViewMode) {
    setViewMode(v)
    localStorage.setItem(VIEW_STORAGE_KEY, v)
  }

  function navigate(dir: 1 | -1) {
    setCurrentDate(prev => {
      if (viewMode === "month")  return new Date(prev.getFullYear(), prev.getMonth() + dir, 1)
      if (viewMode === "week")   return addDays(prev, dir * 7)
      if (viewMode === "3day")   return addDays(prev, dir * 3)
      return addDays(prev, dir)
    })
  }

  function goToToday() {
    const d = new Date(); d.setHours(0, 0, 0, 0); setCurrentDate(d)
  }

  // Jours affichés pour les vues multi-jours
  function getViewDays(): Date[] {
    if (viewMode === "week")  return Array.from({ length: 7 }, (_, i) => addDays(getWeekStart(currentDate), i))
    if (viewMode === "3day")  return Array.from({ length: 3 }, (_, i) => addDays(currentDate, i))
    if (viewMode === "day")   return [currentDate]
    return []
  }

  // Label du header
  const today = new Date()
  function headerLabel(): string {
    if (viewMode === "month")
      return currentDate.toLocaleDateString("fr-FR", { month: "long", year: "numeric" })
    const days = getViewDays()
    if (days.length === 1)
      return days[0].toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
    const first = days[0], last = days[days.length - 1]
    if (first.getMonth() === last.getMonth())
      return `${first.getDate()} – ${last.getDate()} ${last.toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}`
    return `${first.toLocaleDateString("fr-FR", { day: "numeric", month: "short" })} – ${last.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}`
  }

  // Compteurs légende (sur la période visible)
  const visibleEvents = viewMode === "month"
    ? events.filter(e => { const d = new Date(e.date); return d.getFullYear() === currentDate.getFullYear() && d.getMonth() === currentDate.getMonth() })
    : events.filter(e => getViewDays().some(d => isSameDay(d, new Date(e.date))))
  const countByType = Object.fromEntries(Object.keys(typeConfig).map(k => [k, visibleEvents.filter(e => e.type === k).length]))

  if (!mounted) return <div className={cn("flex flex-col gap-3", className)} />

  return (
    <div className={cn("flex flex-col gap-3", className)}>

      {/* ── Barre de navigation ─────────────────────────────────────────── */}
      <div className="flex items-center gap-2 shrink-0 flex-wrap">
        <button
          onClick={() => navigate(-1)}
          className="rounded-lg border border-border p-1.5 hover:bg-muted transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <h2 className="text-base font-semibold capitalize flex-1 text-center min-w-0 truncate">
          {headerLabel()}
        </h2>
        <button
          onClick={() => navigate(1)}
          className="rounded-lg border border-border p-1.5 hover:bg-muted transition-colors"
        >
          <ChevronRight className="h-4 w-4" />
        </button>

        <button
          onClick={goToToday}
          className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-muted transition-colors ml-1"
        >
          Aujourd'hui
        </button>

        {/* Sélecteur de vue */}
        <div className="flex items-center rounded-lg border border-border overflow-hidden">
          {(["day", "3day", "week", "month"] as ViewMode[]).map(v => (
            <button
              key={v}
              onClick={() => changeView(v)}
              className={cn(
                "px-2.5 py-1.5 text-xs font-medium transition-colors border-r border-border/50 last:border-r-0",
                viewMode === v
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-muted text-muted-foreground"
              )}
            >
              {VIEW_LABELS[v]}
            </button>
          ))}
        </div>
      </div>

      {/* ── Légende + compteurs ─────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 shrink-0">
        {Object.entries(typeConfig).map(([k, v]) => {
          const count = countByType[k] ?? 0
          return (
            <div key={k} className={cn("flex items-center gap-1.5 text-xs transition-opacity", count === 0 ? "opacity-30" : "text-muted-foreground")}>
              <span className={`h-2 w-2 rounded-full shrink-0 ${v.dot}`} />
              <span>{v.label}</span>
              {count > 0 && <span className="font-semibold text-foreground">{count}</span>}
            </div>
          )
        })}
        {viewMode !== "month" && (
          <span className="ml-auto text-[10px] text-muted-foreground/50 flex items-center gap-1">
            <span className="h-2 w-2 rounded-sm bg-emerald-500/30 inline-block" />
            1–2
            <span className="h-2 w-2 rounded-sm bg-orange-500/30 inline-block ml-1" />
            3–4
            <span className="h-2 w-2 rounded-sm bg-red-500/30 inline-block ml-1" />
            5+
            <span className="ml-1">événements</span>
          </span>
        )}
      </div>

      {/* ── Vue ─────────────────────────────────────────────────────────── */}
      {viewMode === "month" ? (
        <MonthView
          events={events}
          currentDate={currentDate}
          selectedDay={selectedDay}
          setSelectedDay={setSelectedDay}
        />
      ) : (
        <MultiDayView
          events={events}
          days={getViewDays()}
        />
      )}

      {/* Dialog détail jour (vue mois uniquement) */}
      {viewMode === "month" && (
        <Dialog open={selectedDay !== null} onOpenChange={v => { if (!v) setSelectedDay(null) }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="capitalize">
                {selectedDay?.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" }) ?? ""}
              </DialogTitle>
            </DialogHeader>
            <EventList
              events={selectedDay ? eventsForDay(events, selectedDay) : []}
              onNavigate={() => setSelectedDay(null)}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

// ── Vue Mois ──────────────────────────────────────────────────────────────────

function MonthView({
  events, currentDate, selectedDay, setSelectedDay,
}: {
  events: CalendarEvent[]
  currentDate: Date
  selectedDay: Date | null
  setSelectedDay: (d: Date | null) => void
}) {
  const year  = currentDate.getFullYear()
  const month = currentDate.getMonth()
  const today = new Date()

  const firstDay    = new Date(year, month, 1)
  const startOffset = (firstDay.getDay() + 6) % 7
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const cells: (number | null)[] = [
    ...Array(startOffset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  while (cells.length % 7 !== 0) cells.push(null)
  const numRows = cells.length / 7

  const isToday = (day: number) =>
    day === today.getDate() && month === today.getMonth() && year === today.getFullYear()

  return (
    <div className="rounded-xl border border-border/50 bg-card overflow-hidden flex flex-col flex-1 min-h-0">

      {/* En-têtes */}
      <div className="grid grid-cols-7 border-b border-border shrink-0">
        {WEEK_DAYS.map(d => (
          <div key={d} className="py-2 text-center text-xs font-medium text-muted-foreground">{d}</div>
        ))}
      </div>

      {/* Cellules */}
      <div
        className="grid grid-cols-7 flex-1"
        style={{ gridTemplateRows: `repeat(${numRows}, minmax(0, 1fr))` }}
      >
        {cells.map((day, i) => {
          if (!day) return (
            <div key={`e-${i}`} className={cn("border-b border-r border-border/30 bg-muted/20", i % 7 === 6 && "border-r-0")} />
          )

          const dayDate   = new Date(year, month, day)
          const dayEvents = eventsForDay(events, dayDate)
          const isWeekend = (i % 7) >= 5
          const isSelected = selectedDay ? isSameDay(selectedDay, dayDate) : false

          return (
            <button
              key={`d-${day}`}
              type="button"
              onClick={() => setSelectedDay(isSelected ? null : dayDate)}
              className={cn(
                "border-b border-r border-border/30 p-1 text-left transition-colors hover:bg-muted/30 min-w-0 overflow-hidden",
                isWeekend ? "bg-muted/10" : loadBg(dayEvents.length),
                i % 7 === 6 && "border-r-0",
                isSelected && "ring-1 ring-inset ring-primary/40 bg-primary/5"
              )}
            >
              <span className={cn(
                "flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-medium mb-0.5",
                isToday(day) ? "bg-primary text-primary-foreground" : "text-foreground"
              )}>
                {day}
              </span>
              <div className="space-y-px">
                {dayEvents.slice(0, 2).map(ev => (
                  <div key={ev.id} className={cn("flex items-center gap-1 rounded px-1 py-px text-[10px] leading-tight truncate", ev.isLate ? "bg-red-500/10" : "bg-muted/50")}>
                    <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${typeConfig[ev.type].dot}`} />
                    <span className="truncate">{ev.title}</span>
                  </div>
                ))}
                {dayEvents.length > 2 && (
                  <p className="text-[10px] text-muted-foreground pl-1 leading-tight">+{dayEvents.length - 2}</p>
                )}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── Vue Multi-jours (Jour / 3j / 7j) ─────────────────────────────────────────

function MultiDayView({ events, days }: { events: CalendarEvent[]; days: Date[] }) {
  const today = new Date()
  const cols  = days.length

  return (
    <div className="rounded-xl border border-border/50 bg-card overflow-hidden flex flex-col flex-1 min-h-0">

      {/* En-têtes */}
      <div
        className="grid border-b border-border shrink-0"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      >
        {days.map(date => {
          const isToday  = isSameDay(date, today)
          const isWeekend = date.getDay() === 0 || date.getDay() === 6
          return (
            <div
              key={date.toISOString()}
              className={cn(
                "py-2.5 text-center border-r border-border/50 last:border-r-0",
                isWeekend && "bg-muted/10",
                isToday && "bg-primary/5"
              )}
            >
              <p className="text-xs text-muted-foreground capitalize">
                {date.toLocaleDateString("fr-FR", { weekday: cols <= 3 ? "long" : "short" })}
              </p>
              <span className={cn(
                "inline-flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold mt-0.5",
                isToday ? "bg-primary text-primary-foreground" : "text-foreground"
              )}>
                {date.getDate()}
              </span>
              {cols <= 3 && (
                <p className="text-[10px] text-muted-foreground capitalize mt-0.5">
                  {date.toLocaleDateString("fr-FR", { month: "long" })}
                </p>
              )}
            </div>
          )
        })}
      </div>

      {/* Colonnes d'événements */}
      <div
        className="grid flex-1 overflow-y-auto"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      >
        {days.map(date => {
          const dayEvents = eventsForDay(events, date)
          const isToday   = isSameDay(date, today)
          const isWeekend = date.getDay() === 0 || date.getDay() === 6

          return (
            <div
              key={date.toISOString()}
              className={cn(
                "p-2 border-r border-border/30 last:border-r-0 space-y-1.5 min-h-[120px]",
                isToday   && "bg-primary/5",
                !isToday && isWeekend && "bg-muted/10",
                !isToday && !isWeekend && loadBg(dayEvents.length)
              )}
            >
              {dayEvents.length === 0 ? (
                <p className="text-[11px] text-muted-foreground/30 text-center pt-6">—</p>
              ) : (
                <EventList events={dayEvents} compact />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Liste d'événements (dialog mois + colonnes multi-jours) ───────────────────

function EventList({
  events,
  compact = false,
  onNavigate,
}: {
  events: CalendarEvent[]
  compact?: boolean
  onNavigate?: () => void
}) {
  if (events.length === 0) {
    return (
      <p className="text-sm text-muted-foreground italic py-6 text-center">
        Aucun événement ce jour
      </p>
    )
  }

  return (
    <div className={cn("space-y-1.5", !compact && "pt-1")}>
      {events.map(ev => {
        const cfg = typeConfig[ev.type]

        const inner = compact ? (
          /* Version compacte — colonnes multi-jours */
          <div className={cn(
            "rounded-lg border p-1.5 text-[11px] leading-snug transition-colors group",
            ev.isLate ? "border-red-500/30 bg-red-500/5" : "border-border/50 bg-card",
            ev.href && "hover:bg-muted/30 cursor-pointer"
          )}>
            <div className="flex items-start gap-1.5">
              <span className={`mt-0.5 h-1.5 w-1.5 rounded-full shrink-0 ${cfg.dot}`} />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground truncate">{ev.title}</p>
                {ev.subtitle && <p className="text-muted-foreground truncate mt-px">{ev.subtitle}</p>}
                <span className={cn("inline-block text-[10px] rounded-full border px-1.5 py-px mt-1 font-medium", cfg.badge)}>
                  {cfg.label}
                </span>
              </div>
              {ev.href && <ExternalLink className="h-3 w-3 text-muted-foreground/50 shrink-0 mt-0.5 group-hover:text-muted-foreground transition-colors" />}
            </div>
          </div>
        ) : (
          /* Version complète — dialog mois */
          <div className={cn(
            "flex items-start gap-3 rounded-lg border p-3 transition-colors",
            ev.href && "hover:bg-muted/40",
            ev.isLate ? "border-red-500/30 bg-red-500/5" : "border-border/50 bg-card"
          )}>
            <span className={`mt-1 h-2 w-2 rounded-full shrink-0 ${cfg.dot}`} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium leading-snug">{ev.title}</p>
              {ev.subtitle && <p className="text-xs text-muted-foreground mt-px">{ev.subtitle}</p>}
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className={cn("text-xs rounded-full border px-2 py-px font-medium", cfg.badge)}>
                  {cfg.label}
                </span>
                {ev.isLate && <span className="text-xs text-red-500 font-medium">En retard</span>}
              </div>
            </div>
            {ev.href && <ExternalLink className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-1" />}
          </div>
        )

        return ev.href ? (
          <Link key={ev.id} href={ev.href} onClick={onNavigate}>{inner}</Link>
        ) : (
          <div key={ev.id}>{inner}</div>
        )
      })}
    </div>
  )
}
