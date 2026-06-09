"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { createPortal } from "react-dom"
import { Check, Building2, ChevronDown, Plus, X } from "lucide-react"
import { searchCompanies } from "@/actions/crm"

type CompanyOption = { id: string; name: string; city: string | null }

type Props = {
  /** Valeur courante : id si société existante sélectionnée, sinon name (texte libre = création à la soumission). */
  value: { id: string | null; name: string }
  onChange: (v: { id: string | null; name: string }) => void
  placeholder?: string
}

export function CompanyCombobox({ value, onChange, placeholder }: Props) {
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)
  const [results, setResults] = useState<CompanyOption[]>([])
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({})
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Recherche serveur débauncée tant que le dropdown est ouvert.
  useEffect(() => {
    if (!open) return
    const handle = setTimeout(async () => {
      try {
        const r = await searchCompanies(query)
        setResults(r)
      } catch {
        setResults([])
      }
    }, 180)
    return () => clearTimeout(handle)
  }, [query, open])

  const trimmed = query.trim()
  const exactMatch = results.some((c) => c.name.toLowerCase() === trimmed.toLowerCase())
  const showCreate = trimmed.length > 0 && !exactMatch

  const updatePosition = useCallback(() => {
    if (!inputRef.current) return
    const rect = inputRef.current.getBoundingClientRect()
    setDropdownStyle({
      position: "fixed",
      top: rect.bottom + 4,
      left: rect.left,
      width: rect.width,
      zIndex: 9999,
    })
  }, [])

  function handleOpen() {
    updatePosition()
    setQuery(value.name)
    setOpen(true)
  }

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
        (e.target as HTMLElement)?.closest?.("[data-company-dropdown]")
      ) return
      setOpen(false)
    }
    document.addEventListener("pointerdown", handlePointerDown)
    return () => document.removeEventListener("pointerdown", handlePointerDown)
  }, [open])

  function handleSelect(c: CompanyOption) {
    onChange({ id: c.id, name: c.name })
    setOpen(false)
  }

  function handleCreate() {
    onChange({ id: null, name: trimmed })
    setOpen(false)
  }

  function handleClear() {
    onChange({ id: null, name: "" })
    setQuery("")
    inputRef.current?.focus()
    handleOpen()
  }

  return (
    <div ref={containerRef}>
      <div className="relative">
        <input
          ref={inputRef}
          value={open ? query : value.name}
          onChange={(e) => {
            const v = e.target.value
            setQuery(v)
            // Texte libre → société à créer (id null) ; effacé si vide.
            onChange({ id: null, name: v })
            if (!open) handleOpen()
          }}
          onFocus={handleOpen}
          placeholder={placeholder ?? "Rechercher ou créer une société..."}
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring pr-8"
        />
        {value.name && !open ? (
          <button
            type="button"
            tabIndex={-1}
            onClick={handleClear}
            className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        ) : (
          <ChevronDown className="absolute right-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
        )}
      </div>

      {open && typeof document !== "undefined" && createPortal(
        <div
          data-company-dropdown=""
          style={dropdownStyle}
          className="rounded-md border border-border bg-popover shadow-lg overflow-hidden"
        >
          <div className="max-h-52 overflow-y-auto">
            {results.length === 0 && !showCreate && (
              <p className="px-3 py-2.5 text-sm text-muted-foreground">Aucune société</p>
            )}

            {results.map((c) => (
              <button
                key={c.id}
                type="button"
                onPointerDown={(e) => { e.preventDefault(); handleSelect(c) }}
                className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-left hover:bg-muted/60 transition-colors"
              >
                <Building2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="flex-1 truncate">
                  <span className={c.id === value.id ? "font-medium" : ""}>{c.name}</span>
                  {c.city && <span className="text-muted-foreground ml-1.5">— {c.city}</span>}
                </span>
                {c.id === value.id && <Check className="h-3.5 w-3.5 shrink-0 text-primary" />}
              </button>
            ))}

            {showCreate && (
              <>
                {results.length > 0 && <div className="border-t border-border/50" />}
                <button
                  type="button"
                  onPointerDown={(e) => { e.preventDefault(); handleCreate() }}
                  className="flex items-center gap-2 w-full px-3 py-2.5 text-sm text-primary font-medium hover:bg-primary/8 transition-colors"
                >
                  <Plus className="h-3.5 w-3.5 shrink-0" />
                  Créer «&nbsp;{trimmed}&nbsp;»
                </button>
              </>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
