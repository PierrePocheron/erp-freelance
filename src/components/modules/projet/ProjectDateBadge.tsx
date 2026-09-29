"use client"

import { zonedDateKey } from "@/lib/dates"
import { useState, useTransition, useRef } from "react"
import { Calendar, Pencil, Check, X } from "lucide-react"
import { updateProjectDates } from "@/actions/projet"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

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
    ? new Date(value).toLocaleDateString("fr-FR", { timeZone: "Europe/Paris", day: "numeric", month: "short", year: "numeric" })
    : null

  const toInputValue = (d: Date | null) =>
    d ? zonedDateKey(new Date(d)) : ""

  function handleSave() {
    const val = inputRef.current?.value
    // Rien de changé (ou champ vidé : l'effacement n'est pas géré côté serveur) → simple fermeture
    if (!val || val === toInputValue(value)) { setEditing(false); return }
    startTransition(async () => {
      try {
        await updateProjectDates(projectId, { [field]: val })
        setEditing(false)
      } catch {
        toast.error("Échec de l'enregistrement de la date")
      }
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
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); handleSave() }
            if (e.key === "Escape") setEditing(false)
          }}
          className="h-6 rounded border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <button onMouseDown={(e) => e.preventDefault()} onClick={handleSave} disabled={isPending} aria-label="Enregistrer la date" className="text-emerald-500 hover:text-emerald-600">
          <Check className="h-3.5 w-3.5" />
        </button>
        {/* onMouseDown preventDefault : le champ garde le focus, donc son onBlur n'enregistre pas avant l'annulation */}
        <button onMouseDown={(e) => e.preventDefault()} onClick={() => setEditing(false)} aria-label="Annuler" className="text-muted-foreground hover:text-foreground">
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
      <Pencil className="h-2.5 w-2.5 pointer-fine:opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity" />
    </button>
  )
}
