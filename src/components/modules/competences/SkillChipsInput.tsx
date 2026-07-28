"use client"

import { useState } from "react"
import { X } from "lucide-react"

/** Champ à puces pour saisir des compétences par nom (avec autocomplétion datalist). */
export function SkillChipsInput({
  value, onChange, suggestions, placeholder, id,
}: {
  value: string[]
  onChange: (v: string[]) => void
  suggestions: string[]
  placeholder?: string
  id?: string
}) {
  const [draft, setDraft] = useState("")
  const dlId = `${id ?? "chips"}-dl`

  const add = (name: string) => {
    const n = name.trim()
    if (n && !value.some((v) => v.toLowerCase() === n.toLowerCase())) onChange([...value, n])
    setDraft("")
  }
  const remove = (i: number) => onChange(value.filter((_, idx) => idx !== i))

  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-input bg-background px-2 py-1.5 focus-within:ring-1 focus-within:ring-ring">
      {value.map((v, i) => (
        <span key={v + i} className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/40 pl-2 pr-1 py-0.5 text-xs">
          {v}
          <button type="button" onClick={() => remove(i)} aria-label={`Retirer ${v}`} className="text-muted-foreground hover:text-destructive">
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      <input
        id={id}
        list={dlId}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(draft) }
          else if (e.key === "Backspace" && !draft && value.length) remove(value.length - 1)
        }}
        onBlur={() => { if (draft.trim()) add(draft) }}
        placeholder={value.length ? "" : placeholder}
        className="min-w-24 flex-1 bg-transparent py-0.5 text-sm outline-none"
      />
      <datalist id={dlId}>{suggestions.map((s) => <option key={s} value={s} />)}</datalist>
    </div>
  )
}
