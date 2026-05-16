"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { createPortal } from "react-dom"
import { Check, Plus, ChevronDown, Loader2, X } from "lucide-react"
import { createQuickClient } from "@/actions/crm"

type Client = { id: string; name: string; company: string | null; type: string }

type Props = {
  userId: string
  clients: Client[]
  value: string
  onChange: (id: string) => void
}

function clientLabel(c: Client) {
  if (c.type === "SELF") return "Perso"
  return c.company ? `${c.name} — ${c.company}` : c.name
}

export function ClientCombobox({ userId, clients, value, onChange }: Props) {
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [allClients, setAllClients] = useState<Client[]>(clients)
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({})
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const selected = allClients.find((c) => c.id === value)

  const filtered = query.trim()
    ? allClients.filter((c) => {
        const q = query.toLowerCase()
        return c.name.toLowerCase().includes(q) || (c.company ?? "").toLowerCase().includes(q)
      })
    : allClients

  const exactMatch = allClients.some(
    (c) => c.name.toLowerCase() === query.trim().toLowerCase()
  )
  const showCreate = query.trim().length > 0 && !exactMatch

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
    setOpen(true)
  }

  // Reposition on scroll / resize while open
  useEffect(() => {
    if (!open) return
    window.addEventListener("scroll", updatePosition, true)
    window.addEventListener("resize", updatePosition)
    return () => {
      window.removeEventListener("scroll", updatePosition, true)
      window.removeEventListener("resize", updatePosition)
    }
  }, [open, updatePosition])

  // Close on outside click
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

  function handleSelect(clientId: string) {
    onChange(clientId)
    setOpen(false)
    setQuery("")
  }

  function handleClear() {
    onChange("")
    setQuery("")
    handleOpen()
    inputRef.current?.focus()
  }

  async function handleCreate() {
    const name = query.trim()
    if (!name || creating) return
    setCreating(true)
    try {
      const client = await createQuickClient(userId, { name })
      const newClient: Client = {
        id: client.id,
        name: client.name,
        company: client.company,
        type: client.type,
      }
      setAllClients((prev) => [...prev, newClient])
      onChange(client.id)
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
          value={open ? query : (selected ? clientLabel(selected) : query)}
          onChange={(e) => {
            setQuery(e.target.value)
            if (!open) handleOpen()
            if (selected && e.target.value !== clientLabel(selected)) onChange("")
          }}
          onFocus={handleOpen}
          placeholder="Rechercher ou créer un client..."
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring pr-8"
        />
        {selected && !open ? (
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

      {selected && !open && (
        <p className="text-xs text-emerald-600 flex items-center gap-1 mt-1">
          <Check className="h-3 w-3" />
          {clientLabel(selected)}
        </p>
      )}

      {open && typeof document !== "undefined" && createPortal(
        <div
          data-combobox-dropdown=""
          style={dropdownStyle}
          className="rounded-md border border-border bg-popover shadow-lg overflow-hidden"
        >
          <div className="max-h-52 overflow-y-auto">
            {filtered.length === 0 && !showCreate && (
              <p className="px-3 py-2.5 text-sm text-muted-foreground">Aucun client trouvé</p>
            )}

            {filtered.map((c) => (
              <button
                key={c.id}
                type="button"
                onPointerDown={(e) => { e.preventDefault(); handleSelect(c.id) }}
                className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-left hover:bg-muted/60 transition-colors"
              >
                <Check
                  className={`h-3.5 w-3.5 shrink-0 transition-opacity ${
                    c.id === value ? "text-primary opacity-100" : "opacity-0"
                  }`}
                />
                <span className="flex-1 truncate">
                  <span className={c.id === value ? "font-medium" : ""}>{c.name}</span>
                  {c.company && (
                    <span className="text-muted-foreground ml-1.5">— {c.company}</span>
                  )}
                </span>
                <span className="text-xs text-muted-foreground capitalize shrink-0">
                  {c.type === "PROSPECT" ? "Prospect" : c.type === "CLIENT" ? "Client" : c.type === "INACTIVE" ? "Inactif" : ""}
                </span>
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
                  {creating ? (
                    <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
                  ) : (
                    <Plus className="h-3.5 w-3.5 shrink-0" />
                  )}
                  {creating ? "Création en cours..." : `Créer "${query.trim()}"`}
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
