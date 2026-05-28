"use client"

import { useState, useEffect, useTransition } from "react"
import { ChevronLeft, ChevronRight, ExternalLink, Plus, Loader2, RefreshCw, Check, AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { createCalendarEvent, syncGoogleEvents } from "@/actions/calendar"

// ── Types ─────────────────────────────────────────────────────────────────────

export type CalendarCategory = {
  id: string
  name: string
  color: string
  isDefault: boolean
}

export type CalendarEvent = {
  id: string
  date: Date
  title: string
  subtitle?: string
  type: "task" | "milestone" | "reminder" | "invoice" | "renewal" | "manual"
  href?: string
  isLate?: boolean
  categoryId?: string | null
  categoryColor?: string | null
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
  manual:    { dot: "bg-purple-500",       badge: "bg-purple-500/15 text-purple-700 border-purple-500/20", label: "Événement" },
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

/** Heatmap : couleur de fond selon la charge du jour */
function loadBg(count: number): string {
  if (count === 0) return ""
  if (count === 1) return "bg-emerald-500/8"
  if (count === 2) return "bg-amber-500/10"
  if (count <= 4)  return "bg-orange-500/12"
  return "bg-red-500/12"
}

/** Couleur d'un événement : catégorie > type */
function eventDotColor(ev: CalendarEvent): string {
  if (ev.categoryColor) return ""
  return typeConfig[ev.type]?.dot ?? typeConfig.manual.dot
}

// ── Dialog Nouvel Événement ───────────────────────────────────────────────────

function NewEventDialog({
  open,
  onClose,
  defaultDate,
  categories,
}: {
  open: boolean
  onClose: () => void
  defaultDate: Date
  categories: CalendarCategory[]
}) {
  const [title, setTitle]         = useState("")
  const [date, setDate]           = useState(defaultDate.toISOString().slice(0, 10))
  const [time, setTime]           = useState("09:00")
  const [categoryId, setCategoryId] = useState<string>(categories[0]?.id ?? "")
  const [error, setError]         = useState("")
  const [isPending, startTransition] = useTransition()

  // Reset on open
  useEffect(() => {
    if (open) {
      setTitle("")
      setDate(defaultDate.toISOString().slice(0, 10))
      setTime("09:00")
      setCategoryId(categories[0]?.id ?? "")
      setError("")
    }
  }, [open, defaultDate, categories])

  function handleSubmit() {
    if (!title.trim()) { setError("Le titre est requis"); return }
    startTransition(async () => {
      const startDate = new Date(`${date}T${time}:00`)
      const res = await createCalendarEvent({
        title: title.trim(),
        startDate,
        categoryId: categoryId || undefined,
      })
      if (res.error) { setError(res.error); return }
      onClose()
    })
  }

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose() }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Nouvel événement</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Titre *</label>
            <Input
              value={title}
              onChange={e => { setTitle(e.target.value); setError("") }}
              onKeyDown={e => { if (e.key === "Enter") handleSubmit() }}
              placeholder="Titre de l'événement"
              className="h-8"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Date</label>
              <Input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="h-8"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Heure</label>
              <Input
                type="time"
                value={time}
                onChange={e => setTime(e.target.value)}
                className="h-8"
              />
            </div>
          </div>

          {categories.length > 0 && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Catégorie</label>
              <div className="flex flex-wrap gap-1.5">
                {categories.map(cat => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setCategoryId(cat.id)}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                      categoryId === cat.id
                        ? "border-current opacity-100"
                        : "border-border text-muted-foreground hover:border-current hover:opacity-80"
                    )}
                    style={categoryId === cat.id ? { color: cat.color, borderColor: cat.color, backgroundColor: cat.color + "20" } : {}}
                  >
                    <span
                      className="h-1.5 w-1.5 rounded-full shrink-0"
                      style={{ backgroundColor: cat.color }}
                    />
                    {cat.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {error && <p className="text-xs text-red-500">{error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" size="sm" onClick={onClose}>Annuler</Button>
            <Button size="sm" disabled={isPending} onClick={handleSubmit}>
              {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Créer"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── CalendarView (orchestrateur) ──────────────────────────────────────────────

export function CalendarView({
  events,
  categories = [],
  hasGoogleCalendar = false,
  className,
}: {
  events: CalendarEvent[]
  categories?: CalendarCategory[]
  hasGoogleCalendar?: boolean
  className?: string
}) {
  const [viewMode, setViewMode]       = useState<ViewMode>("month")
  const [currentDate, setCurrentDate] = useState(() => {
    const d = new Date(); d.setHours(0, 0, 0, 0); return d
  })
  const [selectedDay, setSelectedDay] = useState<Date | null>(null)
  const [mounted, setMounted]         = useState(false)
  const [newEventOpen, setNewEventOpen] = useState(false)
  const [newEventDate, setNewEventDate] = useState(() => new Date())

  // Filtre actif : null = tous, string = id catégorie, type string = type fixe
  const [activeFilter, setActiveFilter] = useState<string | null>(null)

  // Sync Google Calendar
  const [isSyncing, startSync] = useTransition()
  const [syncStatus, setSyncStatus] = useState<"idle" | "success" | "error" | "noPermission">("idle")
  const [syncCount, setSyncCount] = useState(0)

  function handleSync() {
    startSync(async () => {
      const result = await syncGoogleEvents()
      if (result.needsPermission) {
        setSyncStatus("noPermission")
      } else if (result.error) {
        setSyncStatus("error")
      } else {
        setSyncStatus("success")
        setSyncCount(result.synced)
      }
      // Reset après 4s
      setTimeout(() => setSyncStatus("idle"), 4000)
    })
  }

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

  // Filtre actif
  const filteredEvents = activeFilter
    ? events.filter(e => {
        if (activeFilter.startsWith("type:")) return e.type === activeFilter.slice(5)
        return e.categoryId === activeFilter
      })
    : events

  // Compteurs sur la période visible
  const visibleEvents = viewMode === "month"
    ? filteredEvents.filter(e => { const d = new Date(e.date); return d.getFullYear() === currentDate.getFullYear() && d.getMonth() === currentDate.getMonth() })
    : filteredEvents.filter(e => getViewDays().some(d => isSameDay(d, new Date(e.date))))

  if (!mounted) return <div className={cn("flex flex-col gap-3", className)} />

  return (
    <div className={cn("flex flex-col gap-3", className)}>

      {/* ── Barre de navigation ──────────────────────────────────────────── */}
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

        {/* Bouton nouvel événement */}
        <button
          onClick={() => { setNewEventDate(new Date()); setNewEventOpen(true) }}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-muted transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          Événement
        </button>

        {/* Bouton sync Google Calendar */}
        {hasGoogleCalendar && (
          <button
            onClick={handleSync}
            disabled={isSyncing}
            title="Synchroniser avec Google Calendar"
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors",
              syncStatus === "success" && "border-emerald-500/50 text-emerald-600 bg-emerald-500/5",
              syncStatus === "error" && "border-red-500/50 text-red-600 bg-red-500/5",
              syncStatus === "noPermission" && "border-amber-500/50 text-amber-600 bg-amber-500/5",
              syncStatus === "idle" && "border-border hover:bg-muted text-muted-foreground"
            )}
          >
            {isSyncing
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : syncStatus === "success"
                ? <Check className="h-3.5 w-3.5" />
                : syncStatus === "error" || syncStatus === "noPermission"
                  ? <AlertCircle className="h-3.5 w-3.5" />
                  : <RefreshCw className="h-3.5 w-3.5" />
            }
            <span>
              {isSyncing ? "Sync…"
                : syncStatus === "success" ? `${syncCount} synchronisés`
                : syncStatus === "error" ? "Erreur"
                : syncStatus === "noPermission" ? "Autorisation requise"
                : "Sync Google"}
            </span>
          </button>
        )}
      </div>

      {/* ── Catégories / filtres ─────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 shrink-0">
        {/* Filtre "Tous" */}
        <button
          type="button"
          onClick={() => setActiveFilter(null)}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
            !activeFilter
              ? "border-foreground/30 bg-foreground/5 text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          Tous
          <span className="font-semibold">{visibleEvents.length}</span>
        </button>

        {/* Filtres par type */}
        {Object.entries(typeConfig).map(([k, v]) => {
          const count = visibleEvents.filter(e => e.type === k).length
          if (count === 0 && activeFilter !== `type:${k}`) return null
          return (
            <button
              key={k}
              type="button"
              onClick={() => setActiveFilter(activeFilter === `type:${k}` ? null : `type:${k}`)}
              className={cn(
                "inline-flex items-center gap-1.5 text-xs transition-opacity",
                count === 0 ? "opacity-30" : "text-muted-foreground",
                activeFilter === `type:${k}` ? "opacity-100 font-semibold" : ""
              )}
            >
              <span className={`h-2 w-2 rounded-full shrink-0 ${v.dot}`} />
              <span>{v.label}</span>
              {count > 0 && <span className="font-semibold text-foreground">{count}</span>}
            </button>
          )
        })}

        {/* Filtres par catégorie (séparé visuellement) */}
        {categories.length > 0 && (
          <>
            <span className="text-muted-foreground/20 mx-1 text-xs">|</span>
            {categories.map(cat => {
              const count = visibleEvents.filter(e => e.categoryId === cat.id).length
              const isActive = activeFilter === cat.id
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setActiveFilter(isActive ? null : cat.id)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
                    isActive ? "border-current" : "border-border/50 text-muted-foreground hover:border-current hover:text-foreground"
                  )}
                  style={isActive ? { color: cat.color, borderColor: cat.color, backgroundColor: cat.color + "15" } : {}}
                >
                  <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                  {cat.name}
                  {count > 0 && <span className="font-semibold ml-0.5">{count}</span>}
                </button>
              )
            })}
          </>
        )}

        {/* Légende heatmap */}
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
          events={filteredEvents}
          currentDate={currentDate}
          selectedDay={selectedDay}
          setSelectedDay={setSelectedDay}
          onNewEvent={(date) => { setNewEventDate(date); setNewEventOpen(true) }}
        />
      ) : (
        <MultiDayView
          events={filteredEvents}
          days={getViewDays()}
          onNewEvent={(date) => { setNewEventDate(date); setNewEventOpen(true) }}
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
              events={selectedDay ? eventsForDay(filteredEvents, selectedDay) : []}
              onNavigate={() => setSelectedDay(null)}
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Dialog nouvel événement */}
      <NewEventDialog
        open={newEventOpen}
        onClose={() => setNewEventOpen(false)}
        defaultDate={newEventDate}
        categories={categories}
      />
    </div>
  )
}

// ── Vue Mois ──────────────────────────────────────────────────────────────────

function MonthView({
  events, currentDate, selectedDay, setSelectedDay, onNewEvent,
}: {
  events: CalendarEvent[]
  currentDate: Date
  selectedDay: Date | null
  setSelectedDay: (d: Date | null) => void
  onNewEvent: (date: Date) => void
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
              onDoubleClick={() => onNewEvent(dayDate)}
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
                  <div
                    key={ev.id}
                    className={cn(
                      "flex items-center gap-1 rounded px-1 py-px text-[10px] leading-tight truncate",
                      ev.isLate ? "bg-red-500/10" : "bg-muted/50"
                    )}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full shrink-0 ${ev.categoryColor ? "" : typeConfig[ev.type]?.dot ?? ""}`}
                      style={ev.categoryColor ? { backgroundColor: ev.categoryColor } : {}}
                    />
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

function MultiDayView({
  events, days, onNewEvent,
}: {
  events: CalendarEvent[]
  days: Date[]
  onNewEvent: (date: Date) => void
}) {
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
                <button
                  type="button"
                  onClick={() => onNewEvent(date)}
                  className="w-full text-[11px] text-muted-foreground/30 text-center pt-6 hover:text-muted-foreground/60 transition-colors"
                >
                  <Plus className="h-3 w-3 mx-auto" />
                </button>
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
        const cfg = typeConfig[ev.type] ?? typeConfig.manual
        const dotColor = ev.categoryColor
          ? <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: ev.categoryColor }} />
          : <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${cfg.dot}`} />

        const inner = compact ? (
          <div className={cn(
            "rounded-lg border p-1.5 text-[11px] leading-snug transition-colors group",
            ev.isLate ? "border-red-500/30 bg-red-500/5" : "border-border/50 bg-card",
            ev.href && "hover:bg-muted/30 cursor-pointer"
          )}>
            <div className="flex items-start gap-1.5">
              <span className="mt-0.5 shrink-0">{dotColor}</span>
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
          <div className={cn(
            "flex items-start gap-3 rounded-lg border p-3 transition-colors",
            ev.href && "hover:bg-muted/40",
            ev.isLate ? "border-red-500/30 bg-red-500/5" : "border-border/50 bg-card"
          )}>
            <span className="mt-1 shrink-0">{dotColor}</span>
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
