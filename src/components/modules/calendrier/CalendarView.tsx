"use client"

import { useState, useEffect, useTransition, useRef } from "react"
import { useRouter } from "next/navigation"
import { signIn } from "next-auth/react"
import {
  ChevronLeft, ChevronRight, ExternalLink, Plus, Loader2,
  RefreshCw, Check, AlertCircle, Eye, EyeOff, Pencil, Trash2,
  Settings2, KeyRound, CheckSquare, Square,
} from "lucide-react"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { createCalendarItem, moveCalendarItem, updateCalendarItem, deleteCalendarItem, syncGoogleEvents, getGoogleCalendarConnectionStatus } from "@/actions/calendar"
import { DatePicker, TimePicker } from "./DateTimePicker"
import { useModules } from "@/hooks/use-modules"

// Natures de création (rattachement → nature)
type CalNature = "event" | "task" | "interaction" | "reminder" | "milestone" | "note"
// Types d'entité éditables/déplaçables depuis le calendrier
type CalItemType = "task" | "milestone" | "reminder" | "interaction" | "manual"
type Rattachement = "none" | "client" | "project"

// ── Types ─────────────────────────────────────────────────────────────────────

export type CalendarCategory = {
  id: string
  name: string
  color: string
  isDefault: boolean
}

export type ProjectOption = {
  id: string
  name: string
  clientId: string
  clientName: string
}

export type ClientOption = {
  id: string
  label: string
  type: string  // ClientType: CLIENT | PROSPECT | TO_COMPLETE | PERSONAL | SELF | INACTIVE
}

export type CalendarEvent = {
  id: string
  date: Date
  endDate?: Date | null
  allDay?: boolean
  title: string
  subtitle?: string
  description?: string | null
  type: "task" | "milestone" | "reminder" | "interaction" | "invoice" | "renewal" | "manual" | "health" | "interview" | "expense"
  href?: string
  isLate?: boolean
  categoryId?: string | null
  categoryColor?: string | null
  isGoogle?: boolean
  projectId?: string | null
  clientId?: string | null
  projectName?: string | null
  clientName?: string | null
}

type ViewMode = "day" | "3day" | "5day" | "week" | "month"
type MoveEventFn = (eventId: string, newStart: Date, newEnd: Date | null, allDay: boolean) => void

// ── Constants ─────────────────────────────────────────────────────────────────

const VIEW_STORAGE_KEY = "erp-calendar-view"
const HOUR_START  = 0
const HOUR_END    = 24
const HOUR_HEIGHT = 56
// Heure vers laquelle la grille défile automatiquement à l'ouverture (matin),
// pour éviter de fixer les heures creuses du début de nuit.
const SCROLL_TO_HOUR = 7
const TIME_COL_W  = 44

const typeConfig = {
  task:      { dot: "bg-amber-500",   badge: "bg-amber-500/15 text-amber-700 border-amber-500/20",    color: "#f59e0b", label: "Tâche" },
  milestone: { dot: "bg-indigo-500",  badge: "bg-indigo-500/15 text-indigo-700 border-indigo-500/20", color: "#6366f1", label: "Jalon" },
  reminder:  { dot: "bg-orange-500",  badge: "bg-orange-500/15 text-orange-700 border-orange-500/20", color: "#f97316", label: "Rappel" },
  interaction: { dot: "bg-teal-500",  badge: "bg-teal-500/15 text-teal-700 border-teal-500/20",       color: "#14b8a6", label: "Interaction" },
  invoice:   { dot: "bg-blue-500",    badge: "bg-blue-500/15 text-blue-700 border-blue-500/20",       color: "#3b82f6", label: "Facture" },
  renewal:   { dot: "bg-red-500",     badge: "bg-red-500/15 text-red-700 border-red-500/20",          color: "#ef4444", label: "Renouvellement" },
  manual:    { dot: "bg-purple-500",  badge: "bg-purple-500/15 text-purple-700 border-purple-500/20", color: "#8b5cf6", label: "Événement" },
  health:    { dot: "bg-rose-500",    badge: "bg-rose-500/15 text-rose-700 border-rose-500/20",       color: "#f43f5e", label: "Santé" },
  interview: { dot: "bg-sky-500",     badge: "bg-sky-500/15 text-sky-700 border-sky-500/20",          color: "#0ea5e9", label: "Entretien" },
  expense:   { dot: "bg-fuchsia-500", badge: "bg-fuchsia-500/15 text-fuchsia-700 border-fuchsia-500/20", color: "#d946ef", label: "Dépense" },
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
  const d = new Date(date); d.setDate(d.getDate() + n); return d
}

function getWeekStart(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day))
  d.setHours(0, 0, 0, 0)
  return d
}

function startOfDay(d: Date): Date {
  const x = new Date(d); x.setHours(0, 0, 0, 0); return x
}

/**
 * Plage de jours couverte par un événement (bornes incluses).
 * Pour les événements journée entière multi-jours, `endDate` est exclusif
 * (convention Google : end.date = lendemain du dernier jour) → on retire 1 ms.
 * Les événements horaires restent sur leur seul jour de début.
 */
function eventDayRange(ev: CalendarEvent): { first: Date; last: Date } {
  const first = startOfDay(new Date(ev.date))
  if (!isTimedEvent(ev) && ev.endDate) {
    const endIncl = new Date(new Date(ev.endDate).getTime() - 1)
    const last = startOfDay(endIncl)
    return { first, last: last.getTime() < first.getTime() ? first : last }
  }
  return { first, last: first }
}

function eventsForDay(events: CalendarEvent[], date: Date): CalendarEvent[] {
  const d = startOfDay(date).getTime()
  return events.filter(e => {
    if (isTimedEvent(e)) return isSameDay(new Date(e.date), date)
    const { first, last } = eventDayRange(e)
    return d >= first.getTime() && d <= last.getTime()
  })
}

/** Vrai pour un événement journée entière s'étalant sur ≥ 2 jours. */
function isMultiDaySpan(ev: CalendarEvent): boolean {
  if (isTimedEvent(ev)) return false
  const { first, last } = eventDayRange(ev)
  return last.getTime() > first.getTime()
}

/**
 * Segment d'un événement journée entière dans une rangée de jours contigus :
 * colonne de début/fin (bornes incluses) + « lane » (rangée d'empilement) pour
 * dessiner une barre continue à la Google Agenda. `continuesBefore/After`
 * indiquent que l'événement déborde hors de la plage visible (→ bords ouverts).
 */
type DaySpan = {
  ev: CalendarEvent
  startCol: number
  endCol: number
  lane: number
  continuesBefore: boolean
  continuesAfter: boolean
}

/**
 * Calcule la disposition des barres journée entière sur une plage de jours
 * (vue mois : une semaine ; vue grille : tous les jours affichés).
 * Empilement glouton : chaque barre prend la première lane libre.
 */
function layoutSpansForDays(events: CalendarEvent[], days: Date[]): { spans: DaySpan[]; lanes: number } {
  if (days.length === 0) return { spans: [], lanes: 0 }
  const dayTimes = days.map(d => startOfDay(d).getTime())
  const firstT = dayTimes[0]
  const lastT  = dayTimes[dayTimes.length - 1]

  const items = events
    .filter(e => !isTimedEvent(e))
    .map(ev => { const r = eventDayRange(ev); return { ev, first: r.first.getTime(), last: r.last.getTime() } })
    .filter(it => it.last >= firstT && it.first <= lastT)
    .sort((a, b) => a.first - b.first || b.last - a.last)

  const laneLastCol: number[] = []   // dernière colonne occupée par chaque lane
  const spans: DaySpan[] = []
  for (const it of items) {
    let startCol = dayTimes.findIndex(t => t >= it.first)
    if (startCol === -1) startCol = 0
    let endCol = dayTimes.length - 1
    for (let i = dayTimes.length - 1; i >= 0; i--) { if (dayTimes[i] <= it.last) { endCol = i; break } }
    if (endCol < startCol) endCol = startCol
    let lane = laneLastCol.findIndex(c => c < startCol)
    if (lane === -1) { lane = laneLastCol.length; laneLastCol.push(endCol) } else laneLastCol[lane] = endCol
    spans.push({
      ev: it.ev, startCol, endCol, lane,
      continuesBefore: it.first < firstT,
      continuesAfter:  it.last  > lastT,
    })
  }
  return { spans, lanes: laneLastCol.length }
}

function loadBg(count: number): string {
  if (count === 0) return ""
  if (count === 1) return "bg-emerald-500/8"
  if (count === 2) return "bg-amber-500/10"
  if (count <= 4)  return "bg-orange-500/12"
  return "bg-red-500/12"
}

function isTimedEvent(ev: CalendarEvent): boolean {
  if (ev.allDay === true) return false
  if (ev.allDay === false) return true
  const d = new Date(ev.date)
  return d.getHours() !== 0 || d.getMinutes() !== 0
}

function timeToY(date: Date): number {
  const h = date.getHours(), m = date.getMinutes()
  if (h < HOUR_START) return 0
  if (h >= HOUR_END)  return (HOUR_END - HOUR_START) * HOUR_HEIGHT
  return (h - HOUR_START + m / 60) * HOUR_HEIGHT
}

function eventHeightPx(ev: CalendarEvent): number {
  if (!ev.endDate) return HOUR_HEIGHT / 2
  const dur = (new Date(ev.endDate).getTime() - new Date(ev.date).getTime()) / 3_600_000
  return Math.max(HOUR_HEIGHT / 2, dur * HOUR_HEIGHT)
}

// Fin effective d'un événement (défaut 30 min si pas de date de fin, min 15 min)
function effectiveEndMs(ev: CalendarEvent): number {
  const start = new Date(ev.date).getTime()
  const end   = ev.endDate ? new Date(ev.endDate).getTime() : start + 30 * 60_000
  return Math.max(end, start + 15 * 60_000)
}

// Calcule la disposition en colonnes des événements qui se chevauchent.
// Renvoie une Map id → { col, cols } : col = index de colonne, cols = nb total
// de colonnes dans le « paquet » de chevauchement. Algorithme glouton type
// Google Agenda (paquets transitifs + packing par colonne).
function computeOverlapLayout(events: CalendarEvent[]): Map<string, { col: number; cols: number }> {
  const layout = new Map<string, { col: number; cols: number }>()
  const sorted = [...events].sort((a, b) =>
    new Date(a.date).getTime() - new Date(b.date).getTime() || effectiveEndMs(b) - effectiveEndMs(a)
  )

  let cluster: CalendarEvent[] = []
  let clusterEnd = 0

  const flush = (group: CalendarEvent[]) => {
    const colEnds: number[] = []          // fin du dernier event de chaque colonne
    const colOf = new Map<string, number>()
    for (const ev of group) {
      const start = new Date(ev.date).getTime()
      let placed = false
      for (let i = 0; i < colEnds.length; i++) {
        if (colEnds[i] <= start) { colEnds[i] = effectiveEndMs(ev); colOf.set(ev.id, i); placed = true; break }
      }
      if (!placed) { colOf.set(ev.id, colEnds.length); colEnds.push(effectiveEndMs(ev)) }
    }
    const cols = colEnds.length
    for (const ev of group) layout.set(ev.id, { col: colOf.get(ev.id) ?? 0, cols })
  }

  for (const ev of sorted) {
    const start = new Date(ev.date).getTime()
    if (cluster.length && start >= clusterEnd) { flush(cluster); cluster = []; clusterEnd = 0 }
    cluster.push(ev)
    clusterEnd = Math.max(clusterEnd, effectiveEndMs(ev))
  }
  if (cluster.length) flush(cluster)
  return layout
}

function evColor(ev: CalendarEvent): string {
  return ev.categoryColor ?? typeConfig[ev.type]?.color ?? "#8b5cf6"
}

// Un événement est éditable / déplaçable s'il correspond à une vraie entité
// modifiable (tâche, jalon, rappel, interaction, événement manuel). Les factures
// et renouvellements ont des dates contractuelles → lecture seule (navigation).
const EDITABLE_TYPES: readonly string[] = ["task", "milestone", "reminder", "interaction", "manual"]
function isEditable(ev: CalendarEvent): boolean {
  return EDITABLE_TYPES.includes(ev.type)
}

// Options de création par rattachement
const NATURES_BY_RATT: Record<Rattachement, { value: CalNature; label: string }[]> = {
  none:    [{ value: "event", label: "Événement" }],
  client:  [
    { value: "task",        label: "Tâche" },
    { value: "interaction", label: "Interaction" },
    { value: "reminder",    label: "Rappel" },
    { value: "event",       label: "Événement" },
  ],
  project: [
    { value: "task",      label: "Tâche" },
    { value: "milestone", label: "Jalon" },
    { value: "note",      label: "Note rapide" },
    { value: "event",     label: "Événement" },
  ],
}
const CHANNELS: [string, string][] = [
  ["EMAIL", "Email"], ["CALL", "Appel"], ["MEETING", "Réunion"],
  ["LINKEDIN", "LinkedIn"], ["SMS", "SMS"], ["OTHER", "Autre"],
]
const PRIORITIES: [string, string][] = [
  ["LOW", "Basse"], ["MEDIUM", "Moyenne"], ["HIGH", "Haute"], ["URGENT", "Urgente"],
]
const TITLE_LABEL: Record<CalNature, string> = {
  event: "Titre", task: "Intitulé de la tâche", interaction: "Objet de l'interaction",
  reminder: "Intitulé du rappel", milestone: "Nom du jalon", note: "Titre de la note",
}
const DATE_LABEL: Record<CalNature, string> = {
  event: "Date", task: "Échéance", interaction: "Date",
  reminder: "Échéance", milestone: "Date", note: "Date",
}
const EDIT_TITLE: Record<CalItemType, string> = {
  task: "Modifier la tâche", milestone: "Modifier le jalon", reminder: "Modifier le rappel",
  interaction: "Modifier l'interaction", manual: "Modifier l'événement",
}

// Ordre + libellés des groupes de clients dans les sélecteurs
const CLIENT_TYPE_GROUPS: [string, string][] = [
  ["CLIENT", "Clients"],
  ["PROSPECT", "Prospects"],
  ["TO_COMPLETE", "À compléter"],
  ["PERSONAL", "Personnel"],
  ["SELF", "Moi"],
  ["INACTIVE", "Inactifs"],
]

/** Sélecteur de client groupé par type (Clients / Prospects / À compléter…). */
function ClientSelect({ value, onChange, clients, placeholder = "Sélectionner…", className }: {
  value: string
  onChange: (id: string) => void
  clients: ClientOption[]
  placeholder?: string
  className?: string
}) {
  const groups = CLIENT_TYPE_GROUPS
    .map(([type, label]) => ({ label, items: clients.filter(c => c.type === type) }))
    .filter(g => g.items.length > 0)
  // Clients dont le type ne fait pas partie des groupes connus (fallback)
  const known = new Set(CLIENT_TYPE_GROUPS.map(([t]) => t))
  const others = clients.filter(c => !known.has(c.type))
  if (others.length > 0) groups.push({ label: "Autres", items: others })

  return (
    <select value={value} onChange={e => onChange(e.target.value)}
      className={cn("h-8 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring", className)}>
      <option value="">{placeholder}</option>
      {groups.map(g => (
        <optgroup key={g.label} label={g.label}>
          {g.items.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
        </optgroup>
      ))}
    </select>
  )
}

function snapMinutes(totalMin: number): number {
  return Math.max(0, Math.min((HOUR_END - HOUR_START) * 60 - 15, Math.round(totalMin / 15) * 15))
}

/** Helpers de formulaire communs */
function parseDateTimeFromForm(dateStr: string, timeStr: string): Date {
  const [y, mo, d] = dateStr.split("-").map(Number)
  const [hh, mm]   = timeStr ? timeStr.split(":").map(Number) : [0, 0]
  return new Date(y, mo - 1, d, hh, mm)
}

function timeStringFromDate(d: Date, allDay: boolean | undefined): string {
  if (allDay === true) return ""
  if (d.getHours() === 0 && d.getMinutes() === 0) return ""
  return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`
}

// ── Dialog Nouvel Événement ───────────────────────────────────────────────────

function EventFormFields({
  title, setTitle,
  date, setDate,
  time, setTime,
  description, setDescription,
  categoryId, setCategoryId,
  projectId, setProjectId,
  clientId, setClientId,
  categories,
  projects,
  clients,
}: {
  title: string; setTitle: (v: string) => void
  date: string;  setDate:  (v: string) => void
  time: string;  setTime:  (v: string) => void
  description: string; setDescription: (v: string) => void
  categoryId: string;  setCategoryId:  (v: string) => void
  projectId: string;   setProjectId:   (v: string) => void
  clientId: string;    setClientId:    (v: string) => void
  categories: CalendarCategory[]
  projects: ProjectOption[]
  clients: ClientOption[]
}) {
  return (
    <>
      {/* Titre */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">Titre *</label>
        <Input value={title} onChange={e => setTitle(e.target.value)}
          placeholder="Titre de l'événement" className="h-8" />
      </div>

      {/* Date + Heure */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Date</label>
          <DatePicker value={date} onChange={setDate} ariaLabel="Date" />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">
            Heure <span className="text-muted-foreground/50">(opt.)</span>
          </label>
          <TimePicker value={time} onChange={setTime} ariaLabel="Heure" />
        </div>
      </div>

      {/* Description */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">Description</label>
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          rows={2}
          placeholder="Notes, détails…"
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground/50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
        />
      </div>

      {/* Catégorie */}
      {categories.length > 0 && (
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Catégorie</label>
          <div className="flex flex-wrap gap-1.5">
            {categories.map(cat => (
              <button key={cat.id} type="button" onClick={() => setCategoryId(cat.id)}
                className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                  categoryId === cat.id ? "border-current" : "border-border text-muted-foreground hover:border-current hover:opacity-80")}
                style={categoryId === cat.id ? { color: cat.color, borderColor: cat.color, backgroundColor: cat.color + "20" } : {}}
              >
                <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                {cat.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Projet */}
      {projects.length > 0 && (
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Projet lié</label>
          <select value={projectId} onChange={e => {
            setProjectId(e.target.value)
            if (e.target.value) {
              const p = projects.find(x => x.id === e.target.value)
              if (p) setClientId(p.clientId)
            }
          }}
            className="h-8 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="">Aucun</option>
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.name} — {p.clientName}</option>
            ))}
          </select>
        </div>
      )}

      {/* Client (uniquement si pas de projet sélectionné) */}
      {clients.length > 0 && !projectId && (
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Client lié</label>
          <ClientSelect value={clientId} onChange={setClientId} clients={clients} placeholder="Aucun" />
        </div>
      )}
    </>
  )
}

/** Petit sélecteur segmenté réutilisable */
function Segmented<T extends string>({ value, onChange, options }: {
  value: T; onChange: (v: T) => void; options: { value: T; label: string }[]
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {options.map(o => (
        <button key={o.value} type="button" onClick={() => onChange(o.value)}
          className={cn("rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
            value === o.value
              ? "border-primary bg-primary/10 text-primary"
              : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground")}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

function NewEventDialog({
  open, onClose, defaultDate, categories, projects, clients,
}: {
  open: boolean
  onClose: () => void
  defaultDate: Date
  categories: CalendarCategory[]
  projects: ProjectOption[]
  clients: ClientOption[]
}) {
  const router = useRouter()
  const [rattachement, setRattachement] = useState<Rattachement>("none")
  const [nature, setNature]         = useState<CalNature>("event")
  const [title, setTitle]           = useState("")
  const [date, setDate]             = useState(defaultDate.toISOString().slice(0, 10))
  const [time, setTime]             = useState("")
  const [allDay, setAllDay]         = useState(false)
  const [endDate, setEndDate]       = useState("")   // journée entière multi-jours (opt.)
  const [description, setDescription] = useState("")
  const [categoryId, setCategoryId] = useState<string>(categories[0]?.id ?? "")
  const [projectId, setProjectId]   = useState("")
  const [clientId, setClientId]     = useState("")
  const [channel, setChannel]       = useState("EMAIL")
  const [priority, setPriority]     = useState("MEDIUM")
  const [error, setError]           = useState("")
  const [isPending, startTransition] = useTransition()

  const natureOptions = NATURES_BY_RATT[rattachement]

  useEffect(() => {
    if (open) {
      /* eslint-disable react-hooks/set-state-in-effect */
      setRattachement("none"); setNature("event")
      setTitle(""); setDescription(""); setProjectId(""); setClientId(""); setError("")
      setChannel("EMAIL"); setPriority("MEDIUM")
      setDate(defaultDate.toISOString().slice(0, 10))
      setTime(timeStringFromDate(defaultDate, undefined))
      setAllDay(false); setEndDate("")
      setCategoryId(categories[0]?.id ?? "")
      /* eslint-enable react-hooks/set-state-in-effect */
    }
  }, [open, defaultDate, categories])

  function changeRattachement(r: Rattachement) {
    setRattachement(r)
    setNature(NATURES_BY_RATT[r][0].value)
    setProjectId(""); setClientId(""); setError("")
  }

  const showCategory = nature === "event" || nature === "note"
  const allowAllDay  = nature === "event"   // toggle "journée entière" réservé aux événements

  function handleSubmit() {
    if (!title.trim()) { setError("Le titre est requis"); return }
    if (rattachement === "project" && !projectId) { setError("Choisis un projet"); return }
    if (rattachement === "client"  && !clientId)  { setError("Choisis un client"); return }
    startTransition(async () => {
      // Journée entière (uniquement pour les événements) : start à 00:00, et
      // endDate stocké en EXCLUSIF (lendemain du dernier jour couvert, façon Google).
      const isAllDay = allowAllDay && allDay
      const startDate = parseDateTimeFromForm(date, isAllDay ? "" : time)
      let endDateVal: Date | null = null
      if (isAllDay && endDate) {
        const last = parseDateTimeFromForm(endDate, "")  // dernier jour couvert (00:00)
        last.setDate(last.getDate() + 1)                 // → exclusif
        if (last.getTime() > startDate.getTime()) endDateVal = last
      }
      const res = await createCalendarItem({
        nature,
        title: title.trim(),
        description: description || null,
        startDate,
        endDate: endDateVal,
        allDay: isAllDay || !time,
        categoryId: showCategory ? (categoryId || null) : null,
        projectId: rattachement === "project" ? (projectId || null) : null,
        clientId:  rattachement === "client"  ? (clientId  || null) : null,
        channel:  nature === "interaction" ? channel : null,
        priority: nature === "task" ? priority : null,
      })
      if (res.error) { setError(res.error); return }
      router.refresh()
      onClose()
    })
  }

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose() }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Nouvel événement</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 pt-2" onKeyDown={e => {
          // Entrée valide le formulaire (sauf dans la zone de description multi-ligne).
          const tag = (e.target as HTMLElement)?.tagName
          if (e.key === "Enter" && tag !== "TEXTAREA" && tag !== "BUTTON" && !isPending) {
            e.preventDefault()
            handleSubmit()
          }
        }}>

          {/* Rattachement */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Rattacher à</label>
            <Segmented<Rattachement> value={rattachement} onChange={changeRattachement}
              options={[
                { value: "none", label: "Aucun" },
                { value: "client", label: "Client" },
                { value: "project", label: "Projet" },
              ]} />
          </div>

          {/* Sélecteur projet */}
          {rattachement === "project" && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Projet</label>
              <select value={projectId} onChange={e => {
                  setProjectId(e.target.value)
                  const p = projects.find(x => x.id === e.target.value)
                  if (p) setClientId(p.clientId)
                }}
                className="h-8 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                <option value="">Sélectionner…</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name} — {p.clientName}</option>)}
              </select>
            </div>
          )}

          {/* Sélecteur client */}
          {rattachement === "client" && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Client</label>
              <ClientSelect value={clientId} onChange={setClientId} clients={clients} />
            </div>
          )}

          {/* Nature (si plus d'une option) */}
          {natureOptions.length > 1 && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Type</label>
              <Segmented<CalNature> value={nature} onChange={setNature} options={natureOptions} />
            </div>
          )}

          {/* Titre */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">{TITLE_LABEL[nature]} *</label>
            <Input value={title} onChange={e => { setTitle(e.target.value); setError("") }}
              placeholder={TITLE_LABEL[nature]} className="h-8" />
          </div>

          {/* Journée entière (événements uniquement) */}
          {allowAllDay && (
            <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-muted-foreground">
              <input type="checkbox" checked={allDay}
                onChange={e => { setAllDay(e.target.checked); if (e.target.checked) setTime("") }}
                className="h-3.5 w-3.5 rounded border-input accent-primary" />
              Journée entière
            </label>
          )}

          {/* Date + Heure / Date de fin */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                {allowAllDay && allDay ? "Début" : DATE_LABEL[nature]}
              </label>
              <DatePicker value={date} onChange={setDate} ariaLabel={DATE_LABEL[nature]} />
            </div>
            {allowAllDay && allDay ? (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Fin <span className="text-muted-foreground/50">(opt.)</span>
                </label>
                <DatePicker value={endDate} onChange={setEndDate} min={date}
                  placeholder="Même jour" ariaLabel="Date de fin" />
              </div>
            ) : (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Heure <span className="text-muted-foreground/50">(opt.)</span>
                </label>
                <TimePicker value={time} onChange={setTime} ariaLabel="Heure" />
              </div>
            )}
          </div>

          {/* Champ spécifique : priorité (tâche) */}
          {nature === "task" && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Priorité</label>
              <Segmented value={priority} onChange={setPriority}
                options={PRIORITIES.map(([v, l]) => ({ value: v, label: l }))} />
            </div>
          )}

          {/* Champ spécifique : canal (interaction) */}
          {nature === "interaction" && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Canal</label>
              <Segmented value={channel} onChange={setChannel}
                options={CHANNELS.map(([v, l]) => ({ value: v, label: l }))} />
            </div>
          )}

          {/* Description */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              {nature === "interaction" ? "Réponse / notes" : "Description"}
            </label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2}
              placeholder="Notes, détails…"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground/50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none" />
          </div>

          {/* Catégorie (événement / note uniquement) */}
          {showCategory && categories.length > 0 && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Catégorie</label>
              <div className="flex flex-wrap gap-1.5">
                {categories.map(cat => (
                  <button key={cat.id} type="button" onClick={() => setCategoryId(cat.id)}
                    className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                      categoryId === cat.id ? "border-current" : "border-border text-muted-foreground hover:border-current hover:opacity-80")}
                    style={categoryId === cat.id ? { color: cat.color, borderColor: cat.color, backgroundColor: cat.color + "20" } : {}}>
                    <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                    {cat.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {nature === "note" && (
            <p className="text-[11px] text-muted-foreground/70">
              {"Crée une entrée dans le journal du projet + un repère daté dans l'agenda."}
            </p>
          )}

          {error && <p className="text-xs text-red-500">{error}</p>}
          <div className="flex items-center justify-between gap-2 pt-1">
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground/70">
              <kbd className="rounded border border-border/70 bg-muted px-1 font-mono text-[10px]">↵</kbd>
              pour créer
            </span>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={onClose}>Annuler</Button>
              <Button size="sm" disabled={isPending} onClick={handleSubmit}>
                {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Créer"}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── Dialog Détail / Modification d'un événement ──────────────────────────────

function EventDetailDialog({
  event, onClose, onSaved, categories, projects, clients,
}: {
  event: CalendarEvent
  onClose: () => void
  onSaved?: (eventId: string) => void
  categories: CalendarCategory[]
  projects: ProjectOption[]
  clients: ClientOption[]
}) {
  const router = useRouter()
  const itemType = event.type as CalItemType
  const isManual = itemType === "manual"
  const d0 = new Date(event.date)

  const [title, setTitle]             = useState(event.title)
  const [date, setDate]               = useState(d0.toISOString().slice(0, 10))
  const [time, setTime]               = useState(timeStringFromDate(d0, event.allDay))
  const [description, setDescription] = useState(event.description ?? "")
  const [categoryId, setCategoryId]   = useState(event.categoryId ?? "")
  const [projectId, setProjectId]     = useState(event.projectId ?? "")
  const [clientId, setClientId]       = useState(event.clientId ?? "")
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError]             = useState("")
  const [isSaving, startSave]         = useTransition()
  const [isDeleting, startDelete]     = useTransition()

  // Liens de navigation : pour un événement manuel, dérivés des sélecteurs ;
  // pour les autres entités, fournis par la projection (lecture seule).
  const linkedProject = isManual
    ? projects.find(p => p.id === projectId)
    : (event.projectId ? { id: event.projectId, name: event.projectName ?? "Projet", clientName: event.clientName ?? "" } : undefined)
  const linkedClient = isManual
    ? (!projectId ? clients.find(c => c.id === clientId) : undefined)
    : (event.clientId ? { id: event.clientId, label: event.clientName ?? "Client" } : undefined)

  function handleSave() {
    if (!title.trim()) { setError("Le titre est requis"); return }
    startSave(async () => {
      const startDate = parseDateTimeFromForm(date, time)
      const res = await updateCalendarItem(itemType, event.id, {
        title: title.trim(),
        description: description || null,
        startDate,
        allDay: !time,
        ...(isManual ? {
          categoryId: categoryId || null,
          projectId: projectId || null,
          clientId: clientId || null,
        } : {}),
      })
      if (res.error) { setError(res.error); return }
      router.refresh()
      onSaved?.(event.id)
      onClose()
    })
  }

  function handleDelete() {
    startDelete(async () => {
      await deleteCalendarItem(itemType, event.id)
      router.refresh()
      onClose()
    })
  }

  const color = evColor(event)

  return (
    <Dialog open onOpenChange={v => { if (!v) onClose() }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
            {EDIT_TITLE[itemType]}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 pt-1" onKeyDown={e => {
          // Entrée valide les modifications (sauf dans la description multi-ligne).
          const tag = (e.target as HTMLElement)?.tagName
          if (e.key === "Enter" && tag !== "TEXTAREA" && tag !== "BUTTON" && !isSaving) {
            e.preventDefault()
            handleSave()
          }
        }}>
          {isManual ? (
            <EventFormFields
              title={title} setTitle={v => { setTitle(v); setError("") }}
              date={date} setDate={setDate}
              time={time} setTime={setTime}
              description={description} setDescription={setDescription}
              categoryId={categoryId} setCategoryId={setCategoryId}
              projectId={projectId} setProjectId={setProjectId}
              clientId={clientId} setClientId={setClientId}
              categories={categories} projects={projects} clients={clients}
            />
          ) : (
            <>
              {/* Titre */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Intitulé *</label>
                <Input value={title} onChange={e => { setTitle(e.target.value); setError("") }} className="h-8" />
              </div>
              {/* Date + Heure */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">
                    {itemType === "task" || itemType === "reminder" ? "Échéance" : "Date"}
                  </label>
                  <DatePicker value={date} onChange={setDate}
                    ariaLabel={itemType === "task" || itemType === "reminder" ? "Échéance" : "Date"} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">
                    Heure <span className="text-muted-foreground/50">(opt.)</span>
                  </label>
                  <TimePicker value={time} onChange={setTime} ariaLabel="Heure" />
                </div>
              </div>
              {/* Description */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  {itemType === "interaction" ? "Réponse / notes" : "Description"}
                </label>
                <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2}
                  placeholder="Notes, détails…"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground/50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none" />
              </div>
            </>
          )}

          {/* Liens de navigation */}
          {(linkedProject || linkedClient) && (
            <div className="flex flex-col gap-1 pt-0.5">
              {linkedProject && (
                <Link href={`/projets/${linkedProject.id}`} onClick={onClose}
                  className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline">
                  <ExternalLink className="h-3 w-3" />
                  Voir le projet — {linkedProject.name}
                  {linkedProject.clientName && <span className="text-muted-foreground">· {linkedProject.clientName}</span>}
                </Link>
              )}
              {linkedClient && (
                <Link href={`/contacts/${linkedClient.id}`} onClick={onClose}
                  className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline">
                  <ExternalLink className="h-3 w-3" />
                  Voir le contact — {linkedClient.label}
                </Link>
              )}
            </div>
          )}

          {error && <p className="text-xs text-red-500">{error}</p>}

          {/* Actions */}
          <div className="flex items-center justify-between pt-1">
            {!confirmDelete ? (
              <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(true)}
                className="text-destructive hover:text-destructive hover:bg-destructive/10 gap-1.5">
                <Trash2 className="h-3.5 w-3.5" />
                Supprimer
              </Button>
            ) : (
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground">Confirmer ?</span>
                <Button variant="ghost" size="sm" disabled={isDeleting} onClick={handleDelete}
                  className="h-7 px-2 text-destructive hover:bg-destructive/10">
                  {isDeleting ? <Loader2 className="h-3 w-3 animate-spin" /> : "Oui"}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)} className="h-7 px-2">
                  Non
                </Button>
              </div>
            )}
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1 text-[11px] text-muted-foreground/70">
                <kbd className="rounded border border-border/70 bg-muted px-1 font-mono text-[10px]">↵</kbd>
              </span>
              <Button variant="ghost" size="sm" onClick={onClose}>Annuler</Button>
              <Button size="sm" disabled={isSaving} onClick={handleSave}>
                {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Enregistrer"}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── Connexion Google Calendar ─────────────────────────────────────────────────

const GOOGLE_CALENDAR_SCOPES = [
  "openid", "email", "profile",
  // calendar (lecture/écriture complète) : requis pour CRÉER l'agenda dédié
  // "ERP Freelance" + lui appliquer une couleur. Englobe readonly + events.
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/calendar.events",
].join(" ")

// L'utilisateur est déjà authentifié via Google (seul provider de connexion).
// On ne « reconnecte » donc pas : on demande uniquement l'autorisation
// incrémentale d'accès à Google Agenda. Google n'affiche que l'écran de
// consentement pour ces scopes (pas de saisie de mot de passe).
function grantCalendarAccess() {
  signIn("google", { callbackUrl: "/calendrier" }, {
    scope: GOOGLE_CALENDAR_SCOPES,
    // conserve les scopes déjà accordés (autorisation incrémentale)
    include_granted_scopes: "true",
    // force l'écran de consentement → garantit la réception du refresh_token
    prompt: "consent",
    access_type: "offline",
  })
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  )
}

// ── CalendarView (orchestrateur) ──────────────────────────────────────────────

export function CalendarView({
  events,
  categories = [],
  projects = [],
  clients = [],
  hasGoogleCalendar = false,
  className,
}: {
  events: CalendarEvent[]
  categories?: CalendarCategory[]
  projects?: ProjectOption[]
  clients?: ClientOption[]
  hasGoogleCalendar?: boolean
  className?: string
}) {
  const { isActive } = useModules()
  const [viewMode, setViewMode]         = useState<ViewMode>("month")
  const [currentDate, setCurrentDate]   = useState(() => { const d = new Date(); d.setHours(0,0,0,0); return d })
  const [selectedDay, setSelectedDay]   = useState<Date | null>(null)
  const [mounted, setMounted]           = useState(false)
  const [newEventOpen, setNewEventOpen] = useState(false)
  const [newEventDate, setNewEventDate] = useState(() => new Date())
  const [hiddenTypes, setHiddenTypes] = useState<Set<string>>(new Set())
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null)
  const [isSyncing, startSync]          = useTransition()
  const [syncStatus, setSyncStatus]     = useState<"idle" | "success" | "error" | "noPermission">("idle")
  const [syncCount, setSyncCount]       = useState(0)
  const [syncError, setSyncError]       = useState<string>("")
  // État réel de la connexion (persistant, contrairement à syncStatus qui
  // revient à "idle" après quelques secondes) — reflète si la synchro
  // fonctionnerait maintenant, sans attendre un clic sur "Sync".
  const [connectionStatus, setConnectionStatus] = useState<"checking" | "connected" | "error">("checking")
  const [showGoogleEvents, setShowGoogleEvents] = useState(true)
  const [, startRefresh]                = useTransition()
  const [justMovedId, setJustMovedId]   = useState<string | null>(null)
  const justMovedTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingFlashRef = useRef<string | null>(null)
  const router = useRouter()

  // Demande l'animation d'« atterrissage » pour un événement déplacé / édité.
  // On ne déclenche pas tout de suite : router.refresh() est asynchrone, donc on
  // mémorise l'id et on joue l'anim seulement quand les nouvelles données (l'élément
  // à sa nouvelle place) sont effectivement rendues — sinon l'anim partirait sur
  // l'ancienne position et ne rejouerait jamais à la bonne.
  function flashEvent(id: string) {
    pendingFlashRef.current = id
  }
  // Quand la liste d'événements change (après refresh), si une animation est en
  // attente et que l'événement est bien présent, on la joue à sa position finale.
  useEffect(() => {
    const id = pendingFlashRef.current
    if (!id || !events.some(e => e.id === id)) return
    pendingFlashRef.current = null
    if (justMovedTimer.current) clearTimeout(justMovedTimer.current)
    setJustMovedId(id)
    justMovedTimer.current = setTimeout(() => setJustMovedId(null), 700)
  }, [events])
  useEffect(() => () => { if (justMovedTimer.current) clearTimeout(justMovedTimer.current) }, [])

  useEffect(() => {
    const stored = localStorage.getItem(VIEW_STORAGE_KEY) as ViewMode | null
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (stored && ["day","3day","5day","week","month"].includes(stored)) setViewMode(stored)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true)
  }, [])

  // Raccourcis clavier globaux (page calendrier) : "c" ou "n" → nouvel événement.
  // Ignorés si on tape dans un champ ou si un dialog est déjà ouvert.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const el = e.target as HTMLElement | null
      const tag = el?.tagName
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el?.isContentEditable) return
      if (newEventOpen || editingEvent) return
      const k = e.key.toLowerCase()
      if (k === "c" || k === "n") {
        e.preventDefault()
        setNewEventDate(new Date())
        setNewEventOpen(true)
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [newEventOpen, editingEvent])

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

  // Vérifie l'état réel de la connexion dès l'ouverture de la page (sans
  // attendre un clic sur "Sync") — répond à "comment savoir si la synchro
  // est toujours active en rouvrant l'app le lendemain". Si la connexion est
  // saine, déclenche aussi une synchro (même fenêtre bornée à 1 mois que
  // d'habitude) : sans ça, "connecté" en vert donnait l'impression à tort que
  // les événements Google étaient à jour, alors qu'aucune donnée n'est
  // réellement retirée tant qu'on n'a pas cliqué sur Sync ou navigué dans le
  // passé — d'où des agendas vides en rouvrant l'app après une absence.
  useEffect(() => {
    if (!hasGoogleCalendar) return
    let cancelled = false
    getGoogleCalendarConnectionStatus()
      .then((res) => {
        if (cancelled) return
        const ok = res.status === "connected"
        setConnectionStatus(ok ? "connected" : "error")
        if (ok) handleSync()
      })
      .catch(() => { if (!cancelled) setConnectionStatus("error") })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasGoogleCalendar])

  // Fenêtre Google déjà synchronisée en arrière (mois). 1 par défaut, comme le
  // serveur — élargie à la volée par l'effet de navigation ci-dessous plutôt
  // que de tout récupérer d'un coup (voir commentaire dans syncGoogleEvents).
  const syncedMonthsBackRef = useRef(1)

  function handleSync(monthsBack?: number) {
    const target = monthsBack ?? syncedMonthsBackRef.current
    startSync(async () => {
      // Un timeout réseau ou une exception côté serveur (ex : fonction serverless
      // coupée avant de répondre) rejette cette promesse sans passer par le retour
      // { error } normal — sans ce try/catch, le bouton restait bloqué en "Sync…"
      // indéfiniment puisque aucun setSyncStatus n'était jamais atteint.
      try {
        const result = await syncGoogleEvents(target)
        if (result.needsPermission) {
          setSyncStatus("noPermission")
          setConnectionStatus("error")
          setTimeout(() => setSyncStatus("idle"), 6000)
        } else if (result.error) {
          setSyncStatus("error")
          setSyncError(result.error)
          setConnectionStatus("error")
          // l'erreur reste affichée jusqu'à la prochaine sync (pas d'auto-effacement)
        } else {
          syncedMonthsBackRef.current = target
          setSyncStatus("success")
          setSyncCount(result.synced)
          setSyncError("")
          setConnectionStatus("connected")
          router.refresh()
          setTimeout(() => setSyncStatus("idle"), 4000)
        }
      } catch (err) {
        setSyncStatus("error")
        setSyncError(err instanceof Error ? err.message : "Connexion interrompue")
        setConnectionStatus("error")
      }
    })
  }

  // Élargit la synchro Google à la demande quand on navigue plus loin dans le
  // passé que ce qui a déjà été récupéré — évite de tout pull d'un coup tout en
  // gardant le calendrier alimenté quel que soit le mois consulté. +2 mois de
  // marge pour ne pas redéclencher un sync à chaque changement de mois.
  useEffect(() => {
    if (!hasGoogleCalendar || isSyncing) return
    const today = new Date()
    const monthsBack = (today.getFullYear() - currentDate.getFullYear()) * 12
      + (today.getMonth() - currentDate.getMonth())
    if (monthsBack <= syncedMonthsBackRef.current) return
    handleSync(monthsBack + 2)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentDate, hasGoogleCalendar])

  function handleMoveEvent(eventId: string, newStart: Date, newEnd: Date | null, allDay: boolean) {
    const ev = events.find(x => x.id === eventId)
    if (!ev || !isEditable(ev)) return
    startRefresh(async () => {
      await moveCalendarItem(ev.type as CalItemType, eventId, newStart, newEnd, allDay)
      router.refresh()
      flashEvent(eventId)
    })
  }

  function handleEventClick(ev: CalendarEvent) {
    if (isEditable(ev)) setEditingEvent(ev)
    else if (ev.href) router.push(ev.href)
  }

  function toggleType(t: string) {
    setHiddenTypes(prev => {
      const next = new Set(prev)
      if (next.has(t)) next.delete(t)
      else next.add(t)
      return next
    })
  }

  // Masque les événements des modules désactivés (santé, entretien).
  const moduleFiltered = events.filter(e => {
    if (e.type === "health"    && !isActive("sante"))     return false
    if (e.type === "interview" && !isActive("entretien")) return false
    if (e.type === "expense"   && !isActive("depenses"))  return false
    return true
  })

  const baseEvents = (hasGoogleCalendar && !showGoogleEvents)
    ? moduleFiltered.filter(e => !e.isGoogle)
    : moduleFiltered

  const filteredEvents = hiddenTypes.size > 0
    ? baseEvents.filter(e => !hiddenTypes.has(e.type))
    : baseEvents

  const viewDays = getViewDays()

  // Événements de la période courante (avant filtre par type) → sert aux compteurs
  // pour que masquer un type n'efface pas son compteur.
  const periodEvents = viewMode === "month"
    ? baseEvents.filter(e => { const d = new Date(e.date); return d.getFullYear() === currentDate.getFullYear() && d.getMonth() === currentDate.getMonth() })
    : baseEvents.filter(e => viewDays.some(d => isSameDay(d, new Date(e.date))))

  if (!mounted) return <div className={cn("flex flex-col gap-3", className)} />

  return (
    <div className={cn("flex flex-col gap-3", className)}>

      {/* ── Barre de navigation ──────────────────────────────────────────── */}
      {/* pr-12 : réserve la place du bouton flottant de notifications (haut-droite) */}
      <div className="flex items-center gap-2 shrink-0 flex-wrap pr-12">
        <div className="flex items-center gap-1">
          <button onClick={() => navigate(-1)} className="rounded-lg border border-border p-1.5 hover:bg-muted transition-colors">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button onClick={() => navigate(1)} className="rounded-lg border border-border p-1.5 hover:bg-muted transition-colors">
            <ChevronRight className="h-4 w-4" />
          </button>
          <button onClick={goToToday} className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-muted transition-colors">
            {"Aujourd'hui"}
          </button>
        </div>

        <h2 className="text-base font-semibold capitalize flex-1 min-w-0 truncate">{headerLabel()}</h2>

        {hasGoogleCalendar ? (
          <div className="flex items-center rounded-lg border border-border overflow-hidden">
            <button onClick={() => handleSync()} disabled={isSyncing}
              title={
                connectionStatus === "error"    ? "Connexion Google Calendar en erreur — cliquez pour réessayer"
                  : connectionStatus === "checking" ? "Vérification de la connexion Google Calendar…"
                  : "Synchroniser avec Google Calendar"
              }
              className={cn("inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium transition-colors border-r border-border/50",
                syncStatus === "success"      ? "text-emerald-600 bg-emerald-500/5"
                  : syncStatus === "error"        ? "text-red-600 bg-red-500/5"
                  : syncStatus === "noPermission" ? "text-amber-600 bg-amber-500/5"
                  : connectionStatus === "connected" ? "text-emerald-600 bg-emerald-500/5"
                  : connectionStatus === "error"     ? "text-red-600 bg-red-500/5"
                  : "text-muted-foreground hover:bg-muted")}
            >
              <span className={cn("h-1.5 w-1.5 rounded-full shrink-0",
                syncStatus === "success" || connectionStatus === "connected" ? "bg-emerald-500"
                  : syncStatus === "error" || syncStatus === "noPermission" || connectionStatus === "error" ? "bg-red-500"
                  : "bg-muted-foreground/40 animate-pulse")}
              />
              {isSyncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : syncStatus === "success" ? <Check className="h-3.5 w-3.5" />
                : (syncStatus === "error" || syncStatus === "noPermission") ? <AlertCircle className="h-3.5 w-3.5" />
                : <RefreshCw className="h-3.5 w-3.5" />}
              <span>
                {isSyncing ? "Sync…"
                  : syncStatus === "success" ? `${syncCount} sync`
                  : syncStatus === "error" ? "Erreur"
                  : syncStatus === "noPermission" ? "Autorisation"
                  : connectionStatus === "error" ? "Reconnexion"
                  : "Sync"}
              </span>
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger title="Paramètres Google Calendar"
                className="inline-flex items-center px-2 py-1.5 text-muted-foreground hover:bg-muted transition-colors">
                <Settings2 className="h-3.5 w-3.5" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className={cn("flex items-center gap-1.5 px-1.5 py-1 text-xs font-medium",
                  connectionStatus === "error" ? "text-red-600"
                    : connectionStatus === "checking" ? "text-muted-foreground"
                    : "text-emerald-600")}
                >
                  {connectionStatus === "error" ? <AlertCircle className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
                  {connectionStatus === "error" ? "Connexion en erreur — réautorisez"
                    : connectionStatus === "checking" ? "Vérification de la connexion…"
                    : "Google Agenda connecté"}
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setShowGoogleEvents(v => !v)}>
                  {showGoogleEvents ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  {showGoogleEvents ? "Masquer les événements Google" : "Afficher les événements Google"}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleSync()} disabled={isSyncing}>
                  <RefreshCw className="h-3.5 w-3.5" /> Synchroniser maintenant
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={grantCalendarAccess}>
                  <KeyRound className="h-3.5 w-3.5" /> {"Réautoriser l'accès"}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ) : (
          <button onClick={grantCalendarAccess} title="Autoriser l'accès à votre Google Agenda (votre compte Google est déjà connecté)"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-muted transition-colors">
            <GoogleIcon className="h-3.5 w-3.5" />
            <span>Autoriser Google Agenda</span>
          </button>
        )}

        <div className="flex items-center rounded-lg border border-border overflow-hidden">
          {(["day","3day","5day","week","month"] as ViewMode[]).map(v => (
            <button key={v} onClick={() => changeView(v)}
              className={cn("px-2.5 py-1.5 text-xs font-medium transition-colors border-r border-border/50 last:border-r-0",
                viewMode === v ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground")}>
              {VIEW_LABELS[v]}
            </button>
          ))}
        </div>

        <button onClick={() => { setNewEventDate(new Date()); setNewEventOpen(true) }}
          title="Nouvel événement (C)"
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-muted transition-colors">
          <Plus className="h-3.5 w-3.5" />
          Événement
          <kbd className="ml-0.5 rounded border border-border/70 bg-muted px-1 text-[10px] font-mono text-muted-foreground">C</kbd>
        </button>
      </div>

      {/* ── Filtres par type (chips cliquables = afficher/masquer) ─────────── */}
      <div className="flex flex-wrap items-center gap-1.5 shrink-0 text-xs">
        {periodEvents.length === 0 ? (
          <span className="italic text-muted-foreground/50">Aucun événement sur cette période</span>
        ) : (
          <>
            {Object.entries(typeConfig).map(([k, v]) => {
              const count = periodEvents.filter(e => e.type === k).length
              if (count === 0) return null
              const hidden = hiddenTypes.has(k)
              return (
                <button key={k} type="button" onClick={() => toggleType(k)}
                  title={hidden ? `Afficher : ${v.label}` : `Masquer : ${v.label}`}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-medium transition-colors",
                    hidden
                      ? "border-border/40 text-muted-foreground/50"
                      : "border-border/60 text-foreground hover:bg-muted"
                  )}>
                  <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", v.dot, hidden && "opacity-30")} />
                  <span className={cn(hidden && "line-through")}>{v.label}</span>
                  <span className="text-muted-foreground font-normal">{count}</span>
                </button>
              )
            })}
            {hiddenTypes.size > 0 && (
              <button type="button" onClick={() => setHiddenTypes(new Set())}
                className="ml-1 text-muted-foreground hover:text-foreground underline-offset-2 hover:underline">
                Tout afficher
              </button>
            )}
          </>
        )}

        {/* Coche d'affichage des événements Google Calendar */}
        {hasGoogleCalendar && (
          <>
            {periodEvents.length > 0 && <span className="mx-1 h-3.5 w-px bg-border/60" />}
            <button type="button" onClick={() => setShowGoogleEvents(v => !v)}
              title={showGoogleEvents ? "Masquer les événements Google Calendar" : "Afficher les événements Google Calendar"}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-medium transition-colors",
                showGoogleEvents ? "border-border/60 text-foreground hover:bg-muted" : "border-border/40 text-muted-foreground/50"
              )}>
              {showGoogleEvents ? <CheckSquare className="h-3.5 w-3.5 text-primary" /> : <Square className="h-3.5 w-3.5" />}
              <GoogleIcon className="h-3 w-3" />
              <span className={cn(!showGoogleEvents && "line-through")}>Google Calendar</span>
            </button>
          </>
        )}
      </div>

      {/* ── Bandeau d'erreur de synchronisation ──────────────────────────── */}
      {syncStatus === "error" && syncError && (
        <div className="shrink-0 flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/5 px-3 py-2 text-xs text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0 mt-px" />
          <div className="flex-1 min-w-0 space-y-1">
            <p className="font-medium">Échec de la synchronisation Google Calendar</p>
            {/(disabled|has not been used|accessNotConfigured)/i.test(syncError) ? (
              <p className="text-red-600/90">
                L&apos;API Google Calendar n&apos;est pas activée dans la console Google Cloud.
                Active-la dans <span className="font-medium">APIs &amp; Services → Library → Google Calendar API</span>,
                puis réessaie (laisse ~1 min de propagation).
              </p>
            ) : (
              <p className="text-red-600/90 break-words">{syncError}</p>
            )}
          </div>
          <button type="button" onClick={() => { setSyncStatus("idle"); setSyncError("") }}
            title="Fermer" className="shrink-0 text-red-700/70 hover:text-red-700">✕</button>
        </div>
      )}

      {/* ── Vue ─────────────────────────────────────────────────────────── */}
      {viewMode === "month" ? (
        <MonthView
          events={filteredEvents}
          currentDate={currentDate}
          selectedDay={selectedDay}
          setSelectedDay={setSelectedDay}
          onNewEvent={date => { setNewEventDate(date); setNewEventOpen(true) }}
          onMoveEvent={handleMoveEvent}
          onEventClick={handleEventClick}
          justMovedId={justMovedId}
        />
      ) : (
        <TimeGridView
          events={filteredEvents}
          days={viewDays}
          onNewEvent={date => { setNewEventDate(date); setNewEventOpen(true) }}
          onMoveEvent={handleMoveEvent}
          onEventClick={handleEventClick}
          onSelectDay={setSelectedDay}
          justMovedId={justMovedId}
        />
      )}

      {/* Dialog détail jour (toutes vues) */}
      <Dialog open={selectedDay !== null} onOpenChange={v => { if (!v) setSelectedDay(null) }}>
          <DialogContent className="sm:max-w-md max-h-[85vh] flex flex-col overflow-hidden">
            <DialogHeader className="shrink-0">
              <DialogTitle className="capitalize flex items-center justify-between gap-2">
                <span>{selectedDay?.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" }) ?? ""}</span>
                {selectedDay && (
                  <span className="text-xs font-normal text-muted-foreground">
                    {eventsForDay(filteredEvents, selectedDay).length} événement{eventsForDay(filteredEvents, selectedDay).length > 1 ? "s" : ""}
                  </span>
                )}
              </DialogTitle>
            </DialogHeader>
            <div className="flex-1 min-h-0 overflow-y-auto -mx-1 px-1">
              <EventList
                events={selectedDay ? eventsForDay(filteredEvents, selectedDay) : []}
                onNavigate={() => setSelectedDay(null)}
                onEventClick={ev => { setSelectedDay(null); handleEventClick(ev) }}
              />
            </div>
            <button
              type="button"
              onClick={() => { if (selectedDay) { setNewEventDate(selectedDay); setSelectedDay(null); setNewEventOpen(true) } }}
              className="shrink-0 inline-flex items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium hover:bg-muted transition-colors"
            >
              <Plus className="h-3.5 w-3.5" /> Ajouter ce jour
            </button>
          </DialogContent>
        </Dialog>

      <NewEventDialog
        open={newEventOpen}
        onClose={() => setNewEventOpen(false)}
        defaultDate={newEventDate}
        categories={categories}
        projects={projects}
        clients={clients}
      />

      {editingEvent && (
        <EventDetailDialog
          event={editingEvent}
          onClose={() => setEditingEvent(null)}
          onSaved={flashEvent}
          categories={categories}
          projects={projects}
          clients={clients}
        />
      )}
    </div>
  )
}

// ── Vue Mois ──────────────────────────────────────────────────────────────────

function MonthView({
  events, currentDate, selectedDay, setSelectedDay, onNewEvent, onMoveEvent, onEventClick, justMovedId,
}: {
  events: CalendarEvent[]
  currentDate: Date
  selectedDay: Date | null
  setSelectedDay: (d: Date | null) => void
  onNewEvent: (date: Date) => void
  onMoveEvent: MoveEventFn
  onEventClick: (ev: CalendarEvent) => void
  justMovedId?: string | null
}) {
  const year  = currentDate.getFullYear()
  const month = currentDate.getMonth()
  const today = new Date()
  const [dragOverDay, setDragOverDay] = useState<number | null>(null)

  const firstDay    = new Date(year, month, 1)
  const startOffset = (firstDay.getDay() + 6) % 7
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const cells: (number | null)[] = [
    ...Array(startOffset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  while (cells.length % 7 !== 0) cells.push(null)
  const numRows = cells.length / 7

  // Barres continues multi-jours : disposition calculée par semaine (style Google).
  const gridStart = addDays(new Date(year, month, 1), -startOffset)
  const multiDayEvents = events.filter(isMultiDaySpan)
  const rowLayouts = Array.from({ length: numRows }, (_, r) => {
    const weekDates = Array.from({ length: 7 }, (_, c) => addDays(gridStart, r * 7 + c))
    return layoutSpansForDays(multiDayEvents, weekDates)
  })
  const rowLanes = rowLayouts.map(l => l.lanes)
  const MONTH_BAR_H  = 18   // hauteur d'une lane de barre
  const MONTH_DATE_H = 24   // espace réservé au numéro du jour avant les barres

  const isToday = (day: number) =>
    day === today.getDate() && month === today.getMonth() && year === today.getFullYear()

  return (
    <div className="rounded-xl border border-border/50 bg-card overflow-hidden flex flex-col flex-1 min-h-0">
      <div className="grid grid-cols-7 border-b border-border shrink-0">
        {WEEK_DAYS.map(d => (
          <div key={d} className="py-2 text-center text-xs font-medium text-muted-foreground">{d}</div>
        ))}
      </div>
      <div className="relative grid grid-cols-7 flex-1" style={{ gridTemplateRows: `repeat(${numRows}, minmax(0, 1fr))` }}>
        {cells.map((day, i) => {
          if (!day) return (
            <div key={`e-${i}`} className={cn("border-b border-r border-border/30 bg-muted/20", i % 7 === 6 && "border-r-0")} />
          )
          const row        = Math.floor(i / 7)
          const dayDate    = new Date(year, month, day)
          const dayEvents  = eventsForDay(events, dayDate)
          // Les barres multi-jours sont dessinées par l'overlay → exclues des chips.
          const dayChips   = dayEvents.filter(e => !isMultiDaySpan(e))
          const isWeekend  = (i % 7) >= 5
          const isSelected = selectedDay ? isSameDay(selectedDay, dayDate) : false
          const isDragOver = dragOverDay === day

          return (
            <button
              key={`d-${day}`} type="button"
              onClick={() => setSelectedDay(isSelected ? null : dayDate)}
              onDoubleClick={() => onNewEvent(dayDate)}
              onDragEnter={e => { e.preventDefault(); setDragOverDay(day) }}
              onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverDay(null) }}
              onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = "move" }}
              onDrop={e => {
                e.preventDefault(); setDragOverDay(null)
                const eventId = e.dataTransfer.getData("eventId")
                if (!eventId) return
                const ev = events.find(x => x.id === eventId)
                if (!ev || !isEditable(ev)) return
                const oldDate = new Date(ev.date)
                const newDate = new Date(year, month, day)
                newDate.setHours(oldDate.getHours(), oldDate.getMinutes(), 0, 0)
                const newEnd = ev.endDate
                  ? new Date(newDate.getTime() + (new Date(ev.endDate).getTime() - new Date(ev.date).getTime()))
                  : null
                onMoveEvent(eventId, newDate, newEnd, ev.allDay ?? false)
              }}
              className={cn(
                "border-b border-r border-border/30 p-1 text-left transition-colors hover:bg-muted/30 min-w-0 overflow-hidden",
                isWeekend ? "bg-muted/10" : loadBg(dayEvents.length),
                i % 7 === 6 && "border-r-0",
                isSelected && "ring-1 ring-inset ring-primary/40 bg-primary/5",
                isDragOver && "ring-2 ring-inset ring-blue-400/70 bg-blue-50/10",
              )}
            >
              <span className={cn("flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-medium mb-0.5",
                isToday(day) ? "bg-primary text-primary-foreground" : "text-foreground")}>
                {day}
              </span>
              {/* Espace réservé aux barres multi-jours de la semaine (dessinées en overlay) */}
              {rowLanes[row] > 0 && <div aria-hidden style={{ height: rowLanes[row] * MONTH_BAR_H }} />}
              <div className="space-y-px">
                {dayChips.slice(0, 2).map(ev => (
                  <div
                    key={ev.id}
                    draggable={isEditable(ev)}
                    onDragStart={isEditable(ev) ? e => {
                      e.stopPropagation()
                      e.dataTransfer.setData("eventId", ev.id)
                      e.dataTransfer.effectAllowed = "move"
                    } : undefined}
                    onClick={e => {
                      e.stopPropagation()
                      onEventClick(ev)
                    }}
                    className={cn(
                      "flex items-center gap-1 rounded px-1 py-px text-[10px] leading-tight truncate cursor-pointer hover:opacity-80 group",
                      ev.isLate ? "bg-red-500/10" : "bg-muted/50",
                      justMovedId === ev.id && "cal-bar-land",
                    )}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full shrink-0 ${ev.categoryColor ? "" : typeConfig[ev.type]?.dot ?? ""}`}
                      style={ev.categoryColor ? { backgroundColor: ev.categoryColor } : {}}
                    />
                    <span className="truncate">{ev.title}</span>
                    {isEditable(ev)
                      ? <Pencil className="h-2 w-2 shrink-0 opacity-0 group-hover:opacity-50 ml-auto" />
                      : ev.href ? <ExternalLink className="h-2 w-2 shrink-0 opacity-0 group-hover:opacity-50 ml-auto" /> : null}
                  </div>
                ))}
                {dayChips.length > 2 && (
                  <p className="text-[10px] text-muted-foreground pl-1 leading-tight">+{dayChips.length - 2}</p>
                )}
              </div>
            </button>
          )
        })}

        {/* Overlay : barres continues multi-jours (alignées sur la grille des jours) */}
        <div className="pointer-events-none absolute inset-0 grid grid-cols-7"
          style={{ gridTemplateRows: `repeat(${numRows}, minmax(0, 1fr))` }}>
          {rowLayouts.flatMap((layout, r) =>
            layout.spans.map(s => {
              const ev = s.ev
              const editable = isEditable(ev)
              return (
                <div key={`${r}-${ev.id}`}
                  className="min-w-0"
                  style={{
                    gridColumn: `${s.startCol + 1} / ${s.endCol + 2}`,
                    gridRow: `${r + 1}`,
                    marginTop: MONTH_DATE_H + s.lane * MONTH_BAR_H,
                    height: MONTH_BAR_H - 3,
                    paddingLeft:  s.continuesBefore ? 0 : 3,
                    paddingRight: s.continuesAfter  ? 0 : 3,
                  }}>
                  <div className="pointer-events-auto h-full">
                    <SpanBar ev={ev}
                      continuesBefore={s.continuesBefore} continuesAfter={s.continuesAfter}
                      landing={justMovedId === ev.id}
                      draggable={editable}
                      onDragStart={editable ? e => {
                        e.stopPropagation()
                        e.dataTransfer.setData("eventId", ev.id)
                        e.dataTransfer.effectAllowed = "move"
                      } : undefined}
                      onClick={() => onEventClick(ev)} />
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}

// ── Vue grille horaire (Jour / 3j / 5j / 7j) ─────────────────────────────────

function TimeGridView({
  events, days, onNewEvent, onMoveEvent, onEventClick, onSelectDay, justMovedId,
}: {
  events: CalendarEvent[]
  days: Date[]
  onNewEvent: (date: Date) => void
  onMoveEvent: MoveEventFn
  onEventClick: (ev: CalendarEvent) => void
  onSelectDay: (d: Date) => void
  justMovedId?: string | null
}) {
  const cols    = days.length
  const totalH  = (HOUR_END - HOUR_START) * HOUR_HEIGHT

  // Horloge vivante : se rafraîchit chaque minute pour faire avancer la barre
  // de l'heure actuelle.
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(id)
  }, [])
  const today = now

  // Position verticale de la barre « maintenant » (null si hors plage horaire affichée)
  const nowInRange = now.getHours() >= HOUR_START && now.getHours() < HOUR_END
  const nowYGutter = nowInRange && days.some(d => isSameDay(d, now)) ? timeToY(now) : null
  const nowLabel   = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`

  const grabOffsetRef = useRef(0)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [draggingId, setDraggingId]   = useState<string | null>(null)
  const [dropPreview, setDropPreview] = useState<{ colIdx: number; snapY: number; timeLabel: string } | null>(null)
  // Créneau survolé : affiche un indicateur d'ajout rapide à l'heure pointée.
  const [hoverSlot, setHoverSlot]     = useState<{ colIdx: number; snapY: number; h: number; m: number; timeLabel: string } | null>(null)

  useEffect(() => {
    const onEnd = () => { setDraggingId(null); setDropPreview(null) }
    window.addEventListener("dragend", onEnd)
    return () => window.removeEventListener("dragend", onEnd)
  }, [])

  // Défile sur le matin (ou l'heure courante si aujourd'hui est affiché) à
  // l'ouverture / au changement de vue : la journée complète (0-24h) est
  // disponible au scroll mais on ne fixe pas les heures creuses de la nuit.
  const daysKey = days.map(d => d.toISOString()).join("|")
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const target = days.some(d => isSameDay(d, new Date()))
      ? Math.max(0, new Date().getHours() - 1)
      : SCROLL_TO_HOUR
    el.scrollTop = (target - HOUR_START) * HOUR_HEIGHT
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [daysKey])

  const timedByDay   = days.map(d => eventsForDay(events, d).filter(isTimedEvent))
  // Bandeau journée entière : barres continues (multi-jours comme mono-jour).
  const allDayLayout = layoutSpansForDays(events, days)
  const BAND_LANE_H  = 22

  function startDrag(e: React.DragEvent, ev: CalendarEvent, fromAllDay = false) {
    if (!isEditable(ev)) { e.preventDefault(); return }
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    grabOffsetRef.current = fromAllDay ? 0 : Math.max(0, e.clientY - rect.top)
    e.dataTransfer.setData("eventId", ev.id)
    e.dataTransfer.effectAllowed = "move"
    setDraggingId(ev.id)
  }

  function calcSlotAt(e: React.MouseEvent | React.DragEvent, withGrab: boolean) {
    const colRect  = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const relY     = Math.max(0, e.clientY - colRect.top - (withGrab ? grabOffsetRef.current : 0))
    const totalMin = snapMinutes(relY / HOUR_HEIGHT * 60)
    const h = Math.floor(totalMin / 60) + HOUR_START
    const m = totalMin % 60
    return { totalMin, snapY: (totalMin / 60) * HOUR_HEIGHT, h, m, timeLabel: `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}` }
  }

  function calcSnap(e: React.DragEvent) {
    return calcSlotAt(e, true)
  }

  function handleColDragOver(e: React.DragEvent, colIdx: number) {
    e.preventDefault(); e.dataTransfer.dropEffect = "move"
    const { snapY, timeLabel } = calcSnap(e)
    setDropPreview({ colIdx, snapY, timeLabel })
  }

  function handleColDrop(e: React.DragEvent, date: Date) {
    e.preventDefault()
    const eventId = e.dataTransfer.getData("eventId")
    if (!eventId) { clearDrag(); return }
    const ev = events.find(x => x.id === eventId)
    if (!ev || !isEditable(ev)) { clearDrag(); return }
    const { totalMin } = calcSnap(e)
    const h = Math.floor(totalMin / 60) + HOUR_START
    const m = totalMin % 60
    const newStart = new Date(date)
    newStart.setHours(h, m, 0, 0)
    const newEnd = ev.endDate
      ? new Date(newStart.getTime() + (new Date(ev.endDate).getTime() - new Date(ev.date).getTime()))
      : null
    onMoveEvent(eventId, newStart, newEnd, false)
    clearDrag()
  }

  function handleAllDayDrop(e: React.DragEvent, date: Date) {
    e.preventDefault()
    const eventId = e.dataTransfer.getData("eventId")
    if (!eventId) { clearDrag(); return }
    const ev = events.find(x => x.id === eventId)
    if (!ev || !isEditable(ev)) { clearDrag(); return }
    const newDate = new Date(date); newDate.setHours(0, 0, 0, 0)
    onMoveEvent(eventId, newDate, null, true)
    clearDrag()
  }

  function clearDrag() { setDraggingId(null); setDropPreview(null) }

  return (
    <div className="rounded-xl border border-border/50 bg-card overflow-hidden flex flex-col flex-1 min-h-0">

      {/* En-têtes des jours */}
      <div className="flex border-b border-border shrink-0">
        <div style={{ width: TIME_COL_W }} className="shrink-0" />
        {days.map(date => {
          const isToday   = isSameDay(date, today)
          const isWeekend = date.getDay() === 0 || date.getDay() === 6
          return (
            <button key={date.toISOString()} type="button"
              onClick={() => onSelectDay(date)}
              title="Voir le détail de la journée"
              className={cn("flex-1 py-2.5 text-center border-l border-border/30 transition-colors hover:bg-muted/40 cursor-pointer", isWeekend && "bg-muted/10", isToday && "bg-primary/5")}>
              <p className="text-xs text-muted-foreground capitalize">
                {date.toLocaleDateString("fr-FR", { weekday: cols <= 3 ? "long" : "short" })}
              </p>
              <span className={cn("inline-flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold mt-0.5",
                isToday ? "bg-primary text-primary-foreground" : "text-foreground")}>
                {date.getDate()}
              </span>
              {cols <= 3 && (
                <p className="text-[10px] text-muted-foreground capitalize mt-0.5">
                  {date.toLocaleDateString("fr-FR", { month: "long" })}
                </p>
              )}
            </button>
          )
        })}
      </div>

      {/* Bandeau journée entière : barres continues multi-jours (style Google) */}
      {allDayLayout.lanes > 0 && (
        <div className="flex border-b border-border/50 shrink-0 bg-muted/20">
          <div style={{ width: TIME_COL_W }}
            className="shrink-0 flex items-start justify-end pr-2 pt-1.5 text-[10px] text-muted-foreground/50 font-medium">
            Jour
          </div>
          <div className="relative flex-1" style={{ height: allDayLayout.lanes * BAND_LANE_H + 6 }}>
            {/* Cibles de drop par jour (sous les barres) */}
            <div className="absolute inset-0 flex">
              {days.map((d, i) => (
                <div key={i} className="flex-1 border-l border-border/30"
                  onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = "move" }}
                  onDrop={e => handleAllDayDrop(e, d)} />
              ))}
            </div>
            {/* Barres continues */}
            {allDayLayout.spans.map(s => {
              const ev = s.ev
              const editable = isEditable(ev)
              const span = s.endCol - s.startCol + 1
              return (
                <div key={ev.id} className="absolute"
                  style={{
                    left:  `calc(${(s.startCol / cols) * 100}% + 3px)`,
                    width: `calc(${(span / cols) * 100}% - 6px)`,
                    top:    s.lane * BAND_LANE_H + 3,
                    height: BAND_LANE_H - 4,
                  }}>
                  <SpanBar ev={ev}
                    continuesBefore={s.continuesBefore} continuesAfter={s.continuesAfter}
                    isDragging={draggingId === ev.id}
                    landing={justMovedId === ev.id}
                    draggable={editable}
                    onDragStart={editable ? e => { e.stopPropagation(); startDrag(e, ev, true) } : undefined}
                    onClick={() => onEventClick(ev)} />
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Grille horaire */}
      <div ref={scrollRef} className="flex flex-1 overflow-y-auto">
        <div className="shrink-0 relative" style={{ width: TIME_COL_W, height: totalH }}>
          {Array.from({ length: HOUR_END - HOUR_START }, (_, i) => (
            <div key={i} style={{ top: i * HOUR_HEIGHT }}
              className="absolute w-full flex items-start justify-end pr-2 pt-0.5">
              <span className="text-[10px] text-muted-foreground/50 tabular-nums leading-none">
                {String(HOUR_START + i).padStart(2, "0")}h
              </span>
            </div>
          ))}
          {/* Étiquette de l'heure actuelle */}
          {nowYGutter !== null && (
            <div style={{ top: nowYGutter }} className="absolute inset-x-0 z-20 flex justify-end pr-1 -translate-y-1/2 pointer-events-none">
              <span className="rounded bg-red-500 px-1 py-px text-[10px] font-semibold text-white tabular-nums leading-none shadow-sm">
                {nowLabel}
              </span>
            </div>
          )}
        </div>

        {days.map((date, di) => {
          const isToday   = isSameDay(date, today)
          const isWeekend = date.getDay() === 0 || date.getDay() === 6
          const dayTimed  = timedByDay[di]
          const dayLayout = computeOverlapLayout(dayTimed)
          const nowY      = isToday && nowInRange ? timeToY(now) : null
          const preview   = dropPreview?.colIdx === di ? dropPreview : null

          return (
            <div key={date.toISOString()}
              className={cn("flex-1 relative border-l border-border/30",
                isToday && "bg-primary/5",
                !isToday && isWeekend && "bg-muted/10",
                preview && "bg-blue-500/3")}
              style={{ height: totalH }}
              onDragOver={e => handleColDragOver(e, di)}
              onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDropPreview(null) }}
              onDrop={e => handleColDrop(e, date)}
            >
              {Array.from({ length: HOUR_END - HOUR_START }, (_, i) => (
                <div key={i} style={{ top: i * HOUR_HEIGHT }}
                  className="absolute inset-x-0 border-t border-border/20 pointer-events-none" />
              ))}
              {Array.from({ length: HOUR_END - HOUR_START }, (_, i) => (
                <div key={`h-${i}`} style={{ top: i * HOUR_HEIGHT + HOUR_HEIGHT / 2 }}
                  className="absolute inset-x-0 border-t border-border/10 pointer-events-none" />
              ))}

              {nowY !== null && (
                <div style={{ top: nowY }} className="absolute inset-x-0 z-10 flex items-center pointer-events-none -translate-y-1/2">
                  <span className="h-2.5 w-2.5 rounded-full bg-red-500 shrink-0 -ml-1.5 ring-2 ring-card" />
                  <div className="flex-1 h-0.5 bg-red-500" />
                </div>
              )}

              {/* Prévisualisation drop */}
              {preview && (
                <div style={{ top: preview.snapY }}
                  className="absolute inset-x-0 z-30 flex items-center pointer-events-none">
                  <span className="h-2.5 w-2.5 rounded-full bg-blue-500 shrink-0 -ml-1.5 shadow-sm" />
                  <div className="flex-1 h-0.5 bg-blue-500" />
                  <span className="text-[10px] font-semibold text-blue-600 bg-background border border-blue-200 rounded px-1 py-px ml-1 mr-1 shadow-sm tabular-nums">
                    {preview.timeLabel}
                  </span>
                </div>
              )}

              {/* Zone d'ajout rapide : suit le curseur et crée à l'heure pointée */}
              <button type="button" className="absolute inset-0 w-full z-0 cursor-pointer"
                onMouseMove={e => { if (!draggingId) setHoverSlot({ colIdx: di, ...calcSlotAt(e, false) }) }}
                onMouseLeave={() => setHoverSlot(s => (s?.colIdx === di ? null : s))}
                onClick={e => {
                  const { h, m } = calcSlotAt(e, false)
                  const d = new Date(date); d.setHours(h, m, 0, 0); onNewEvent(d)
                }} />

              {/* Indicateur d'ajout au créneau survolé */}
              {hoverSlot?.colIdx === di && !draggingId && !preview && (
                <div style={{ top: hoverSlot.snapY }}
                  className="absolute inset-x-0 z-10 flex items-center pointer-events-none -translate-y-1/2">
                  <span className="flex items-center gap-0.5 text-[10px] font-semibold text-primary bg-background border border-primary/30 rounded px-1 py-px ml-1 mr-1 shadow-sm tabular-nums">
                    <Plus className="h-2.5 w-2.5" />{hoverSlot.timeLabel}
                  </span>
                  <div className="flex-1 border-t border-dashed border-primary/50" />
                </div>
              )}

              {dayTimed.map(ev => {
                const top    = timeToY(new Date(ev.date))
                const height = eventHeightPx(ev)
                const color  = evColor(ev)
                const cfg    = typeConfig[ev.type]
                const isDragging = draggingId === ev.id

                // Disposition côte à côte en cas de chevauchement
                const pos      = dayLayout.get(ev.id) ?? { col: 0, cols: 1 }
                const widthPct = 100 / pos.cols
                const leftPct  = pos.col * widthPct

                const editable = isEditable(ev)
                return (
                  <div key={ev.id}
                    draggable={editable}
                    onDragStart={editable ? e => { e.stopPropagation(); startDrag(e, ev) } : undefined}
                    style={{
                      top, height,
                      left: `calc(${leftPct}% + 2px)`,
                      width: `calc(${widthPct}% - 4px)`,
                      backgroundColor: color + "20", borderColor: color + "60",
                    }}
                    className={cn("absolute rounded-md border px-1.5 py-0.5 overflow-hidden z-20 group transition-opacity hover:z-40",
                      (editable || ev.href) && "cursor-pointer",
                      isDragging && "opacity-30",
                      justMovedId === ev.id && "cal-event-land")}
                    onClick={editable ? e => { e.stopPropagation(); onEventClick(ev) } : undefined}
                  >
                    {!editable && ev.href ? (
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

// ── Contenu d'un événement dans la grille horaire ─────────────────────────────

function TimedEventContent({ ev, height, color, cfg }: {
  ev: CalendarEvent; height: number; color: string
  cfg: typeof typeConfig[keyof typeof typeConfig]
}) {
  const timeStr = new Date(ev.date).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
  const compact = height < 40
  return (
    <div className="h-full flex flex-col min-w-0 pointer-events-none">
      <p className="text-[11px] font-semibold leading-tight truncate" style={{ color }}>
        {compact ? `${timeStr} ${ev.title}` : ev.title}
      </p>
      {!compact && (
        <>
          <p className="text-[10px] leading-tight" style={{ color: color + "cc" }}>{timeStr}</p>
          {ev.subtitle && <p className="text-[10px] truncate mt-px" style={{ color: color + "99" }}>{ev.subtitle}</p>}
        </>
      )}
      {ev.isLate && !compact && <span className="text-[9px] text-red-500 font-medium mt-auto">En retard</span>}
    </div>
  )
}

// ── Chip événement all-day dans le bandeau ────────────────────────────────────

/**
 * Barre continue d'un événement journée entière (vue mois + bandeau).
 * S'étale sur plusieurs colonnes via un wrapper positionné par l'appelant ;
 * `continuesBefore/After` ouvrent les bords quand l'événement déborde.
 */
function SpanBar({
  ev, continuesBefore = false, continuesAfter = false, isDragging = false,
  onClick, draggable = false, onDragStart, landing = false,
}: {
  ev: CalendarEvent
  continuesBefore?: boolean
  continuesAfter?: boolean
  isDragging?: boolean
  onClick?: () => void
  draggable?: boolean
  onDragStart?: React.DragEventHandler
  landing?: boolean
}) {
  const color = evColor(ev)
  return (
    <div
      draggable={draggable}
      onDragStart={onDragStart}
      onClick={onClick ? e => { e.stopPropagation(); onClick() } : undefined}
      className={cn(
        "flex h-full items-center gap-1 px-1.5 text-[10px] font-medium leading-none overflow-hidden",
        continuesBefore ? "rounded-l-none" : "rounded-l",
        continuesAfter  ? "rounded-r-none" : "rounded-r",
        onClick && "cursor-pointer hover:opacity-85",
        draggable && "cursor-grab active:cursor-grabbing",
        isDragging && "opacity-30",
        landing && "cal-bar-land",
      )}
      style={ev.isLate
        ? { backgroundColor: "rgb(239 68 68 / 0.14)", color: "rgb(220 38 38)", boxShadow: "inset 3px 0 0 rgb(220 38 38)" }
        : { backgroundColor: color + "22", color, boxShadow: `inset 3px 0 0 ${color}` }}
    >
      {continuesBefore && <span className="shrink-0 opacity-60">‹</span>}
      <span className="truncate">{ev.title}</span>
      {continuesAfter && <span className="ml-auto shrink-0 opacity-60">›</span>}
    </div>
  )
}

// ── Liste d'événements (dialog mois) ─────────────────────────────────────────

function EventList({
  events, compact = false, onNavigate, onEventClick,
}: {
  events: CalendarEvent[]
  compact?: boolean
  onNavigate?: () => void
  onEventClick?: (ev: CalendarEvent) => void
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
        const editable = isEditable(ev)

        const inner = compact ? (
          <div className={cn("rounded-lg border p-1.5 text-[11px] leading-snug transition-colors group",
            ev.isLate ? "border-red-500/30 bg-red-500/5" : "border-border/50 bg-card",
            (ev.href || editable) && "hover:bg-muted/30 cursor-pointer")}>
            <div className="flex items-start gap-1.5">
              <span className="mt-0.5 shrink-0">{dotEl}</span>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground truncate">{ev.title}</p>
                {timeStr && <p className="text-muted-foreground">{timeStr}</p>}
                {ev.subtitle && <p className="text-muted-foreground truncate">{ev.subtitle}</p>}
                <span className={cn("inline-block text-[10px] rounded-full border px-1.5 py-px mt-1 font-medium", cfg.badge)}>{cfg.label}</span>
              </div>
              {(ev.href || editable) && (
                editable
                  ? <Pencil className="h-3 w-3 text-muted-foreground/50 shrink-0 mt-0.5 group-hover:text-muted-foreground" />
                  : <ExternalLink className="h-3 w-3 text-muted-foreground/50 shrink-0 mt-0.5 group-hover:text-muted-foreground" />
              )}
            </div>
          </div>
        ) : (
          <div className={cn("flex items-start gap-3 rounded-lg border p-3 transition-colors group",
            (ev.href || editable) && "hover:bg-muted/40 cursor-pointer",
            ev.isLate ? "border-red-500/30 bg-red-500/5" : "border-border/50 bg-card")}>
            <span className="mt-1 shrink-0">{dotEl}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium leading-snug">{ev.title}</p>
              {timeStr && <p className="text-xs text-muted-foreground mt-px">{timeStr}</p>}
              {ev.subtitle && <p className="text-xs text-muted-foreground mt-px">{ev.subtitle}</p>}
              {ev.description && <p className="text-xs text-muted-foreground/70 mt-px truncate">{ev.description}</p>}
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className={cn("text-xs rounded-full border px-2 py-px font-medium", cfg.badge)}>{cfg.label}</span>
                {ev.isLate && <span className="text-xs text-red-500 font-medium">En retard</span>}
              </div>
            </div>
            {(ev.href || editable) && (
              editable
                ? <Pencil className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-1 opacity-50 group-hover:opacity-100" />
                : <ExternalLink className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-1" />
            )}
          </div>
        )

        if (editable && onEventClick) {
          return <div key={ev.id} onClick={() => onEventClick(ev)}>{inner}</div>
        }
        return ev.href
          ? <Link key={ev.id} href={ev.href} onClick={onNavigate}>{inner}</Link>
          : <div key={ev.id}>{inner}</div>
      })}
    </div>
  )
}
