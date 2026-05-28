"use client"

import { useState, useEffect, useTransition } from "react"
import { useRouter } from "next/navigation"
import { ChevronLeft, ChevronRight, ExternalLink, Plus, Loader2, RefreshCw, Check, AlertCircle, Eye, EyeOff } from "lucide-react"
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
  date: Date          // startDate
  endDate?: Date | null
  allDay?: boolean    // true = tout la journée, false = heure précise
  title: string
  subtitle?: string
  type: "task" | "milestone" | "reminder" | "invoice" | "renewal" | "manual"
  href?: string
  isLate?: boolean
  categoryId?: string | null
  categoryColor?: string | null
  isGoogle?: boolean
}

type ViewMode = "day" | "3day" | "5day" | "week" | "month"

// ── Constants ─────────────────────────────────────────────────────────────────

const VIEW_STORAGE_KEY = "erp-calendar-view"

// Grille horaire : 7h → 21h
const HOUR_START  = 7
const HOUR_END    = 21
const HOUR_HEIGHT = 64   // px par heure
const TIME_COL_W  = 44   // px pour la colonne des heures

const typeConfig = {
  task:      { dot: "bg-amber-500",   badge: "bg-amber-500/15 text-amber-700 border-amber-500/20",    color: "#f59e0b", label: "Tâche" },
  milestone: { dot: "bg-indigo-500",  badge: "bg-indigo-500/15 text-indigo-700 border-indigo-500/20", color: "#6366f1", label: "Jalon" },
  reminder:  { dot: "bg-orange-500",  badge: "bg-orange-500/15 text-orange-700 border-orange-500/20", color: "#f97316", label: "Rappel" },
  invoice:   { dot: "bg-blue-500",    badge: "bg-blue-500/15 text-blue-700 border-blue-500/20",       color: "#3b82f6", label: "Facture" },
  renewal:   { dot: "bg-red-500",     badge: "bg-red-500/15 text-red-700 border-red-500/20",          color: "#ef4444", label: "Renouvellement" },
  manual:    { dot: "bg-purple-500",  badge: "bg-purple-500/15 text-purple-700 border-purple-500/20", color: "#8b5cf6", label: "Événement" },
} as const

const VIEW_LABELS: Record<ViewMode, string> = {
  day: "Jour", "3day": "3j", "5day": "5j", week: "7j", month: "Mois",
}
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

/** Heatmap de fond selon la charge du jour */
function loadBg(count: number): string {
  if (count === 0) return ""
  if (count === 1) return "bg-emerald-500/8"
  if (count === 2) return "bg-amber-500/10"
  if (count <= 4)  return "bg-orange-500/12"
  return "bg-red-500/12"
}

/** Vrai si l'événement a une heure précise (pas minuit = all-day implicite) */
function isTimedEvent(ev: CalendarEvent): boolean {
  if (ev.allDay === true) return false
  if (ev.allDay === false) return true
  const d = new Date(ev.date)
  return d.getHours() !== 0 || d.getMinutes() !== 0
}

/** Convertit une date en position Y dans la grille horaire (px) */
function timeToY(date: Date): number {
  const h = date.getHours()
  const m = date.getMinutes()
  if (h < HOUR_START) return 0
  if (h >= HOUR_END)  return (HOUR_END - HOUR_START) * HOUR_HEIGHT
  return (h - HOUR_START + m / 60) * HOUR_HEIGHT
}

/** Hauteur d'un événement dans la grille (px) */
function eventHeightPx(ev: CalendarEvent): number {
  if (!ev.endDate) return HOUR_HEIGHT / 2   // 30 min par défaut
  const dur = (new Date(ev.endDate).getTime() - new Date(ev.date).getTime()) / 3_600_000
  return Math.max(HOUR_HEIGHT / 2, dur * HOUR_HEIGHT)
}

/** Couleur principale d'un événement (catégorie > type) */
function evColor(ev: CalendarEvent): string {
  return ev.categoryColor ?? typeConfig[ev.type]?.color ?? "#8b5cf6"
}

// ── Dialog Nouvel Événement ───────────────────────────────────────────────────

function NewEventDialog({
  open, onClose, defaultDate, categories,
}: {
  open: boolean
  onClose: () => void
  defaultDate: Date
  categories: CalendarCategory[]
}) {
  const [title, setTitle]             = useState("")
  const [date, setDate]               = useState(defaultDate.toISOString().slice(0, 10))
  const [time, setTime]               = useState("")
  const [categoryId, setCategoryId]   = useState<string>(categories[0]?.id ?? "")
  const [error, setError]             = useState("")
  const [isPending, startTransition]  = useTransition()

  useEffect(() => {
    if (open) {
      setTitle("")
      setDate(defaultDate.toISOString().slice(0, 10))
      // Si la date par défaut a une heure précise, pré-remplir
      const h = defaultDate.getHours(), m = defaultDate.getMinutes()
      setTime(h || m ? `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}` : "")
      setCategoryId(categories[0]?.id ?? "")
      setError("")
    }
  }, [open, defaultDate, categories])

  function handleSubmit() {
    if (!title.trim()) { setError("Le titre est requis"); return }
    startTransition(async () => {
      const [y, mo, d] = date.split("-").map(Number)
      const [hh, mm]   = time ? time.split(":").map(Number) : [0, 0]
      const startDate  = new Date(y, mo - 1, d, hh, mm)
      const res = await createCalendarEvent({
        title: title.trim(),
        startDate,
        allDay: !time,
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
              <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="h-8" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Heure <span className="text-muted-foreground/50">(optionnel)</span>
              </label>
              <Input
                type="time"
                value={time}
                onChange={e => setTime(e.target.value)}
                className="h-8"
                placeholder="--:--"
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
                      categoryId === cat.id ? "border-current opacity-100" : "border-border text-muted-foreground hover:border-current hover:opacity-80"
                    )}
                    style={categoryId === cat.id ? { color: cat.color, borderColor: cat.color, backgroundColor: cat.color + "20" } : {}}
                  >
                    <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
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
  const [viewMode, setViewMode]         = useState<ViewMode>("month")
  const [currentDate, setCurrentDate]   = useState(() => { const d = new Date(); d.setHours(0,0,0,0); return d })
  const [selectedDay, setSelectedDay]   = useState<Date | null>(null)
  const [mounted, setMounted]           = useState(false)
  const [newEventOpen, setNewEventOpen] = useState(false)
  const [newEventDate, setNewEventDate] = useState(() => new Date())
  const [activeFilter, setActiveFilter] = useState<string | null>(null)
  const [isSyncing, startSync]          = useTransition()
  const [syncStatus, setSyncStatus]     = useState<"idle" | "success" | "error" | "noPermission">("idle")
  const [syncCount, setSyncCount]       = useState(0)
  const [showGoogleEvents, setShowGoogleEvents] = useState(true)
  const [isRefreshing, startRefresh]    = useTransition()
  const router = useRouter()

  useEffect(() => {
    const stored = localStorage.getItem(VIEW_STORAGE_KEY) as ViewMode | null
    if (stored && ["day","3day","5day","week","month"].includes(stored)) setViewMode(stored)
    setMounted(true)
  }, [])

  function changeView(v: ViewMode) {
    setViewMode(v)
    localStorage.setItem(VIEW_STORAGE_KEY, v)
  }

  function navigate(dir: 1 | -1) {
    setCurrentDate(prev => {
      if (viewMode === "month") return new Date(prev.getFullYear(), prev.getMonth() + dir, 1)
      if (viewMode === "week" || viewMode === "5day") return addDays(prev, dir * 7)
      if (viewMode === "3day") return addDays(prev, dir * 3)
      return addDays(prev, dir)
    })
  }

  function goToToday() { const d = new Date(); d.setHours(0,0,0,0); setCurrentDate(d) }

  function getViewDays(): Date[] {
    if (viewMode === "week")  return Array.from({ length: 7 }, (_, i) => addDays(getWeekStart(currentDate), i))
    if (viewMode === "5day")  return Array.from({ length: 5 }, (_, i) => addDays(getWeekStart(currentDate), i))
    if (viewMode === "3day")  return Array.from({ length: 3 }, (_, i) => addDays(currentDate, i))
    if (viewMode === "day")   return [currentDate]
    return []
  }

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

  function handleRefresh() {
    startRefresh(() => { router.refresh() })
  }

  function handleSync() {
    startSync(async () => {
      const result = await syncGoogleEvents()
      if (result.needsPermission) setSyncStatus("noPermission")
      else if (result.error)      setSyncStatus("error")
      else { setSyncStatus("success"); setSyncCount(result.synced) }
      setTimeout(() => setSyncStatus("idle"), 4000)
    })
  }

  // Masque les événements Google si le toggle est désactivé
  const baseEvents = (hasGoogleCalendar && !showGoogleEvents)
    ? events.filter(e => !e.isGoogle)
    : events

  const filteredEvents = activeFilter
    ? baseEvents.filter(e => activeFilter.startsWith("type:") ? e.type === activeFilter.slice(5) : e.categoryId === activeFilter)
    : baseEvents

  const viewDays = getViewDays()
  const visibleEvents = viewMode === "month"
    ? filteredEvents.filter(e => { const d = new Date(e.date); return d.getFullYear() === currentDate.getFullYear() && d.getMonth() === currentDate.getMonth() })
    : filteredEvents.filter(e => viewDays.some(d => isSameDay(d, new Date(e.date))))

  if (!mounted) return <div className={cn("flex flex-col gap-3", className)} />

  return (
    <div className={cn("flex flex-col gap-3", className)}>

      {/* ── Barre de navigation ──────────────────────────────────────────── */}
      <div className="flex items-center gap-2 shrink-0 flex-wrap">

        {/* Navigation temporelle */}
        <div className="flex items-center gap-1">
          <button onClick={() => navigate(-1)} className="rounded-lg border border-border p-1.5 hover:bg-muted transition-colors">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button onClick={() => navigate(1)} className="rounded-lg border border-border p-1.5 hover:bg-muted transition-colors">
            <ChevronRight className="h-4 w-4" />
          </button>
          <button onClick={goToToday} className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-muted transition-colors">
            Aujourd'hui
          </button>
        </div>

        {/* Titre période */}
        <h2 className="text-base font-semibold capitalize flex-1 min-w-0 truncate">{headerLabel()}</h2>

        {/* Bouton Actualiser */}
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          title="Actualiser les données"
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted transition-colors disabled:opacity-50"
        >
          {isRefreshing
            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
            : <RefreshCw className="h-3.5 w-3.5" />
          }
          Actualiser
        </button>

        {/* Contrôles Google Calendar */}
        {hasGoogleCalendar && (
          <div className="flex items-center rounded-lg border border-border overflow-hidden">
            {/* Toggle affichage événements Google */}
            <button
              onClick={() => setShowGoogleEvents(v => !v)}
              title={showGoogleEvents ? "Masquer les événements Google Calendar" : "Afficher les événements Google Calendar"}
              className={cn(
                "inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium transition-colors border-r border-border/50",
                showGoogleEvents
                  ? "text-foreground bg-background hover:bg-muted"
                  : "text-muted-foreground bg-muted/40 hover:bg-muted"
              )}
            >
              {showGoogleEvents
                ? <Eye className="h-3.5 w-3.5" />
                : <EyeOff className="h-3.5 w-3.5" />
              }
              <span>Google</span>
            </button>

            {/* Synchronisation */}
            <button
              onClick={handleSync}
              disabled={isSyncing}
              title="Synchroniser avec Google Calendar"
              className={cn(
                "inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium transition-colors",
                syncStatus === "success"      ? "text-emerald-600 bg-emerald-500/5"
                  : syncStatus === "error"        ? "text-red-600 bg-red-500/5"
                  : syncStatus === "noPermission" ? "text-amber-600 bg-amber-500/5"
                  : "text-muted-foreground hover:bg-muted"
              )}
            >
              {isSyncing
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : syncStatus === "success"
                  ? <Check className="h-3.5 w-3.5" />
                  : (syncStatus === "error" || syncStatus === "noPermission")
                    ? <AlertCircle className="h-3.5 w-3.5" />
                    : <RefreshCw className="h-3.5 w-3.5" />
              }
              <span>
                {isSyncing                      ? "Sync…"
                  : syncStatus === "success"      ? `${syncCount} sync`
                  : syncStatus === "error"        ? "Erreur"
                  : syncStatus === "noPermission" ? "Autorisation"
                  : "Sync"}
              </span>
            </button>
          </div>
        )}

        {/* Sélecteur de vue */}
        <div className="flex items-center rounded-lg border border-border overflow-hidden">
          {(["day","3day","5day","week","month"] as ViewMode[]).map(v => (
            <button
              key={v}
              onClick={() => changeView(v)}
              className={cn(
                "px-2.5 py-1.5 text-xs font-medium transition-colors border-r border-border/50 last:border-r-0",
                viewMode === v ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground"
              )}
            >
              {VIEW_LABELS[v]}
            </button>
          ))}
        </div>

        {/* Nouvel événement */}
        <button
          onClick={() => { setNewEventDate(new Date()); setNewEventOpen(true) }}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-muted transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          Événement
        </button>

      </div>

      {/* ── Filtres / catégories ─────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 shrink-0">
        <button
          type="button"
          onClick={() => setActiveFilter(null)}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
            !activeFilter ? "border-foreground/30 bg-foreground/5 text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          Tous <span className="font-semibold">{visibleEvents.length}</span>
        </button>

        {Object.entries(typeConfig).map(([k, v]) => {
          const count = visibleEvents.filter(e => e.type === k).length
          if (count === 0 && activeFilter !== `type:${k}`) return null
          return (
            <button key={k} type="button"
              onClick={() => setActiveFilter(activeFilter === `type:${k}` ? null : `type:${k}`)}
              className={cn("inline-flex items-center gap-1.5 text-xs transition-opacity", count === 0 ? "opacity-30" : "text-muted-foreground", activeFilter === `type:${k}` && "opacity-100 font-semibold")}
            >
              <span className={`h-2 w-2 rounded-full shrink-0 ${v.dot}`} />
              <span>{v.label}</span>
              {count > 0 && <span className="font-semibold text-foreground">{count}</span>}
            </button>
          )
        })}

        {categories.length > 0 && (
          <>
            <span className="text-muted-foreground/20 mx-1 text-xs">|</span>
            {categories.map(cat => {
              const count = visibleEvents.filter(e => e.categoryId === cat.id).length
              const isActive = activeFilter === cat.id
              return (
                <button key={cat.id} type="button"
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

        {viewMode !== "month" && (
          <span className="ml-auto text-[10px] text-muted-foreground/50 flex items-center gap-1">
            <span className="h-2 w-2 rounded-sm bg-emerald-500/30 inline-block" />1–2
            <span className="h-2 w-2 rounded-sm bg-orange-500/30 inline-block ml-1" />3–4
            <span className="h-2 w-2 rounded-sm bg-red-500/30 inline-block ml-1" />5+
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
          onNewEvent={date => { setNewEventDate(date); setNewEventOpen(true) }}
        />
      ) : (
        <TimeGridView
          events={filteredEvents}
          days={viewDays}
          onNewEvent={(date) => { setNewEventDate(date); setNewEventOpen(true) }}
        />
      )}

      {/* Dialog détail jour (vue mois) */}
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
      <div className="grid grid-cols-7 border-b border-border shrink-0">
        {WEEK_DAYS.map(d => (
          <div key={d} className="py-2 text-center text-xs font-medium text-muted-foreground">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 flex-1" style={{ gridTemplateRows: `repeat(${numRows}, minmax(0, 1fr))` }}>
        {cells.map((day, i) => {
          if (!day) return (
            <div key={`e-${i}`} className={cn("border-b border-r border-border/30 bg-muted/20", i % 7 === 6 && "border-r-0")} />
          )
          const dayDate    = new Date(year, month, day)
          const dayEvents  = eventsForDay(events, dayDate)
          const isWeekend  = (i % 7) >= 5
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
                  <div key={ev.id} className={cn("flex items-center gap-1 rounded px-1 py-px text-[10px] leading-tight truncate", ev.isLate ? "bg-red-500/10" : "bg-muted/50")}>
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

// ── Vue grille horaire (Jour / 3j / 5j / 7j) ─────────────────────────────────

function TimeGridView({
  events, days, onNewEvent,
}: {
  events: CalendarEvent[]
  days: Date[]
  onNewEvent: (date: Date) => void
}) {
  const today = new Date()
  const cols  = days.length
  const totalH = (HOUR_END - HOUR_START) * HOUR_HEIGHT

  // Sépare par jour : all-day VS avec heure
  const allDayByDay  = days.map(d => eventsForDay(events, d).filter(e => !isTimedEvent(e)))
  const timedByDay   = days.map(d => eventsForDay(events, d).filter(isTimedEvent))
  const hasAnyAllDay = allDayByDay.some(arr => arr.length > 0)

  return (
    <div className="rounded-xl border border-border/50 bg-card overflow-hidden flex flex-col flex-1 min-h-0">

      {/* ── En-têtes des jours ─────────────────────────────────────────── */}
      <div className="flex border-b border-border shrink-0">
        {/* Placeholder colonne heures */}
        <div style={{ width: TIME_COL_W }} className="shrink-0" />
        {days.map(date => {
          const isToday   = isSameDay(date, today)
          const isWeekend = date.getDay() === 0 || date.getDay() === 6
          return (
            <div
              key={date.toISOString()}
              className={cn(
                "flex-1 py-2.5 text-center border-l border-border/30",
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

      {/* ── Bandeau All-day (si au moins un événement sans heure) ─────── */}
      {hasAnyAllDay && (
        <div className="flex border-b border-border/50 shrink-0 bg-muted/20">
          <div
            style={{ width: TIME_COL_W }}
            className="shrink-0 flex items-center justify-end pr-2 text-[10px] text-muted-foreground/50 font-medium"
          >
            Jour
          </div>
          {allDayByDay.map((dayEvs, i) => (
            <div key={i} className="flex-1 border-l border-border/30 p-1 space-y-px min-h-[28px]">
              {dayEvs.map(ev => (
                <AllDayChip key={ev.id} ev={ev} />
              ))}
            </div>
          ))}
        </div>
      )}

      {/* ── Grille horaire ────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-y-auto">
        {/* Colonne heures */}
        <div className="shrink-0 relative" style={{ width: TIME_COL_W, height: totalH }}>
          {Array.from({ length: HOUR_END - HOUR_START }, (_, i) => (
            <div
              key={i}
              style={{ top: i * HOUR_HEIGHT }}
              className="absolute w-full flex items-start justify-end pr-2 pt-0.5"
            >
              <span className="text-[10px] text-muted-foreground/50 tabular-nums leading-none">
                {String(HOUR_START + i).padStart(2, "0")}h
              </span>
            </div>
          ))}
        </div>

        {/* Colonnes par jour */}
        {days.map((date, di) => {
          const isToday   = isSameDay(date, today)
          const isWeekend = date.getDay() === 0 || date.getDay() === 6
          const dayTimed  = timedByDay[di]

          // Heure actuelle dans la grille (uniquement pour aujourd'hui)
          const now = new Date()
          const nowY = isToday && now.getHours() >= HOUR_START && now.getHours() < HOUR_END
            ? timeToY(now)
            : null

          return (
            <div
              key={date.toISOString()}
              className={cn(
                "flex-1 relative border-l border-border/30",
                isToday   && "bg-primary/5",
                !isToday && isWeekend && "bg-muted/10"
              )}
              style={{ height: totalH }}
            >
              {/* Lignes d'heures */}
              {Array.from({ length: HOUR_END - HOUR_START }, (_, i) => (
                <div
                  key={i}
                  style={{ top: i * HOUR_HEIGHT }}
                  className="absolute inset-x-0 border-t border-border/20 pointer-events-none"
                />
              ))}
              {/* Demi-heures */}
              {Array.from({ length: HOUR_END - HOUR_START }, (_, i) => (
                <div
                  key={`h-${i}`}
                  style={{ top: i * HOUR_HEIGHT + HOUR_HEIGHT / 2 }}
                  className="absolute inset-x-0 border-t border-border/10 pointer-events-none"
                />
              ))}

              {/* Ligne heure actuelle */}
              {nowY !== null && (
                <div
                  style={{ top: nowY }}
                  className="absolute inset-x-0 z-10 flex items-center pointer-events-none"
                >
                  <span className="h-2 w-2 rounded-full bg-primary shrink-0 -ml-1" />
                  <div className="flex-1 h-px bg-primary" />
                </div>
              )}

              {/* Zone cliquable pour créer un événement */}
              <button
                type="button"
                className="absolute inset-0 w-full opacity-0 hover:opacity-100 hover:bg-primary/3 transition-opacity z-0"
                onClick={() => {
                  const d = new Date(date)
                  d.setHours(9, 0, 0, 0)
                  onNewEvent(d)
                }}
              />

              {/* Événements positionnés */}
              {dayTimed.map(ev => {
                const top    = timeToY(new Date(ev.date))
                const height = eventHeightPx(ev)
                const color  = evColor(ev)
                const cfg    = typeConfig[ev.type]

                return (
                  <div
                    key={ev.id}
                    style={{
                      top,
                      height,
                      backgroundColor: color + "20",
                      borderColor: color + "60",
                    }}
                    className="absolute left-1 right-1 rounded-md border px-1.5 py-0.5 overflow-hidden z-20 group"
                  >
                    {ev.href ? (
                      <Link href={ev.href} className="block h-full">
                        <TimedEventContent ev={ev} height={height} color={color} cfg={cfg} />
                      </Link>
                    ) : (
                      <TimedEventContent ev={ev} height={height} color={color} cfg={cfg} />
                    )}
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// Contenu d'un événement dans la grille horaire
function TimedEventContent({ ev, height, color, cfg }: {
  ev: CalendarEvent
  height: number
  color: string
  cfg: typeof typeConfig[keyof typeof typeConfig]
}) {
  const timeStr = new Date(ev.date).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
  const compact = height < 40

  return (
    <div className="h-full flex flex-col min-w-0">
      <p
        className="text-[11px] font-semibold leading-tight truncate"
        style={{ color }}
      >
        {compact ? `${timeStr} ${ev.title}` : ev.title}
      </p>
      {!compact && (
        <>
          <p className="text-[10px] leading-tight" style={{ color: color + "cc" }}>{timeStr}</p>
          {ev.subtitle && (
            <p className="text-[10px] truncate mt-px" style={{ color: color + "99" }}>{ev.subtitle}</p>
          )}
        </>
      )}
      {ev.isLate && !compact && (
        <span className="text-[9px] text-red-500 font-medium mt-auto">En retard</span>
      )}
    </div>
  )
}

// Chip événement all-day dans le bandeau
function AllDayChip({ ev }: { ev: CalendarEvent }) {
  const color = evColor(ev)
  const cfg   = typeConfig[ev.type]

  const inner = (
    <div
      className={cn(
        "flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium leading-tight truncate",
        ev.isLate ? "bg-red-500/10 border border-red-500/20" : "border"
      )}
      style={ev.isLate ? {} : { backgroundColor: color + "18", borderColor: color + "40", color }}
    >
      <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
      <span className="truncate">{ev.title}</span>
    </div>
  )

  return ev.href
    ? <Link href={ev.href}>{inner}</Link>
    : inner
}

// ── Liste d'événements (dialog mois) ─────────────────────────────────────────

function EventList({
  events, compact = false, onNavigate,
}: {
  events: CalendarEvent[]
  compact?: boolean
  onNavigate?: () => void
}) {
  if (events.length === 0) {
    return <p className="text-sm text-muted-foreground italic py-6 text-center">Aucun événement ce jour</p>
  }

  return (
    <div className={cn("space-y-1.5", !compact && "pt-1")}>
      {events.map(ev => {
        const cfg   = typeConfig[ev.type] ?? typeConfig.manual
        const color = evColor(ev)
        const dotEl = <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
        const timeStr = isTimedEvent(ev)
          ? new Date(ev.date).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
          : null

        const inner = compact ? (
          <div className={cn("rounded-lg border p-1.5 text-[11px] leading-snug transition-colors group", ev.isLate ? "border-red-500/30 bg-red-500/5" : "border-border/50 bg-card", ev.href && "hover:bg-muted/30 cursor-pointer")}>
            <div className="flex items-start gap-1.5">
              <span className="mt-0.5 shrink-0">{dotEl}</span>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground truncate">{ev.title}</p>
                {timeStr && <p className="text-muted-foreground">{timeStr}</p>}
                {ev.subtitle && <p className="text-muted-foreground truncate">{ev.subtitle}</p>}
                <span className={cn("inline-block text-[10px] rounded-full border px-1.5 py-px mt-1 font-medium", cfg.badge)}>{cfg.label}</span>
              </div>
              {ev.href && <ExternalLink className="h-3 w-3 text-muted-foreground/50 shrink-0 mt-0.5 group-hover:text-muted-foreground" />}
            </div>
          </div>
        ) : (
          <div className={cn("flex items-start gap-3 rounded-lg border p-3 transition-colors", ev.href && "hover:bg-muted/40", ev.isLate ? "border-red-500/30 bg-red-500/5" : "border-border/50 bg-card")}>
            <span className="mt-1 shrink-0">{dotEl}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium leading-snug">{ev.title}</p>
              {timeStr && <p className="text-xs text-muted-foreground mt-px">{timeStr}</p>}
              {ev.subtitle && <p className="text-xs text-muted-foreground mt-px">{ev.subtitle}</p>}
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className={cn("text-xs rounded-full border px-2 py-px font-medium", cfg.badge)}>{cfg.label}</span>
                {ev.isLate && <span className="text-xs text-red-500 font-medium">En retard</span>}
              </div>
            </div>
            {ev.href && <ExternalLink className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-1" />}
          </div>
        )

        return ev.href
          ? <Link key={ev.id} href={ev.href} onClick={onNavigate}>{inner}</Link>
          : <div key={ev.id}>{inner}</div>
      })}
    </div>
  )
}
