"use client"

import { useState, useMemo, useCallback, useRef, useEffect, useTransition } from "react"
import dynamic from "next/dynamic"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { X, Maximize2, ExternalLink, Search, CheckCircle2, Clock, AlertCircle } from "lucide-react"
import type { RawNode, RawLink, NodeType } from "./graph-types"
import { NODE_TYPE_LABELS, NODE_BASE_COLORS, nodeColor } from "./graph-types"

// ── Labels français des statuts ───────────────────────────────────────────────
const STATUS_FR: Record<string, string> = {
  // Factures / Devis
  PAID: "Payée", SENT: "Envoyée", ISSUED: "Émise", LATE: "En retard",
  DRAFT: "Brouillon", CANCELLED: "Annulée", EXPIRED: "Expiré",
  // Revenus / Remboursements
  PENDING: "En attente", RECEIVED: "Reçu",
  // Projets
  ACTIVE: "En cours", COMPLETED: "Terminé", PAUSED: "En pause",
  // Candidatures
  WISHLIST: "Repéré", APPLIED: "Candidaté", SCREENING: "Pré-qualif",
  INTERVIEW: "Entretien", TECHNICAL: "Test technique", FINAL: "Entretien final",
  OFFER: "Offre reçue", WITHDRAWN: "Désisté", GHOSTED: "Sans réponse",
}
import type { GraphMethods } from "./ForceGraphCanvas"
import { updateInvoiceStatus } from "@/actions/facturation"
import { markRevenueReceived, updateRevenue } from "@/actions/revenue"
import { updateCompany, updateClientAll } from "@/actions/crm"

// ── Dynamic import — jamais rendu côté serveur ──────────────────────────────
const ForceGraphCanvas = dynamic(
  () => import("./ForceGraphCanvas").then(m => m.ForceGraphCanvas),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
        Chargement du graphe…
      </div>
    ),
  }
)

// ── Collapse helpers ──────────────────────────────────────────────────────────

function isNodeVisible(id: string, nodeMap: Map<string, RawNode>, collapsed: Set<string>): boolean {
  const node = nodeMap.get(id)
  if (!node) return false
  if (!node.parentId) return true
  if (collapsed.has(node.parentId)) return false
  return isNodeVisible(node.parentId, nodeMap, collapsed)
}

// Remonte tous les ancêtres d'un nœud jusqu'à la racine
function getAncestors(nodeId: string, nodeMap: Map<string, RawNode>): Set<string> {
  const result  = new Set<string>()
  let   current = nodeMap.get(nodeId)
  while (current?.parentId) {
    result.add(current.parentId)
    current = nodeMap.get(current.parentId)
  }
  return result
}

// Descend récursivement tous les enfants (BFS)
function getDescendants(nodeId: string, allNodes: RawNode[]): Set<string> {
  const result = new Set<string>()
  const queue  = [nodeId]
  while (queue.length > 0) {
    const cur = queue.shift()!
    for (const n of allNodes) {
      if (n.parentId === cur) {
        result.add(n.id)
        queue.push(n.id)
      }
    }
  }
  return result
}

// ── Type filter toggles ───────────────────────────────────────────────────────

const ALL_TYPES: NodeType[] = ["SOURCE", "COMPANY", "CLIENT", "PROSPECT", "PERSONAL", "PROJECT", "INVOICE", "QUOTE", "REVENUE", "RESALE", "APPLICATION"]

const TYPE_DOT: Record<NodeType, string> = {
  SOURCE:      NODE_BASE_COLORS.SOURCE,
  COMPANY:     NODE_BASE_COLORS.COMPANY,
  CLIENT:      NODE_BASE_COLORS.CLIENT,
  PROSPECT:    NODE_BASE_COLORS.PROSPECT,
  PERSONAL:    NODE_BASE_COLORS.PERSONAL,
  PROJECT:     NODE_BASE_COLORS.PROJECT,
  INVOICE:     NODE_BASE_COLORS.INVOICE,
  QUOTE:       NODE_BASE_COLORS.QUOTE,
  REVENUE:     NODE_BASE_COLORS.REVENUE,
  RESALE:      NODE_BASE_COLORS.RESALE,
  APPLICATION: NODE_BASE_COLORS.APPLICATION,
}

function getDisplayColor(node: RawNode): string {
  if (node.meta.color) return node.meta.color
  return nodeColor(node)
}

// ── Main component ────────────────────────────────────────────────────────────

export function GraphView({ rawNodes, rawLinks }: { rawNodes: RawNode[]; rawLinks: RawLink[] }) {
  const containerRef  = useRef<HTMLDivElement>(null)
  const graphRef      = useRef<GraphMethods>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [size, setSize]             = useState({ w: 800, h: 600 })
  // Certains hubs volumineux (Prospection ≈ 230 enfants) démarrent repliés
  const [collapsedIds, setCollapsed] = useState<Set<string>>(
    () => new Set(rawNodes.filter(n => n.defaultCollapsed).map(n => n.id))
  )
  const [hiddenTypes, setHidden]    = useState<Set<NodeType>>(new Set())
  const [selected, setSelected]     = useState<RawNode | null>(null)
  const [activeFilter, setActiveFilter]       = useState<"pending" | "incomplete" | null>(null)
  // Valeur combinée "company:<id>" | "client:<id>" — un revenu personnel (remboursement
  // d'un proche) n'a souvent qu'un contact, pas de société.
  const [assignParent,   setAssignParent]     = useState("")
  const [quickWebsite,    setQuickWebsite]    = useState("")
  const [quickFirstName,  setQuickFirstName]  = useState("")
  const [quickLastName,   setQuickLastName]   = useState("")
  const [quickEmail,      setQuickEmail]      = useState("")
  const [quickPhone,      setQuickPhone]      = useState("")
  // Lecture immédiate depuis le DOM ; suppressHydrationWarning sur le div conteneur
  // évite l'erreur React de mismatch SSR/client tout en conservant la bonne couleur dès le 1er rendu
  const [isDark, setIsDark] = useState<boolean>(() =>
    typeof window !== "undefined"
      ? document.documentElement.classList.contains("dark")
      : true
  )

  // ── Recherche ────────────────────────────────────────────────────────────
  const [searchQuery,    setSearchQuery]    = useState("")
  const [focusedNodeId,  setFocusedNodeId]  = useState<string | null>(null)
  const [showSuggestions, setShowSuggestions] = useState(false)

  // Suit le thème en temps réel
  useEffect(() => {
    const html  = document.documentElement
    const check = () => setIsDark(html.classList.contains("dark"))
    check()
    const obs = new MutationObserver(check)
    obs.observe(html, { attributes: true, attributeFilter: ["class"] })
    return () => obs.disconnect()
  }, [])

  // Raccourci clavier : "/" pour focaliser la recherche du graph
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName
      const inInput = tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement).isContentEditable
      if (e.key === "/" && !inInput && !e.metaKey && !e.ctrlKey) {
        e.preventDefault()
        searchInputRef.current?.focus()
        searchInputRef.current?.select()
      }
      if (e.key === "Escape" && document.activeElement === searchInputRef.current) {
        clearSearch()
        searchInputRef.current?.blur()
      }
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [])

  // Resize observer
  useEffect(() => {
    if (!containerRef.current) return
    const ro = new ResizeObserver(entries => {
      const e = entries[0]
      setSize({ w: e.contentRect.width, h: e.contentRect.height })
    })
    ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [])

  // Node map for collapse + ancestor logic
  const nodeMap = useMemo(
    () => new Map(rawNodes.map(n => [n.id, n])),
    [rawNodes]
  )

  // ── Suggestions de recherche (max 10) ────────────────────────────────────
  const matchingNodes = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (q.length < 2) return []
    return rawNodes
      .filter(n =>
        n.label.toLowerCase().includes(q) ||
        (n.meta.subtitle ?? "").toLowerCase().includes(q)
      )
      .slice(0, 10)
  }, [rawNodes, searchQuery])

  const matchingIds = useMemo(() => new Set(matchingNodes.map(n => n.id)), [matchingNodes])

  // ── Mode focus : nœud sélectionné + toute la hiérarchie (ancêtres + descendants) ──
  const focusVisibleIds = useMemo(() => {
    if (!focusedNodeId) return null
    const ancestors   = getAncestors(focusedNodeId, nodeMap)
    const descendants = getDescendants(focusedNodeId, rawNodes)
    return new Set([focusedNodeId, ...ancestors, ...descendants])
  }, [focusedNodeId, nodeMap, rawNodes])

  // ── Quick filter : nœuds ciblés + tous leurs ancêtres ──────────────────
  const filterVisibleIds = useMemo(() => {
    if (!activeFilter) return null
    const seeds: string[] = []
    if (activeFilter === "pending") {
      rawNodes.forEach(n => {
        if (n.type === "INVOICE" && (n.status === "SENT" || n.status === "LATE")) seeds.push(n.id)
        if (n.type === "REVENUE" && n.status === "PENDING") seeds.push(n.id)
        if (n.type === "RESALE" && n.status === "PENDING") seeds.push(n.id)
      })
    } else {
      rawNodes.forEach(n => { if (n.incomplete) seeds.push(n.id) })
    }
    const result = new Set(seeds)
    seeds.forEach(id => getAncestors(id, nodeMap).forEach(a => result.add(a)))
    return result
  }, [activeFilter, rawNodes, nodeMap])

  // Zoom to fit dès qu'on entre en mode focus
  useEffect(() => {
    if (!focusedNodeId) return
    const t = setTimeout(() => graphRef.current?.zoomToFit(600), 150)
    return () => clearTimeout(t)
  }, [focusedNodeId])

  // ── Compute visible graph ─────────────────────────────────────────────────
  const { nodes, links } = useMemo(() => {
    const visNodes = rawNodes.filter(n => {
      if (hiddenTypes.has(n.type)) return false
      if (focusVisibleIds && !focusVisibleIds.has(n.id)) return false
      if (filterVisibleIds && !filterVisibleIds.has(n.id)) return false
      return isNodeVisible(n.id, nodeMap, collapsedIds)
    })
    const visIds = new Set(visNodes.map(n => n.id))
    const resolveId = (v: unknown): string =>
      typeof v === "object" && v !== null ? (v as { id: string }).id : v as string
    const visLinks = rawLinks.filter(l =>
      visIds.has(resolveId(l.source)) && visIds.has(resolveId(l.target))
    )
    return { nodes: visNodes, links: visLinks }
  }, [rawNodes, rawLinks, nodeMap, collapsedIds, hiddenTypes, focusVisibleIds])

  // ── IDs atténués et mis en valeur pour le canvas ─────────────────────────
  const dimmedIds = useMemo(() => {
    if (!searchQuery.trim() || searchQuery.trim().length < 2) return undefined
    if (focusedNodeId) return undefined
    if (matchingIds.size === 0) return undefined
    const dimmed = new Set<string>()
    nodes.forEach(n => { if (!matchingIds.has(n.id)) dimmed.add(n.id) })
    return dimmed
  }, [searchQuery, focusedNodeId, matchingIds, nodes])

  const highlightedIds = useMemo(() => {
    if (!searchQuery.trim() || searchQuery.trim().length < 2) return undefined
    if (focusedNodeId) return undefined
    return matchingIds.size > 0 ? matchingIds : undefined
  }, [searchQuery, focusedNodeId, matchingIds])

  // ── Couleurs réelles des sources fiscales pour le filtre ────────────────
  const sourceColors = useMemo(
    () => rawNodes
      .filter(n => n.type === "SOURCE")
      .map(n => n.meta.color ?? NODE_BASE_COLORS.SOURCE),
    [rawNodes]
  )

  // ── Toggle collapse (double-clic) ────────────────────────────────────────
  const handleDblClick = useCallback((node: RawNode) => {
    setCollapsed(prev => {
      const next = new Set(prev)
      if (next.has(node.id)) next.delete(node.id)
      else next.add(node.id)
      return next
    })
  }, [])

  // Reset des champs de saisie rapide au changement de nœud sélectionné
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    setAssignParent("")
    setQuickWebsite("")
    setQuickFirstName("")
    setQuickLastName("")
    setQuickEmail("")
    setQuickPhone("")
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [selected?.id])

  // ── Sélection (clic simple) ──────────────────────────────────────────────
  const handleClick = useCallback((node: RawNode) => {
    setSelected(prev => prev?.id === node.id ? null : node)
  }, [])

  // ── Clic sur le fond → désélection + sortie du mode focus ────────────────
  const handleBackgroundClick = useCallback(() => {
    setSelected(null)
    if (focusedNodeId) {
      setFocusedNodeId(null)
      setSearchQuery("")
    }
  }, [focusedNodeId])

  // ── Validation paiement depuis le panneau ────────────────────────────────
  function handleMarkPaid(node: RawNode) {
    startTransition(async () => {
      const dbId = node.id.replace(/^(invoice|revenue)-/, "")
      if (node.type === "INVOICE") {
        await updateInvoiceStatus(dbId, "", "PAID")
      } else if (node.type === "REVENUE") {
        await markRevenueReceived(dbId, new Date(), "VIREMENT")
      }
      setSelected(null)
      router.refresh()
    })
  }

  // ── Complétion rapide depuis le volet détail ─────────────────────────────

  function handleAssignParent() {
    if (!selected || !assignParent) return
    const dbId = selected.id.replace(/^revenue-/, "")
    const [kind, parentId] = assignParent.split(":")
    startTransition(async () => {
      await updateRevenue(dbId, kind === "client" ? { clientId: parentId } : { companyId: parentId })
      setSelected(null)
      router.refresh()
    })
  }

  function handleQuickSaveCompany() {
    if (!selected || !quickWebsite.trim()) return
    const dbId = selected.id.replace(/^company-/, "")
    startTransition(async () => {
      await updateCompany(dbId, { website: quickWebsite.trim() })
      setSelected(null)
      router.refresh()
    })
  }

  function handleQuickSaveClient() {
    if (!selected) return
    const hasInput = quickFirstName.trim() || quickLastName.trim() || quickEmail.trim() || quickPhone.trim()
    if (!hasInput) return
    const dbId = selected.id.replace(/^client-/, "")
    startTransition(async () => {
      await updateClientAll(dbId, {
        ...(quickFirstName.trim() ? { firstName: quickFirstName.trim() } : {}),
        ...(quickLastName.trim()  ? { lastName: quickLastName.trim() }   : {}),
        ...(quickEmail.trim()     ? { email: quickEmail.trim() }         : {}),
        ...(quickPhone.trim()     ? { phone: quickPhone.trim() }         : {}),
      })
      setSelected(null)
      router.refresh()
    })
  }

  // ── Toggle type filter ────────────────────────────────────────────────────
  function toggleType(t: NodeType) {
    setHidden(prev => {
      const next = new Set(prev)
      if (next.has(t)) next.delete(t)
      else next.add(t)
      return next
    })
  }

  const childCount = useMemo(() => {
    const counts = new Map<string, number>()
    rawNodes.forEach(n => {
      if (!n.parentId) return
      counts.set(n.parentId, (counts.get(n.parentId) ?? 0) + 1)
    })
    return counts
  }, [rawNodes])

  // ── Helpers pour effacer la recherche / le focus ──────────────────────────
  function clearSearch() {
    setSearchQuery("")
    setFocusedNodeId(null)
    setShowSuggestions(false)
  }

  return (
    // Fond géré par CSS pur (classes Tailwind dark:) — pas de JS → pas de flash au chargement.
    // isDark est uniquement passé au canvas pour les couleurs des nœuds / liens.
    <div
      className={[
        "relative flex h-full w-full overflow-hidden",
        "bg-[#f4f6fb] dark:bg-[#0d0f1a]",
        "[background-image:radial-gradient(rgba(0,0,0,0.09)_1px,transparent_1px)]",
        "dark:[background-image:radial-gradient(rgba(255,255,255,0.07)_1px,transparent_1px)]",
        "[background-size:26px_26px]",
      ].join(" ")}
    >

      {/* ── Canvas ─────────────────────────────────────────────────────────── */}
      <div ref={containerRef} className="flex-1 h-full">
        <ForceGraphCanvas
          ref={graphRef}
          nodes={nodes}
          links={links}
          collapsedIds={collapsedIds}
          onNodeClick={handleClick}
          onNodeDblClick={handleDblClick}
          onBackgroundClick={handleBackgroundClick}
          width={size.w}
          height={size.h}
          isDark={isDark}
          highlightedIds={highlightedIds}
          dimmedIds={dimmedIds}
        />
      </div>

      {/* ── Top-left controls ─────────────────────────────────────────────── */}
      <div className="absolute top-4 left-4 z-10 flex flex-col gap-2 w-60">

        {/* ── Titre + recherche ────────────────────────────────────────────── */}
        <div className="bg-card/90 backdrop-blur border border-border rounded-xl shadow-sm overflow-hidden">
          {/* Header titre */}
          <div className="flex items-center justify-between px-3 pt-2.5 pb-1.5 border-b border-border/50">
            <span className="text-xs font-semibold">Graph</span>
            <span className="text-[10px] text-muted-foreground tabular-nums">
              {nodes.length} nœud{nodes.length !== 1 ? "s" : ""}
            </span>
          </div>
          {/* Recherche */}
          <div className="relative px-2.5 py-2">
            <div className={`flex items-center gap-1.5 rounded-lg border px-2 py-1.5 transition-colors ${
              focusedNodeId ? "border-primary/60 bg-primary/5" : "border-input bg-muted/40"
            }`}>
              <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Rechercher…"
                value={searchQuery}
                onChange={e => {
                  setSearchQuery(e.target.value)
                  setFocusedNodeId(null)
                  setShowSuggestions(true)
                }}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 130)}
                className="bg-transparent text-xs outline-none flex-1 min-w-0 placeholder:text-muted-foreground/50"
              />
              {searchQuery ? (
                <button onMouseDown={clearSearch} className="text-muted-foreground hover:text-foreground shrink-0">
                  <X className="h-3 w-3" />
                </button>
              ) : (
                <kbd className="text-[10px] text-muted-foreground/40 bg-muted/60 border border-border/50 px-1 py-0.5 rounded font-mono leading-none shrink-0">/</kbd>
              )}
            </div>

            {/* Suggestions */}
            {showSuggestions && matchingNodes.length > 0 && (
              <div className="absolute top-full left-0 right-0 mx-2.5 bg-card/98 backdrop-blur border border-border rounded-xl shadow-xl overflow-hidden z-30">
                {matchingNodes.map(n => (
                  <button
                    key={n.id}
                    onMouseDown={() => {
                      setFocusedNodeId(n.id)
                      setSearchQuery(n.label)
                      setShowSuggestions(false)
                    }}
                    className="flex items-center gap-2 w-full px-3 py-2 text-xs hover:bg-accent text-left transition-colors"
                  >
                    <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: getDisplayColor(n) }} />
                    <span className="flex-1 min-w-0">
                      <span className="font-medium block truncate">{n.label}</span>
                      {n.meta.subtitle && <span className="text-muted-foreground block truncate">{n.meta.subtitle}</span>}
                    </span>
                    <span className="text-muted-foreground/50 text-[10px] shrink-0">{NODE_TYPE_LABELS[n.type]}</span>
                  </button>
                ))}
              </div>
            )}
            {showSuggestions && searchQuery.trim().length >= 2 && matchingNodes.length === 0 && (
              <div className="absolute top-full left-0 right-0 mx-2.5 bg-card/98 backdrop-blur border border-border rounded-xl shadow-xl z-30 px-3 py-2.5 text-xs text-muted-foreground">
                Aucun nœud correspondant
              </div>
            )}
          </div>
        </div>

        {/* ── Quick filters ────────────────────────────────────────────────── */}
        <div className="bg-card/90 backdrop-blur border border-border rounded-xl shadow-sm p-2 space-y-1">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-1 pb-0.5">Filtres rapides</p>
          <button
            onClick={() => setActiveFilter(f => f === "pending" ? null : "pending")}
            className={`flex items-center gap-2 w-full rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
              activeFilter === "pending"
                ? "bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30"
                : "hover:bg-muted/60 text-muted-foreground border border-transparent"
            }`}
          >
            <Clock className="h-3.5 w-3.5 shrink-0" />
            En attente de paiement
            <span className="ml-auto text-[10px] opacity-60">
              {rawNodes.filter(n =>
                (n.type === "INVOICE" && (n.status === "SENT" || n.status === "LATE")) ||
                (n.type === "REVENUE" && n.status === "PENDING")
              ).length}
            </span>
          </button>
          <button
            onClick={() => setActiveFilter(f => f === "incomplete" ? null : "incomplete")}
            className={`flex items-center gap-2 w-full rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
              activeFilter === "incomplete"
                ? "bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30"
                : "hover:bg-muted/60 text-muted-foreground border border-transparent"
            }`}
          >
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            Données à compléter
            <span className="ml-auto text-[10px] opacity-60">
              {rawNodes.filter(n => n.incomplete).length}
            </span>
          </button>
        </div>

        {/* ── Type filters ─────────────────────────────────────────────────── */}
        <div className="bg-card/90 backdrop-blur border border-border rounded-xl shadow-sm p-2">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-1 pb-1">Types</p>
          <div className="grid grid-cols-2 gap-0.5">
            {ALL_TYPES.map(t => {
              const count  = nodes.filter(n => n.type === t).length
              const hidden = hiddenTypes.has(t)
              return (
                <button
                  key={t}
                  onClick={() => toggleType(t)}
                  className={`flex items-center gap-1.5 rounded-md px-1.5 py-1 text-xs transition-all ${
                    hidden ? "opacity-30" : "opacity-100"
                  } hover:bg-accent`}
                >
                  {t === "SOURCE" && sourceColors.length > 0 ? (
                    <span className="flex items-center -space-x-1 shrink-0">
                      {sourceColors.slice(0, 3).map((c, i) => (
                        <span key={i} className="h-2 w-2 rounded-full border border-card/80" style={{ backgroundColor: c }} />
                      ))}
                    </span>
                  ) : (
                    <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: TYPE_DOT[t] }} />
                  )}
                  <span className="font-medium truncate">{NODE_TYPE_LABELS[t]}</span>
                  <span className="ml-auto text-muted-foreground text-[10px] shrink-0">{count}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* ── Actions + hint ───────────────────────────────────────────────── */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => graphRef.current?.zoomToFit(600)}
            className="flex items-center gap-1.5 rounded-lg border border-border bg-card/90 backdrop-blur px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-accent shadow-sm"
          >
            <Maximize2 className="h-3.5 w-3.5" />
            Centrer
          </button>
          <p className="text-[10px] text-muted-foreground/50 leading-tight">
            Clic — panneau<br/>Double-clic — réduire
          </p>
        </div>
      </div>

      {/* ── Side panel ────────────────────────────────────────────────────── */}
      <div
        className={`absolute right-0 top-0 h-full w-72 bg-card/95 backdrop-blur border-l border-border shadow-2xl z-20 ${
          selected ? "" : "hidden"
        }`}
      >
        {selected && (
          <div className="flex flex-col h-full">
            {/* Panel header */}
            <div
              className="flex items-start justify-between p-4 border-b border-border"
              style={{ borderLeftColor: getDisplayColor(selected), borderLeftWidth: 3 }}
            >
              <div className="flex-1 min-w-0 pr-2">
                <div className="flex items-center gap-2 mb-0.5">
                  <span
                    className="inline-block h-2 w-2 rounded-full shrink-0"
                    style={{ backgroundColor: getDisplayColor(selected) }}
                  />
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">
                    {NODE_TYPE_LABELS[selected.type]}
                  </span>
                </div>
                <h3 className="font-semibold text-sm leading-tight">{selected.label}</h3>
                {selected.meta.subtitle && (
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">{selected.meta.subtitle}</p>
                )}
              </div>
              <button
                onClick={() => setSelected(null)}
                className="shrink-0 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Panel body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">

              {/* Details */}
              {selected.meta.details && selected.meta.details.length > 0 && (
                <div className="space-y-2">
                  {selected.meta.details.map((d, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">{d.label}</span>
                      <span className="text-xs font-medium">{d.value}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Collapse toggle */}
              {childCount.get(selected.id) ? (
                <button
                  onClick={() => handleDblClick(selected)}
                  className="w-full flex items-center justify-between rounded-lg border border-border px-3 py-2 text-xs hover:bg-accent transition-colors"
                >
                  <span className="font-medium">
                    {collapsedIds.has(selected.id) ? "Développer" : "Réduire"} les enfants
                  </span>
                  <span className="text-muted-foreground">
                    {childCount.get(selected.id)} nœud{(childCount.get(selected.id) ?? 0) > 1 ? "s" : ""}
                  </span>
                </button>
              ) : null}

              {/* Status badge */}
              {selected.status && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Statut</span>
                  <span
                    className="inline-block rounded-full px-2 py-0.5 text-[10px] font-medium text-white"
                    style={{ backgroundColor: getDisplayColor(selected) + "cc" }}
                  >
                    {STATUS_FR[selected.status] ?? selected.status}
                  </span>
                </div>
              )}

              {/* Bloc complétion rapide */}
              {selected.incomplete && (
                <div className="space-y-2 rounded-xl border border-amber-500/30 bg-amber-500/8 p-3">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                    <span className="text-xs font-medium text-amber-700 dark:text-amber-400">
                      {selected.type === "REVENUE"  && "Société ou contact non associé"}
                      {selected.type === "COMPANY"  && "Site web manquant"}
                      {selected.type === "CLIENT"   && "Identité ou coordonnées manquantes"}
                    </span>
                  </div>

                  {/* REVENUE — picker société OU contact (ex : remboursement d'un proche) */}
                  {selected.type === "REVENUE" && (
                    <div className="space-y-1.5">
                      <select
                        value={assignParent}
                        onChange={e => setAssignParent(e.target.value)}
                        className="w-full rounded-lg border border-input bg-background px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                      >
                        <option value="">— Choisir une société ou un contact…</option>
                        <optgroup label="Sociétés">
                          {rawNodes
                            .filter(n => n.type === "COMPANY")
                            .sort((a, b) => a.label.localeCompare(b.label, "fr"))
                            .map(n => (
                              <option key={n.id} value={`company:${n.id.replace("company-", "")}`}>
                                {n.label}
                              </option>
                            ))
                          }
                        </optgroup>
                        <optgroup label="Contacts">
                          {rawNodes
                            .filter(n => n.type === "CLIENT")
                            .sort((a, b) => a.label.localeCompare(b.label, "fr"))
                            .map(n => (
                              <option key={n.id} value={`client:${n.id.replace("client-", "")}`}>
                                {n.label}
                              </option>
                            ))
                          }
                        </optgroup>
                      </select>
                      {assignParent && (
                        <button
                          onClick={handleAssignParent}
                          disabled={isPending}
                          className="w-full rounded-lg bg-amber-600 text-white text-xs font-medium py-1.5 hover:bg-amber-700 disabled:opacity-50 transition-colors"
                        >
                          {isPending ? "Enregistrement…" : "Confirmer"}
                        </button>
                      )}
                    </div>
                  )}

                  {/* COMPANY — site web */}
                  {selected.type === "COMPANY" && (
                    <div className="space-y-1.5">
                      <input
                        type="url"
                        value={quickWebsite}
                        onChange={e => setQuickWebsite(e.target.value)}
                        onKeyDown={e => e.key === "Enter" && handleQuickSaveCompany()}
                        placeholder="https://exemple.com"
                        className="w-full rounded-lg border border-input bg-background px-2.5 py-1.5 text-xs placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                      {quickWebsite.trim() && (
                        <button
                          onClick={handleQuickSaveCompany}
                          disabled={isPending}
                          className="w-full rounded-lg bg-amber-600 text-white text-xs font-medium py-1.5 hover:bg-amber-700 disabled:opacity-50 transition-colors"
                        >
                          {isPending ? "Enregistrement…" : "Enregistrer"}
                        </button>
                      )}
                    </div>
                  )}

                  {/* CLIENT — prénom/nom + email + téléphone */}
                  {selected.type === "CLIENT" && (
                    <div className="space-y-1.5">
                      <div className="flex gap-1.5">
                        <input
                          type="text"
                          value={quickFirstName}
                          onChange={e => setQuickFirstName(e.target.value)}
                          placeholder="Prénom"
                          className="w-full rounded-lg border border-input bg-background px-2.5 py-1.5 text-xs placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                        <input
                          type="text"
                          value={quickLastName}
                          onChange={e => setQuickLastName(e.target.value)}
                          placeholder="Nom"
                          className="w-full rounded-lg border border-input bg-background px-2.5 py-1.5 text-xs placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                      </div>
                      <input
                        type="email"
                        value={quickEmail}
                        onChange={e => setQuickEmail(e.target.value)}
                        placeholder="email@exemple.com"
                        className="w-full rounded-lg border border-input bg-background px-2.5 py-1.5 text-xs placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                      <input
                        type="tel"
                        value={quickPhone}
                        onChange={e => setQuickPhone(e.target.value)}
                        onKeyDown={e => e.key === "Enter" && handleQuickSaveClient()}
                        placeholder="+33 6 …"
                        className="w-full rounded-lg border border-input bg-background px-2.5 py-1.5 text-xs placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                      {(quickFirstName.trim() || quickLastName.trim() || quickEmail.trim() || quickPhone.trim()) && (
                        <button
                          onClick={handleQuickSaveClient}
                          disabled={isPending}
                          className="w-full rounded-lg bg-amber-600 text-white text-xs font-medium py-1.5 hover:bg-amber-700 disabled:opacity-50 transition-colors"
                        >
                          {isPending ? "Enregistrement…" : "Enregistrer"}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Amount */}
              {selected.amount !== undefined && (
                <div className="rounded-xl border border-border p-3 text-center">
                  <p className="text-xs text-muted-foreground mb-0.5">Montant HT</p>
                  <p className="text-lg font-bold tabular-nums">
                    {selected.amount.toLocaleString("fr-FR", { minimumFractionDigits: 0 })} €
                  </p>
                </div>
              )}
            </div>

            {/* Footer CTA */}
            {(selected.meta.href || ((selected.type === "INVOICE" && (selected.status === "SENT" || selected.status === "LATE")) || (selected.type === "REVENUE" && selected.status === "PENDING"))) && (
              <div className="p-4 border-t border-border space-y-2">
                {/* Bouton valider paiement */}
                {((selected.type === "INVOICE" && (selected.status === "SENT" || selected.status === "LATE")) ||
                  (selected.type === "REVENUE" && selected.status === "PENDING")) && (
                  <button
                    onClick={() => handleMarkPaid(selected)}
                    disabled={isPending}
                    className="flex items-center justify-center gap-2 w-full rounded-lg bg-emerald-600 text-white text-sm font-medium py-2 hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {isPending ? "Validation…" : selected.type === "INVOICE" ? "Marquer payée" : "Marquer reçu"}
                  </button>
                )}
                {selected.meta.href && (
                  <Link
                    href={selected.meta.href}
                    className="flex items-center justify-center gap-2 w-full rounded-lg bg-primary text-primary-foreground text-sm font-medium py-2 hover:opacity-90 transition-opacity"
                  >
                    Ouvrir la page
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Link>
                )}
              </div>
            )}
          </div>
        )}
      </div>

    </div>
  )
}
