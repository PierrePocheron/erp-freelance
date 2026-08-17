"use client"

import { useState, useRef, useEffect, useCallback, useId, useMemo } from "react"
import { createPortal } from "react-dom"
import { Check, Plus, ChevronDown } from "lucide-react"
import { ALL_INVESTMENT_TYPES, INVESTMENT_TYPE_META, metaForType } from "@/lib/investments"

type Option = { value: string; label: string; icon: string }

/**
 * Sélecteur du type d'investissement — presets connus + création à la volée.
 * Le type est une CHAÎNE libre : sélectionner un preset stocke son code (CROWDLENDING…),
 * taper un nouveau nom stocke ce nom tel quel (type personnalisé). Même pattern (portail +
 * positionnement fixe + « Créer '…' ») que les autres comboboxes du projet.
 */
export function InvestmentTypeCombobox({
  value, onChange, suggestions = [], id,
}: {
  value: string
  onChange: (v: string) => void
  suggestions?: string[]
  id?: string
}) {
  const generatedId = useId()
  const inputId = id ?? generatedId
  const listboxId = `${inputId}-listbox`
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({})
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Presets + types personnalisés déjà utilisés + valeur courante (toujours présente).
  const options = useMemo<Option[]>(() => {
    const presetCodes = new Set<string>(ALL_INVESTMENT_TYPES)
    const opts: Option[] = ALL_INVESTMENT_TYPES.map((t) => ({ value: t, label: INVESTMENT_TYPE_META[t].label, icon: INVESTMENT_TYPE_META[t].icon }))
    const extras = [...suggestions, value]
      .filter((s) => s && s.trim() && !presetCodes.has(s))
    const seen = new Set<string>()
    for (const s of extras) {
      const key = s.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      opts.push({ value: s, label: metaForType(s).label, icon: metaForType(s).icon })
    }
    return opts
  }, [suggestions, value])

  const selectedLabel = value ? metaForType(value).label : ""

  const q = query.trim().toLowerCase()
  const filtered = q ? options.filter((o) => o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q)) : options
  const exactMatch = options.some((o) => o.label.toLowerCase() === q || o.value.toLowerCase() === q)
  const showCreate = query.trim().length > 0 && !exactMatch

  const updatePosition = useCallback(() => {
    if (!inputRef.current) return
    const rect = inputRef.current.getBoundingClientRect()
    setDropdownStyle({ position: "fixed", top: rect.bottom + 4, left: rect.left, width: rect.width, zIndex: 9999 })
  }, [])

  function handleOpen() { updatePosition(); setOpen(true) }

  useEffect(() => {
    if (!open) return
    window.addEventListener("scroll", updatePosition, true)
    window.addEventListener("resize", updatePosition)
    return () => {
      window.removeEventListener("scroll", updatePosition, true)
      window.removeEventListener("resize", updatePosition)
    }
  }, [open, updatePosition])

  useEffect(() => {
    if (!open) return
    function handlePointerDown(e: PointerEvent) {
      if (
        containerRef.current?.contains(e.target as Node) ||
        (e.target as HTMLElement)?.closest?.("[data-combobox-dropdown]")
      ) return
      setOpen(false); setQuery("")
    }
    document.addEventListener("pointerdown", handlePointerDown)
    return () => document.removeEventListener("pointerdown", handlePointerDown)
  }, [open])

  function select(v: string) { onChange(v); setOpen(false); setQuery("") }

  return (
    <div ref={containerRef}>
      <div className="relative">
        <input
          ref={inputRef}
          id={inputId}
          role="combobox"
          aria-expanded={open}
          aria-controls={open ? listboxId : undefined}
          aria-autocomplete="list"
          aria-haspopup="listbox"
          value={open ? query : selectedLabel}
          onChange={(e) => { setQuery(e.target.value); if (!open) handleOpen() }}
          onFocus={handleOpen}
          onKeyDown={(e) => {
            if (e.key === "Enter" && showCreate) { e.preventDefault(); select(query.trim()) }
          }}
          placeholder="Crowdlending, SCPI, Crypto…"
          className="flex h-9 w-full rounded-md border border-input bg-transparent pl-3 pr-8 py-1 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <ChevronDown className="absolute right-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
      </div>

      {open && typeof document !== "undefined" && createPortal(
        <div data-combobox-dropdown="" style={dropdownStyle} className="rounded-md border border-border bg-popover shadow-lg overflow-hidden">
          <div id={listboxId} role="listbox" className="max-h-60 overflow-y-auto">
            {filtered.length === 0 && !showCreate && (
              <p className="px-3 py-2.5 text-sm text-muted-foreground">Aucun type</p>
            )}
            {filtered.map((o) => (
              <button
                key={o.value}
                type="button"
                role="option"
                aria-selected={o.value === value}
                onPointerDown={(e) => { e.preventDefault(); select(o.value) }}
                className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-left hover:bg-muted/60 transition-colors"
              >
                <Check className={`h-3.5 w-3.5 shrink-0 transition-opacity ${o.value === value ? "text-primary opacity-100" : "opacity-0"}`} />
                <span aria-hidden>{o.icon}</span>
                <span className={`flex-1 truncate ${o.value === value ? "font-medium" : ""}`}>{o.label}</span>
              </button>
            ))}
            {showCreate && (
              <>
                {filtered.length > 0 && <div className="border-t border-border/50" />}
                <button
                  type="button"
                  onPointerDown={(e) => { e.preventDefault(); select(query.trim()) }}
                  className="flex items-center gap-2 w-full px-3 py-2.5 text-sm text-primary font-medium hover:bg-primary/8 transition-colors"
                >
                  <Plus className="h-3.5 w-3.5 shrink-0" />
                  Créer «&nbsp;{query.trim()}&nbsp;»
                </button>
              </>
            )}
          </div>
        </div>,
        document.body,
      )}
    </div>
  )
}
