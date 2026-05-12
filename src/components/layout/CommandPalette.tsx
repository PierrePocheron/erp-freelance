"use client"

import { useEffect, useState, useRef, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Search, Loader2 } from "lucide-react"
import { searchGlobal, type SearchResult } from "@/actions/search"
import { cn } from "@/lib/utils"

const NAV_ITEMS = [
  { label: "Dashboard",       href: "/",                        icon: "⚡" },
  { label: "Projets",         href: "/projets",                 icon: "💻" },
  { label: "CRM — Clients",   href: "/crm",                     icon: "👥" },
  { label: "Devis",           href: "/facturation/devis",       icon: "📄" },
  { label: "Factures",        href: "/facturation/factures",    icon: "💰" },
  { label: "Produits",        href: "/facturation/produits",    icon: "📦" },
  { label: "Calendrier",      href: "/calendrier",              icon: "📅" },
  { label: "Paramètres",      href: "/settings",                icon: "⚙️" },
]

const TYPE_LABEL: Record<string, string> = {
  client: "Client",
  project: "Projet",
  quote: "Devis",
  invoice: "Facture",
}

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<SearchResult[]>([])
  const [selected, setSelected] = useState(0)
  const [isPending, startTransition] = useTransition()
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        setOpen((v) => !v)
      }
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [])

  useEffect(() => {
    if (open) {
      setQuery("")
      setResults([])
      setSelected(0)
      setTimeout(() => inputRef.current?.focus(), 30)
    }
  }, [open])

  useEffect(() => {
    if (query.length < 2) { setResults([]); setSelected(0); return }
    const t = setTimeout(() => {
      startTransition(async () => {
        const r = await searchGlobal(query)
        setResults(r)
        setSelected(0)
      })
    }, 200)
    return () => clearTimeout(t)
  }, [query])

  const listItems: Array<{ label: string; sublabel?: string; href: string; badge?: string; icon?: string }> =
    query.length < 2
      ? NAV_ITEMS.map((n) => ({ ...n }))
      : results.map((r) => ({ label: r.label, sublabel: r.sublabel, href: r.href, badge: TYPE_LABEL[r.type] }))

  const total = listItems.length

  function navigate(href: string) {
    router.push(href)
    setOpen(false)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") { setOpen(false); return }
    if (e.key === "ArrowDown") { e.preventDefault(); setSelected((s) => (s + 1) % Math.max(total, 1)) }
    if (e.key === "ArrowUp") { e.preventDefault(); setSelected((s) => (s - 1 + Math.max(total, 1)) % Math.max(total, 1)) }
    if (e.key === "Enter" && listItems[selected]) { navigate(listItems[selected].href) }
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[18vh]"
      onClick={() => setOpen(false)}
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-md mx-4 rounded-xl border border-border bg-card shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Rechercher ou naviguer..."
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground shrink-0" />}
          <kbd className="text-xs text-muted-foreground bg-muted border border-border px-1.5 py-0.5 rounded font-mono shrink-0">esc</kbd>
        </div>

        {/* Results */}
        <div className="max-h-80 overflow-y-auto p-1">
          {query.length < 2 && (
            <>
              <p className="px-3 pt-2 pb-1 text-xs text-muted-foreground font-medium tracking-wide">Navigation</p>
              {NAV_ITEMS.map((item, i) => (
                <button
                  key={item.href}
                  onClick={() => navigate(item.href)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-left transition-colors",
                    i === selected ? "bg-accent text-accent-foreground" : "hover:bg-accent/50"
                  )}
                >
                  <span className="text-base leading-none w-5 text-center shrink-0">{item.icon}</span>
                  <span>{item.label}</span>
                </button>
              ))}
            </>
          )}

          {query.length >= 2 && !isPending && results.length === 0 && (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">
              Aucun résultat pour &ldquo;{query}&rdquo;
            </p>
          )}

          {query.length >= 2 && results.length > 0 && (
            <>
              <p className="px-3 pt-2 pb-1 text-xs text-muted-foreground font-medium tracking-wide">Résultats</p>
              {results.map((r, i) => (
                <button
                  key={r.id}
                  onClick={() => navigate(r.href)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-left transition-colors",
                    i === selected ? "bg-accent text-accent-foreground" : "hover:bg-accent/50"
                  )}
                >
                  <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded font-mono w-16 text-center shrink-0">
                    {TYPE_LABEL[r.type]}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{r.label}</p>
                    {r.sublabel && <p className="text-xs text-muted-foreground truncate">{r.sublabel}</p>}
                  </div>
                </button>
              ))}
            </>
          )}
        </div>

        {/* Footer hint */}
        <div className="flex items-center gap-3 px-4 py-2 border-t border-border text-xs text-muted-foreground">
          <span><kbd className="bg-muted border border-border px-1 py-0.5 rounded font-mono">↑↓</kbd> naviguer</span>
          <span><kbd className="bg-muted border border-border px-1 py-0.5 rounded font-mono">↵</kbd> ouvrir</span>
          <span className="ml-auto"><kbd className="bg-muted border border-border px-1 py-0.5 rounded font-mono">⌘K</kbd> fermer</span>
        </div>
      </div>
    </div>
  )
}
