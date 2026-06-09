"use client"

import { useState, useMemo, useCallback, useRef, useEffect } from "react"
import dynamic from "next/dynamic"
import Link from "next/link"
import { X, Maximize2, ExternalLink, ChevronDown, ChevronRight } from "lucide-react"
import type { RawNode, RawLink, NodeType } from "./graph-types"
import { NODE_TYPE_LABELS, NODE_BASE_COLORS } from "./graph-types"
import type { GraphMethods } from "./ForceGraphCanvas"

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

// ── Type filter toggles ───────────────────────────────────────────────────────

const ALL_TYPES: NodeType[] = ["COMPANY", "CLIENT", "PROJECT", "INVOICE", "QUOTE"]

const TYPE_DOT: Record<NodeType, string> = {
  COMPANY: NODE_BASE_COLORS.COMPANY,
  CLIENT:  NODE_BASE_COLORS.CLIENT,
  PROJECT: NODE_BASE_COLORS.PROJECT,
  INVOICE: NODE_BASE_COLORS.INVOICE,
  QUOTE:   NODE_BASE_COLORS.QUOTE,
}

// ── Main component ────────────────────────────────────────────────────────────

export function GraphView({ rawNodes, rawLinks }: { rawNodes: RawNode[]; rawLinks: RawLink[] }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const graphRef     = useRef<GraphMethods>(null)

  const [size, setSize]             = useState({ w: 800, h: 600 })
  const [collapsedIds, setCollapsed] = useState<Set<string>>(new Set())
  const [hiddenTypes, setHidden]    = useState<Set<NodeType>>(new Set())
  const [selected, setSelected]     = useState<RawNode | null>(null)
  const [isDark, setIsDark]         = useState(true)

  // Suit le thème en temps réel (classe "dark" sur <html>)
  useEffect(() => {
    const html  = document.documentElement
    const check = () => setIsDark(html.classList.contains("dark"))
    check()
    const obs = new MutationObserver(check)
    obs.observe(html, { attributes: true, attributeFilter: ["class"] })
    return () => obs.disconnect()
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

  // Node map for collapse logic
  const nodeMap = useMemo(
    () => new Map(rawNodes.map(n => [n.id, n])),
    [rawNodes]
  )

  // Compute visible graph
  const { nodes, links } = useMemo(() => {
    const visNodes = rawNodes.filter(n => {
      if (hiddenTypes.has(n.type)) return false
      return isNodeVisible(n.id, nodeMap, collapsedIds)
    })
    const visIds = new Set(visNodes.map(n => n.id))
    // D3 mute les liens en place : source/target passent de string à objet nœud.
    // On extrait l'id dans les deux cas pour que le filtre reste valide après mutation.
    const resolveId = (v: unknown): string =>
      typeof v === "object" && v !== null ? (v as { id: string }).id : v as string
    const visLinks = rawLinks.filter(l =>
      visIds.has(resolveId(l.source)) && visIds.has(resolveId(l.target))
    )
    return { nodes: visNodes, links: visLinks }
  }, [rawNodes, rawLinks, nodeMap, collapsedIds, hiddenTypes])

  // Toggle collapse on double-click
  const handleDblClick = useCallback((node: RawNode) => {
    setCollapsed(prev => {
      const next = new Set(prev)
      if (next.has(node.id)) next.delete(node.id)
      else next.add(node.id)
      return next
    })
  }, [])

  // Click → select
  const handleClick = useCallback((node: RawNode) => {
    setSelected(prev => prev?.id === node.id ? null : node)
  }, [])

  // Toggle type filter
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

  return (
    <div
      className="relative flex h-full w-full overflow-hidden"
      style={isDark ? {
        backgroundColor: "#0d0f1a",
        backgroundImage: "radial-gradient(rgba(255,255,255,0.07) 1px, transparent 1px)",
        backgroundSize: "26px 26px",
      } : {
        backgroundColor: "#f4f6fb",
        backgroundImage: "radial-gradient(rgba(0,0,0,0.09) 1px, transparent 1px)",
        backgroundSize: "26px 26px",
      }}
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
          onBackgroundClick={() => setSelected(null)}
          width={size.w}
          height={size.h}
          isDark={isDark}
        />
      </div>

      {/* ── Top-left controls ─────────────────────────────────────────────── */}
      <div className="absolute top-4 left-4 z-10 flex flex-col gap-2">
        {/* Title */}
        <div className="flex items-center gap-2 bg-card/80 backdrop-blur border border-border rounded-xl px-3 py-2 shadow-sm">
          <span className="text-sm font-semibold">Graphe relationnel</span>
          <span className="text-xs text-muted-foreground ml-1">
            {nodes.length} nœud{nodes.length !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Type filters */}
        <div className="bg-card/80 backdrop-blur border border-border rounded-xl px-3 py-2 shadow-sm space-y-1">
          {ALL_TYPES.map(t => {
            const count  = nodes.filter(n => n.type === t).length
            const hidden = hiddenTypes.has(t)
            return (
              <button
                key={t}
                onClick={() => toggleType(t)}
                className={`flex items-center gap-2 w-full rounded-md px-1.5 py-1 text-xs transition-opacity ${
                  hidden ? "opacity-35" : "opacity-100"
                } hover:bg-accent`}
              >
                <span
                  className="h-2.5 w-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: TYPE_DOT[t] }}
                />
                <span className="font-medium">{NODE_TYPE_LABELS[t]}</span>
                <span className="ml-auto text-muted-foreground">{count}</span>
              </button>
            )
          })}
        </div>

        {/* Actions */}
        <div className="flex gap-1.5">
          <button
            onClick={() => graphRef.current?.zoomToFit(600)}
            title="Centrer la vue"
            className="flex items-center gap-1.5 rounded-lg border border-border bg-card/80 backdrop-blur px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-accent shadow-sm"
          >
            <Maximize2 className="h-3.5 w-3.5" />
            Centrer
          </button>
        </div>

        {/* Hint */}
        <p className="text-[10px] text-muted-foreground/60 px-0.5">
          Clic — panneau · Double-clic — réduire
        </p>
      </div>

      {/* ── Side panel ────────────────────────────────────────────────────── */}
      <div
        className={`absolute right-0 top-0 h-full w-72 bg-card/95 backdrop-blur border-l border-border shadow-2xl transition-transform duration-300 z-20 ${
          selected ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {selected && (
          <div className="flex flex-col h-full">
            {/* Panel header */}
            <div
              className="flex items-start justify-between p-4 border-b border-border"
              style={{ borderLeftColor: TYPE_DOT[selected.type], borderLeftWidth: 3 }}
            >
              <div className="flex-1 min-w-0 pr-2">
                <div className="flex items-center gap-2 mb-0.5">
                  <span
                    className="inline-block h-2 w-2 rounded-full shrink-0"
                    style={{ backgroundColor: TYPE_DOT[selected.type] }}
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

              {/* Status badge if present */}
              {selected.status && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Statut</span>
                  <span
                    className="inline-block rounded-full px-2 py-0.5 text-[10px] font-medium text-white"
                    style={{ backgroundColor: TYPE_DOT[selected.type] + "cc" }}
                  >
                    {selected.status}
                  </span>
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
            {selected.meta.href && (
              <div className="p-4 border-t border-border">
                <Link
                  href={selected.meta.href}
                  className="flex items-center justify-center gap-2 w-full rounded-lg bg-primary text-primary-foreground text-sm font-medium py-2 hover:opacity-90 transition-opacity"
                >
                  Ouvrir la page
                  <ExternalLink className="h-3.5 w-3.5" />
                </Link>
              </div>
            )}
          </div>
        )}
      </div>

    </div>
  )
}
