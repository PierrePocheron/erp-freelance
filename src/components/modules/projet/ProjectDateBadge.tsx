"use client"

import { useState, useTransition, useRef } from "react"
import { Calendar, Pencil, Check, X } from "lucide-react"
import { updateProjectDates } from "@/actions/projet"
import { cn } from "@/lib/utils"

type Props = {
  projectId: string
  field: "startDate" | "endDate"
  value: Date | null
  label: string
}

export function ProjectDateBadge({ projectId, field, value, label }: Props) {
  const [editing, setEditing] = useState(false)
  const [isPending, startTransition] = useTransition()
  const inputRef = useRef<HTMLInputElement>(null)

  const formatted = value
    ? new Date(value).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })
    : null

  const toInputValue = (d: Date | null) =>
    d ? new Date(d).toISOString().split("T")[0] : ""

  function handleSave() {
    const val = inputRef.current?.value
    startTransition(async () => {
      await updateProjectDates(projectId, { [field]: val || undefined })
      setEditing(false)
    })
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-muted-foreground">{label} :</span>
        <input
          ref={inputRef}
          type="date"
          defaultValue={toInputValue(value)}
          autoFocus
          onBlur={handleSave}
          className="h-6 rounded border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <button onClick={handleSave} disabled={isPending} className="text-emerald-500 hover:text-emerald-600">
          <Check className="h-3.5 w-3.5" />
        </button>
        <button onClick={() => setEditing(false)} className="text-muted-foreground hover:text-foreground">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className={cn(
        "group inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs transition-colors hover:border-primary/50 hover:bg-primary/5",
        value ? "border-border bg-muted/50 text-foreground" : "border-dashed border-border text-muted-foreground"
      )}
    >
      <Calendar className="h-3 w-3 shrink-0" />
      {formatted ?? label}
      <Pencil className="h-2.5 w-2.5 md:opacity-0 md:group-hover:opacity-100 focus:opacity-100 transition-opacity" />
    </button>
  )
}
