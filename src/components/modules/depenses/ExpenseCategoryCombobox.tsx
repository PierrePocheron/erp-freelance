"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { createPortal } from "react-dom"
import { Check, Plus, ChevronDown, Loader2 } from "lucide-react"
import { createExpenseCategory } from "@/actions/expense"

export type ExpenseCategory = { id: string; name: string; color: string }

// Palette pour les catégories créées à la volée — mêmes teintes que celles
// proposées ailleurs dans l'app (tags projet, etc.). La couleur est dérivée
// du nom (hash simple) : déterministe (recréer "Essence" redonne la même
// teinte) et sans Math.random (signalé par l'analyse sécurité).
const CATEGORY_COLORS = [
  "#6366f1", "#8b5cf6", "#0ea5e9", "#10b981",
  "#f59e0b", "#ef4444", "#ec4899", "#64748b",
  "#14b8a6", "#f97316",
]

function colorForName(name: string): string {
  let hash = 0
  for (const ch of name.toLowerCase()) hash = (hash * 31 + ch.charCodeAt(0)) | 0
  return CATEGORY_COLORS[Math.abs(hash) % CATEGORY_COLORS.length]
}

export function ExpenseCategoryCombobox({
  categories,
  value,
  onChange,
}: {
  categories: ExpenseCategory[]
  value: string
  onChange: (id: string) => void
}) {
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [allCategories, setAllCategories] = useState<ExpenseCategory[]>(categories)
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({})
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const selected = allCategories.find((c) => c.id === value)

  const filtered = query.trim()
    ? allCategories.filter((c) => c.name.toLowerCase().includes(query.trim().toLowerCase()))
    : allCategories

  const exactMatch = allCategories.some((c) => c.name.toLowerCase() === query.trim().toLowerCase())
  const showCreate = query.trim().length > 0 && !exactMatch

  const updatePosition = useCallback(() => {
    if (!inputRef.current) return
    const rect = inputRef.current.getBoundingClientRect()
    setDropdownStyle({ position: "fixed", top: rect.bottom + 4, left: rect.left, width: rect.width, zIndex: 9999 })
  }, [])

  function handleOpen() {
    updatePosition()
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
        (e.target as HTMLElement)?.closest?.("[data-combobox-dropdown]")
      ) return
      setOpen(false)
      setQuery("")
    }
    document.addEventListener("pointerdown", handlePointerDown)
    return () => document.removeEventListener("pointerdown", handlePointerDown)
  }, [open])

  function handleSelect(id: string) {
    onChange(id)
    setOpen(false)
    setQuery("")
  }

  async function handleCreate() {
    const name = query.trim()
    if (!name || creating) return
    setCreating(true)
    try {
      const category = await createExpenseCategory(name, colorForName(name))
      const newCategory: ExpenseCategory = { id: category.id, name: category.name, color: category.color }
      setAllCategories((prev) => [...prev, newCategory])
      onChange(category.id)
      setOpen(false)
      setQuery("")
    } finally {
      setCreating(false)
    }
  }

  return (
    <div ref={containerRef}>
      <div className="relative">
        <input
          ref={inputRef}
          value={open ? query : (selected ? selected.name : "")}
          onChange={(e) => {
            setQuery(e.target.value)
            if (!open) handleOpen()
            if (selected && e.target.value !== selected.name) onChange("")
          }}
          onFocus={handleOpen}
          placeholder="Sans catégorie"
          className="flex h-9 w-full rounded-md border border-input bg-transparent pl-3 pr-8 py-1 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <ChevronDown className="absolute right-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
      </div>

      {open && typeof document !== "undefined" && createPortal(
        <div
          data-combobox-dropdown=""
          style={dropdownStyle}
          className="rounded-md border border-border bg-popover shadow-lg overflow-hidden"
        >
          <div className="max-h-52 overflow-y-auto">
            <button
              type="button"
              onPointerDown={(e) => { e.preventDefault(); handleSelect("") }}
              className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-left hover:bg-muted/60 transition-colors text-muted-foreground"
            >
              <Check className={`h-3.5 w-3.5 shrink-0 transition-opacity ${!value ? "text-primary opacity-100" : "opacity-0"}`} />
              Sans catégorie
            </button>

            {filtered.length === 0 && !showCreate && (
              <p className="px-3 py-2.5 text-sm text-muted-foreground">Aucune catégorie</p>
            )}

            {filtered.map((c) => (
              <button
                key={c.id}
                type="button"
                onPointerDown={(e) => { e.preventDefault(); handleSelect(c.id) }}
                className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-left hover:bg-muted/60 transition-colors"
              >
                <Check className={`h-3.5 w-3.5 shrink-0 transition-opacity ${c.id === value ? "text-primary opacity-100" : "opacity-0"}`} />
                <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
                <span className={`flex-1 truncate ${c.id === value ? "font-medium" : ""}`}>{c.name}</span>
              </button>
            ))}

            {showCreate && (
              <>
                {filtered.length > 0 && <div className="border-t border-border/50" />}
                <button
                  type="button"
                  onPointerDown={(e) => { e.preventDefault(); handleCreate() }}
                  disabled={creating}
                  className="flex items-center gap-2 w-full px-3 py-2.5 text-sm text-primary font-medium hover:bg-primary/8 transition-colors disabled:opacity-50"
                >
                  {creating ? <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" /> : <Plus className="h-3.5 w-3.5 shrink-0" />}
                  {creating ? "Création en cours…" : `Créer "${query.trim()}"`}
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
