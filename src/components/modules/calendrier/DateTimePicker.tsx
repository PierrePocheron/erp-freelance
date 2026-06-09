"use client"

/**
 * Sélecteurs date / heure custom (popover) pour remplacer les inputs natifs.
 * Travaillent sur des chaînes : DatePicker = "YYYY-MM-DD", TimePicker = "HH:MM".
 */

import { useEffect, useMemo, useRef, useState } from "react"
import { Popover } from "@base-ui/react/popover"
import { Calendar, Clock, ChevronLeft, ChevronRight, X } from "lucide-react"
import { cn } from "@/lib/utils"

// ── Helpers de format ─────────────────────────────────────────────────────────

const WEEK_LETTERS = ["L", "M", "M", "J", "V", "S", "D"]

function pad(n: number): string { return String(n).padStart(2, "0") }

/** "YYYY-MM-DD" → Date locale (midi pour éviter tout effet de bord DST). */
function parseDateStr(s: string): Date | null {
  if (!s) return null
  const [y, m, d] = s.split("-").map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d, 12, 0, 0, 0)
}

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function sameYMD(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

const POPUP_CLASS =
  "z-50 origin-(--transform-origin) rounded-lg bg-popover p-2 text-popover-foreground shadow-md ring-1 ring-foreground/10 duration-100 outline-none data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95"

const TRIGGER_CLASS =
  "flex h-8 w-full items-center gap-2 rounded-lg border border-input bg-transparent px-2.5 text-sm transition-colors outline-none hover:border-ring/60 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 data-popup-open:border-ring dark:bg-input/30"

// ── DatePicker ─────────────────────────────────────────────────────────────────

export function DatePicker({
  value, onChange, min, placeholder = "Choisir une date", className, ariaLabel,
}: {
  value: string
  onChange: (v: string) => void
  min?: string
  placeholder?: string
  className?: string
  ariaLabel?: string
}) {
  const [open, setOpen] = useState(false)
  const selected = useMemo(() => parseDateStr(value), [value])
  const minDate  = useMemo(() => parseDateStr(min ?? ""), [min])
  const [viewMonth, setViewMonth] = useState<Date>(() => {
    const base = parseDateStr(value) ?? new Date()
    return new Date(base.getFullYear(), base.getMonth(), 1)
  })

  // Recale le mois affiché sur la valeur quand on ré-ouvre le popover.
  useEffect(() => {
    if (open) {
      const base = parseDateStr(value) ?? new Date()
      setViewMonth(new Date(base.getFullYear(), base.getMonth(), 1))
    }
  }, [open, value])

  const today = new Date()
  const year  = viewMonth.getFullYear()
  const month = viewMonth.getMonth()
  const startOffset = (new Date(year, month, 1).getDay() + 6) % 7
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: (number | null)[] = [
    ...Array(startOffset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  while (cells.length % 7 !== 0) cells.push(null)

  const label = selected
    ? selected.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })
    : placeholder

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        aria-label={ariaLabel}
        className={cn(TRIGGER_CLASS, !selected && "text-muted-foreground", className)}
      >
        <Calendar className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <span className="truncate">{label}</span>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner className="isolate z-50 outline-none" side="bottom" align="start" sideOffset={6}>
          <Popover.Popup className={cn(POPUP_CLASS, "w-[15rem]")}>
            {/* En-tête mois */}
            <div className="mb-1 flex items-center justify-between">
              <button type="button"
                onClick={() => setViewMonth(new Date(year, month - 1, 1))}
                className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-sm font-medium capitalize">
                {viewMonth.toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}
              </span>
              <button type="button"
                onClick={() => setViewMonth(new Date(year, month + 1, 1))}
                className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            {/* Jours de la semaine */}
            <div className="grid grid-cols-7 gap-0.5">
              {WEEK_LETTERS.map((d, i) => (
                <div key={i} className="flex h-6 items-center justify-center text-[10px] font-medium text-muted-foreground/60">{d}</div>
              ))}
            </div>

            {/* Grille des jours */}
            <div className="grid grid-cols-7 gap-0.5">
              {cells.map((day, i) => {
                if (!day) return <div key={`e-${i}`} />
                const cellDate = new Date(year, month, day)
                const isSel   = selected ? sameYMD(selected, cellDate) : false
                const isToday = sameYMD(today, cellDate)
                const disabled = minDate ? cellDate.getTime() < new Date(minDate.getFullYear(), minDate.getMonth(), minDate.getDate()).getTime() : false
                return (
                  <button key={day} type="button" disabled={disabled}
                    onClick={() => { onChange(toDateStr(cellDate)); setOpen(false) }}
                    className={cn(
                      "flex h-7 w-7 items-center justify-center rounded-md text-xs transition-colors",
                      disabled && "cursor-not-allowed text-muted-foreground/30",
                      !disabled && !isSel && "hover:bg-accent hover:text-accent-foreground",
                      isSel && "bg-primary font-semibold text-primary-foreground",
                      !isSel && isToday && "ring-1 ring-inset ring-primary/40 font-medium",
                    )}>
                    {day}
                  </button>
                )
              })}
            </div>

            {/* Raccourci "Aujourd'hui" */}
            <button type="button"
              onClick={() => { onChange(toDateStr(new Date())); setOpen(false) }}
              className="mt-1.5 w-full rounded-md border border-border/60 py-1 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground">
              Aujourd&apos;hui
            </button>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}

// ── TimePicker ─────────────────────────────────────────────────────────────────

const TIME_SLOTS: string[] = Array.from({ length: 24 * 4 }, (_, i) => {
  const h = Math.floor(i / 4), m = (i % 4) * 15
  return `${pad(h)}:${pad(m)}`
})

export function TimePicker({
  value, onChange, clearable = true, placeholder = "Heure", className, ariaLabel,
}: {
  value: string
  onChange: (v: string) => void
  clearable?: boolean
  placeholder?: string
  className?: string
  ariaLabel?: string
}) {
  const [open, setOpen] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)
  const selectedRef = useRef<HTMLButtonElement>(null)

  // Centre l'heure sélectionnée à l'ouverture.
  useEffect(() => {
    if (open && selectedRef.current) {
      selectedRef.current.scrollIntoView({ block: "center" })
    }
  }, [open])

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        aria-label={ariaLabel}
        className={cn(TRIGGER_CLASS, !value && "text-muted-foreground", className)}
      >
        <Clock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <span className="truncate">{value || placeholder}</span>
        {clearable && value && (
          <span
            role="button" tabIndex={-1} aria-label="Effacer l'heure"
            onClick={e => { e.stopPropagation(); onChange("") }}
            className="ml-auto flex h-4 w-4 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground">
            <X className="h-3 w-3" />
          </span>
        )}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner className="isolate z-50 outline-none" side="bottom" align="start" sideOffset={6}>
          <Popover.Popup className={cn(POPUP_CLASS, "w-(--anchor-width) min-w-32 p-1")}>
            <div ref={listRef} className="max-h-56 overflow-y-auto">
              {clearable && (
                <button type="button"
                  onClick={() => { onChange(""); setOpen(false) }}
                  className="flex w-full items-center rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground">
                  Aucune heure
                </button>
              )}
              {TIME_SLOTS.map(slot => {
                const isSel = slot === value
                return (
                  <button key={slot} type="button"
                    ref={isSel ? selectedRef : undefined}
                    onClick={() => { onChange(slot); setOpen(false) }}
                    className={cn(
                      "flex w-full items-center rounded-md px-2 py-1.5 text-sm tabular-nums transition-colors",
                      isSel ? "bg-primary font-semibold text-primary-foreground" : "hover:bg-accent hover:text-accent-foreground",
                    )}>
                    {slot}
                  </button>
                )
              })}
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}
