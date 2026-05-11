"use client"

import { useState, useRef, useCallback } from "react"
import { Check, Plus, ChevronDown, Loader2 } from "lucide-react"
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
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [creating, setCreating] = useState(false)
  const [localClients, setLocalClients] = useState<Client[]>(clients)
  const inputRef = useRef<HTMLInputElement>(null)

  const selected = localClients.find((c) => c.id === value)

  const filtered = query.trim()
    ? localClients.filter((c) => {
        const q = query.toLowerCase()
        return c.name.toLowerCase().includes(q) || c.company?.toLowerCase().includes(q)
      })
    : localClients

  const showCreate =
    query.trim().length > 0 &&
    !localClients.some((c) => c.name.toLowerCase() === query.trim().toLowerCase())

  const handleOpen = useCallback(() => {
    setOpen(true)
    setQuery("")
  }, [])

  const handleClose = useCallback(() => {
    setTimeout(() => {
      setOpen(false)
      setQuery("")
    }, 150)
  }, [])

  function handleSelect(clientId: string) {
    onChange(clientId)
    setOpen(false)
    setQuery("")
  }

  async function handleCreate() {
    const name = query.trim()
    if (!name || creating) return
    setCreating(true)
    try {
      const client = await createQuickClient(userId, { name })
      setLocalClients((prev) => [...prev, { id: client.id, name: client.name, company: client.company, type: client.type }])
      onChange(client.id)
      setOpen(false)
      setQuery("")
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="relative">
      <div className="relative">
        <input
          ref={inputRef}
          value={open ? query : (selected ? clientLabel(selected) : "")}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={handleOpen}
          onBlur={handleClose}
          placeholder="Rechercher un client..."
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 pr-8 py-1 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <ChevronDown className="absolute right-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
      </div>

      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-md border border-border bg-popover shadow-lg overflow-hidden">
          <div className="max-h-52 overflow-y-auto py-1">
            {filtered.length === 0 && !showCreate && (
              <p className="px-3 py-2 text-sm text-muted-foreground">Aucun client trouvé</p>
            )}

            {filtered.map((c) => (
              <button
                key={c.id}
                type="button"
                onMouseDown={() => handleSelect(c.id)}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm text-left hover:bg-muted/50 transition-colors"
              >
                <Check className={`h-3.5 w-3.5 shrink-0 ${c.id === value ? "text-primary" : "opacity-0"}`} />
                <span className={c.id === value ? "font-medium" : ""}>{clientLabel(c)}</span>
              </button>
            ))}

            {showCreate && (
              <>
                {filtered.length > 0 && <div className="border-t border-border/50 my-1" />}
                <button
                  type="button"
                  onMouseDown={handleCreate}
                  disabled={creating}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm text-primary hover:bg-primary/10 transition-colors disabled:opacity-50"
                >
                  {creating ? (
                    <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
                  ) : (
                    <Plus className="h-3.5 w-3.5 shrink-0" />
                  )}
                  {creating ? "Création..." : `Créer "${query.trim()}"`}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
