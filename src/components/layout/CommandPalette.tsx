"use client"

import { useEffect, useState, useRef, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Search, Loader2 } from "lucide-react"
import { searchGlobal, type SearchResult } from "@/actions/search"
import { cn } from "@/lib/utils"

type NavItem = {
  label: string
  href: string
  icon: string
  keywords: string[]
}

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard",              href: "/",                          icon: "⚡", keywords: ["accueil", "home", "tableau de bord", "dashboard"] },
  { label: "Projets",                href: "/projets",                   icon: "💻", keywords: ["projet", "tache", "task", "milestone", "livrable"] },
  { label: "CRM — Clients",          href: "/client",                    icon: "👥", keywords: ["client", "crm", "contact", "prospect", "lead"] },
  { label: "Facturation",            href: "/facturation",               icon: "💳", keywords: ["facturation", "finance", "paiement", "argent"] },
  { label: "Devis",                  href: "/facturation/devis",         icon: "📄", keywords: ["devis", "quote", "estimation", "offre"] },
  { label: "Factures",               href: "/facturation/factures",      icon: "💰", keywords: ["facture", "invoice", "paiement", "reglement"] },
  { label: "Produits & Catalogue",   href: "/facturation/produits",      icon: "📦", keywords: ["produit", "product", "catalogue", "tarif", "prix", "service"] },
  { label: "Calendrier",             href: "/calendrier",                icon: "📅", keywords: ["calendrier", "agenda", "evenement", "rdv", "rendez-vous", "planning"] },
  { label: "Paramètres",             href: "/settings",                  icon: "⚙️", keywords: ["parametres", "settings", "profil", "profil", "logo", "couleur", "iban", "siret", "entreprise", "conditions", "cgv"] },
]

const TYPE_ICON: Record<string, string> = {
  client:  "👥",
  project: "💻",
  quote:   "📄",
  invoice: "💰",
}

const TYPE_LABEL: Record<string, string> = {
  client:  "Client",
  project: "Projet",
  quote:   "Devis",
  invoice: "Facture",
}

function normalize(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
}

function matchNavItem(item: NavItem, query: string): boolean {
  const q = normalize(query)
  return normalize(item.label).includes(q) || item.keywords.some((k) => k.includes(q))
}

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<SearchResult[]>([])
  const [selected, setSelected] = useState(0)
  const [searching, setSearching] = useState(false)
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
      setSearching(false)
      setTimeout(() => inputRef.current?.focus(), 30)
    }
  }, [open])

  useEffect(() => {
    if (query.length < 2) { setResults([]); setSelected(0); setSearching(false); return }
    setSearching(true)
    const t = setTimeout(() => {
      startTransition(async () => {
        const r = await searchGlobal(query)
        setResults(r)
        setSelected(0)
        setSearching(false)
      })
    }, 200)
    return () => clearTimeout(t)
  }, [query])

  // Nav items filteredinstantly (client-side)
  const navMatches = query.length >= 2 ? NAV_ITEMS.filter((item) => matchNavItem(item, query)) : []

  // Flat list for keyboard navigation
  const listItems: Array<{ href: string }> =
    query.length < 2
      ? NAV_ITEMS
      : [...navMatches, ...results]

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
          {(searching || isPending) && (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground shrink-0" />
          )}
          <kbd className="text-xs text-muted-foreground bg-muted border border-border px-1.5 py-0.5 rounded font-mono shrink-0">esc</kbd>
        </div>

        {/* Results */}
        <div className="max-h-96 overflow-y-auto p-1">

          {/* Mode navigation (query vide) */}
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

          {/* Mode recherche */}
          {query.length >= 2 && (
            <>
              {/* Pages correspondantes — affichage immédiat */}
              {navMatches.length > 0 && (
                <>
                  <p className="px-3 pt-2 pb-1 text-xs text-muted-foreground font-medium tracking-wide">Pages</p>
                  {navMatches.map((item, i) => (
                    <button
                      key={item.href}
                      onClick={() => navigate(item.href)}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-left transition-colors",
                        i === selected ? "bg-accent text-accent-foreground" : "hover:bg-accent/50"
                      )}
                    >
                      <span className="text-base leading-none w-5 text-center shrink-0">{item.icon}</span>
                      <span className="flex-1 truncate">{item.label}</span>
                    </button>
                  ))}
                </>
              )}

              {/* Résultats DB */}
              {(searching || isPending) && (
                <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Recherche en cours…</span>
                </div>
              )}

              {!searching && !isPending && results.length > 0 && (
                <>
                  <p className="px-3 pt-2 pb-1 text-xs text-muted-foreground font-medium tracking-wide">Résultats</p>
                  {results.map((r, i) => (
                    <button
                      key={r.id}
                      onClick={() => navigate(r.href)}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-left transition-colors",
                        navMatches.length + i === selected ? "bg-accent text-accent-foreground" : "hover:bg-accent/50"
                      )}
                    >
                      <span className="text-base leading-none w-5 text-center shrink-0">
                        {TYPE_ICON[r.type]}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{r.label}</p>
                        {r.sublabel && <p className="text-xs text-muted-foreground truncate">{r.sublabel}</p>}
                      </div>
                      <span className="text-[10px] text-muted-foreground bg-muted border border-border px-1.5 py-0.5 rounded font-mono shrink-0">
                        {TYPE_LABEL[r.type]}
                      </span>
                    </button>
                  ))}
                </>
              )}

              {!searching && !isPending && navMatches.length === 0 && results.length === 0 && (
                <p className="px-3 py-8 text-center text-sm text-muted-foreground">
                  Aucun résultat pour &ldquo;{query}&rdquo;
                </p>
              )}
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
