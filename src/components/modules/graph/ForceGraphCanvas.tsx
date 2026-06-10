"use client"

import ForceGraph2D from "react-force-graph-2d"
import type { ForceGraphMethods, NodeObject } from "react-force-graph-2d"
import { useRef, useEffect, useCallback, useMemo, forwardRef, useImperativeHandle } from "react"
import type { RawNode, RawLink, NodeType } from "./graph-types"
import { nodeColor, NODE_RADIUS } from "./graph-types"

// Formatte un montant de façon compacte pour le canvas
function fmtAmount(n: number): string {
  if (n >= 10_000) return `${Math.round(n / 1000)}k €`
  if (n >= 1_000)  return `${(n / 1000).toLocaleString("fr-FR", { maximumFractionDigits: 1 })}k €`
  return `${Math.round(n).toLocaleString("fr-FR")} €`
}

// Ordre de rendu : les nœuds parents sont peints en dernier → leur hitbox gagne
// face aux enfants qui se superposent (color-picking canvas caché)
const TYPE_Z: Record<NodeType, number> = {
  INVOICE: 0, QUOTE: 0, PROJECT: 1, CLIENT: 2, COMPANY: 3, SOURCE: 4,
}

export type GraphMethods = { zoomToFit: (ms?: number) => void }

type Props = {
  nodes:             RawNode[]
  links:             RawLink[]
  collapsedIds:      Set<string>
  onNodeClick:       (node: RawNode) => void
  onNodeDblClick:    (node: RawNode) => void
  onBackgroundClick: () => void
  width:   number
  height:  number
  isDark?: boolean
}

const DBL_MS = 280

export const ForceGraphCanvas = forwardRef<GraphMethods, Props>(function ForceGraphCanvas(
  { nodes, links, collapsedIds, onNodeClick, onNodeDblClick, onBackgroundClick, width, height, isDark = true },
  ref
) {
  const fgRef       = useRef<ForceGraphMethods<NodeObject, object> | undefined>(undefined)
  const lastClick   = useRef<{ id: string | number; time: number } | null>(null)
  const singleTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useImperativeHandle(ref, () => ({
    zoomToFit: (ms = 600) => fgRef.current?.zoomToFit(ms, 60),
  }))

  // Configure D3 forces once mounted
  useEffect(() => {
    const t = setTimeout(() => {
      const fg = fgRef.current
      if (!fg) return
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const charge = fg.d3Force("charge") as any
      if (charge?.strength) charge.strength(-60)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const link = fg.d3Force("link") as any
      if (link?.distance) link.distance(45)
      fg.d3ReheatSimulation()
    }, 100)
    return () => clearTimeout(t)
  }, [])

  // Zoom to fit after simulation stabilises
  useEffect(() => {
    const t = setTimeout(() => fgRef.current?.zoomToFit(800, 80), 1800)
    return () => clearTimeout(t)
  }, [])

  // Double-click detection
  const handleClick = useCallback((raw: NodeObject) => {
    const node = raw as RawNode
    const now  = Date.now()
    const prev = lastClick.current
    if (prev && prev.id === node.id && now - prev.time < DBL_MS) {
      if (singleTimer.current) clearTimeout(singleTimer.current)
      lastClick.current = null
      onNodeDblClick(node)
    } else {
      lastClick.current = { id: node.id, time: now }
      singleTimer.current = setTimeout(() => {
        if (lastClick.current?.id === node.id) {
          onNodeClick(node)
          lastClick.current = null
        }
      }, DBL_MS)
    }
  }, [onNodeClick, onNodeDblClick])

  // ── Node renderer ──────────────────────────────────────────────────────────
  const drawNode = useCallback((raw: NodeObject, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const n     = raw as RawNode & { x: number; y: number }
    const x     = n.x
    const y     = n.y
    // Coordonnées pas encore assignées par D3 → skip
    if (!isFinite(x) || !isFinite(y)) return

    const r     = NODE_RADIUS[n.type]
    // SOURCE utilise la couleur personnalisée stockée dans meta.color
    const color = n.type === "SOURCE" && n.meta.color ? n.meta.color : nodeColor(n)

    // ── SOURCE : hexagone distinctif ───────────────────────────────────────
    if (n.type === "SOURCE") {
      // Halo externe
      const haloS = ctx.createRadialGradient(x, y, r * 0.6, x, y, r * 2.4)
      haloS.addColorStop(0, color + "55")
      haloS.addColorStop(1, color + "00")
      ctx.beginPath(); ctx.arc(x, y, r * 2.4, 0, 2 * Math.PI)
      ctx.fillStyle = haloS; ctx.fill()

      // Hexagone
      const sides = 6
      ctx.beginPath()
      for (let i = 0; i < sides; i++) {
        const angle = (Math.PI / 180) * (60 * i - 30)
        const px = x + r * Math.cos(angle)
        const py = y + r * Math.sin(angle)
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py)
      }
      ctx.closePath()
      ctx.fillStyle = color; ctx.fill()

      // Highlight interne
      const hiS = ctx.createRadialGradient(x - r * 0.35, y - r * 0.35, 0, x, y, r)
      hiS.addColorStop(0, "rgba(255,255,255,0.35)")
      hiS.addColorStop(1, "rgba(255,255,255,0.00)")
      ctx.beginPath()
      for (let i = 0; i < sides; i++) {
        const angle = (Math.PI / 180) * (60 * i - 30)
        const px = x + r * Math.cos(angle)
        const py = y + r * Math.sin(angle)
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py)
      }
      ctx.closePath()
      ctx.fillStyle = hiS; ctx.fill()

      // Bordure
      ctx.strokeStyle = "rgba(255,255,255,0.25)"; ctx.lineWidth = 1.5
      ctx.beginPath()
      for (let i = 0; i < sides; i++) {
        const angle = (Math.PI / 180) * (60 * i - 30)
        const px = x + r * Math.cos(angle)
        const py = y + r * Math.sin(angle)
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py)
      }
      ctx.closePath(); ctx.stroke()

      // Label
      const fsz = Math.max(7, 15 / globalScale)
      const text = n.label.length > 22 ? n.label.slice(0, 21) + "…" : n.label
      ctx.font = `700 ${fsz}px -apple-system, "Inter", sans-serif`
      ctx.textAlign = "center"; ctx.textBaseline = "top"
      const labelC = isDark ? "#fde68a" : "#92400e"
      const shadowC = isDark ? "rgba(0,0,0,0.95)" : "rgba(255,255,255,0.85)"
      ctx.shadowColor = shadowC; ctx.shadowBlur = 6
      ctx.fillStyle = labelC; ctx.fillText(text, x, y + r + 5)
      ctx.shadowBlur = 0; ctx.fillStyle = labelC; ctx.fillText(text, x, y + r + 5)

      // Bucket badge sous le label
      if (n.meta.subtitle) {
        const bsz = Math.max(4.5, 9 / globalScale)
        ctx.font = `500 ${bsz}px -apple-system, "Inter", sans-serif`
        const badgeC = isDark ? "rgba(248,250,252,0.60)" : "rgba(15,23,42,0.50)"
        ctx.shadowColor = shadowC; ctx.shadowBlur = 4
        ctx.fillStyle = badgeC; ctx.fillText(n.meta.subtitle, x, y + r + 5 + fsz + 2)
        ctx.shadowBlur = 0; ctx.fillStyle = badgeC; ctx.fillText(n.meta.subtitle, x, y + r + 5 + fsz + 2)
      }
      return
    }

    // ── Outer glow (company only) ──────────────────────────────────────────
    if (n.type === "COMPANY") {
      const grad = ctx.createRadialGradient(x, y, r * 0.6, x, y, r * 2.2)
      grad.addColorStop(0, color + "55")
      grad.addColorStop(1, color + "00")
      ctx.beginPath()
      ctx.arc(x, y, r * 2.2, 0, 2 * Math.PI)
      ctx.fillStyle = grad
      ctx.fill()
    }

    // ── Soft halo for all nodes ────────────────────────────────────────────
    const halo = ctx.createRadialGradient(x, y, r * 0.5, x, y, r * 1.6)
    halo.addColorStop(0, color + "44")
    halo.addColorStop(1, color + "00")
    ctx.beginPath()
    ctx.arc(x, y, r * 1.6, 0, 2 * Math.PI)
    ctx.fillStyle = halo
    ctx.fill()

    // ── Main circle ───────────────────────────────────────────────────────
    ctx.beginPath()
    ctx.arc(x, y, r, 0, 2 * Math.PI)
    ctx.fillStyle = color
    ctx.fill()

    // ── Inner highlight (3D feel) ─────────────────────────────────────────
    const hi = ctx.createRadialGradient(x - r * 0.35, y - r * 0.35, 0, x, y, r)
    hi.addColorStop(0, "rgba(255,255,255,0.35)")
    hi.addColorStop(1, "rgba(255,255,255,0.00)")
    ctx.beginPath()
    ctx.arc(x, y, r, 0, 2 * Math.PI)
    ctx.fillStyle = hi
    ctx.fill()

    // ── Border ring ────────────────────────────────────────────────────────
    ctx.beginPath()
    ctx.arc(x, y, r, 0, 2 * Math.PI)
    ctx.strokeStyle = "rgba(255,255,255,0.18)"
    ctx.lineWidth   = 1
    ctx.stroke()

    // ── Collapsed badge ────────────────────────────────────────────────────
    if (collapsedIds.has(n.id)) {
      ctx.beginPath()
      ctx.arc(x + r * 0.72, y - r * 0.72, 4.5, 0, 2 * Math.PI)
      ctx.fillStyle = "#ef4444"
      ctx.fill()
      ctx.strokeStyle = "rgba(0,0,0,0.6)"
      ctx.lineWidth = 1
      ctx.stroke()
    }

    // ── Label ──────────────────────────────────────────────────────────────
    const isCompany = n.type === "COMPANY"
    const fontSize  = isCompany
      ? Math.max(6,  14 / globalScale)
      : Math.max(4.5, 11 / globalScale)

    const maxChars  = isCompany ? 26 : 20
    const text      = n.label.length > maxChars ? n.label.slice(0, maxChars - 1) + "…" : n.label
    const fontWeight = isCompany ? "700" : "500"

    ctx.font         = `${fontWeight} ${fontSize}px -apple-system, "Inter", sans-serif`
    ctx.textAlign    = "center"
    ctx.textBaseline = "top"

    const ty = y + r + 5

    // Label colors — adapt to theme
    const labelColor = isDark
      ? (isCompany ? "#fde68a"  : "rgba(248,250,252,0.92)")
      : (isCompany ? "#92400e"  : "rgba(15,23,42,0.88)")
    const shadowColor = isDark
      ? "rgba(0,0,0,0.95)"
      : "rgba(255,255,255,0.85)"

    // Shadow for readability (no opaque box)
    ctx.shadowColor = shadowColor
    ctx.shadowBlur  = 5
    ctx.fillStyle   = labelColor
    ctx.fillText(text, x, ty)
    ctx.shadowBlur = 0

    // Second pass for crispness
    ctx.fillStyle = labelColor
    ctx.fillText(text, x, ty)

    // ── Amount (INVOICE / QUOTE only) ──────────────────────────────────────
    if (n.amount !== undefined && (n.type === "INVOICE" || n.type === "QUOTE")) {
      const amtFontSize = Math.max(3.5, 9 / globalScale)
      const amtText     = fmtAmount(n.amount)
      ctx.font          = `600 ${amtFontSize}px -apple-system, "Inter", sans-serif`
      ctx.textAlign     = "center"
      ctx.textBaseline  = "top"
      const amtColor    = isDark ? "rgba(248,250,252,0.65)" : "rgba(15,23,42,0.55)"
      const amtY        = ty + fontSize + 2
      ctx.shadowColor   = shadowColor
      ctx.shadowBlur    = 4
      ctx.fillStyle     = amtColor
      ctx.fillText(amtText, x, amtY)
      ctx.shadowBlur    = 0
      ctx.fillStyle     = amtColor
      ctx.fillText(amtText, x, amtY)
    }

  }, [collapsedIds, isDark])

  // Nœuds triés par profondeur croissante → COMPANY rendu en dernier, hitbox prioritaire
  const sortedNodes = useMemo(
    () => [...nodes].sort((a, b) => TYPE_Z[a.type] - TYPE_Z[b.type]),
    [nodes]
  )

  // Index id → type pour résoudre la couleur sans dépendre de la résolution D3
  const nodeTypeMap = useMemo(
    () => new Map(nodes.map(n => [n.id, n.type])),
    [nodes]
  )

  // ── Link color based on source node type ─────────────────────────────────
  const getLinkColor = useCallback((link: object) => {
    const l = link as { source: RawNode | string }
    // l.source est soit un string (avant résolution D3) soit l'objet nœud (après)
    const srcId   = typeof l.source === "object" ? l.source.id : l.source
    const srcType = nodeTypeMap.get(srcId as string) ?? ""
    if (isDark) {
      switch (srcType) {
        case "COMPANY": return "rgba(245,158,11,0.55)"
        case "CLIENT":  return "rgba(139,92,246,0.55)"
        case "PROJECT": return "rgba(52,211,153,0.55)"
        default:        return "rgba(148,163,184,0.45)"
      }
    } else {
      switch (srcType) {
        case "COMPANY": return "rgba(180,110,0,0.60)"
        case "CLIENT":  return "rgba(100,60,200,0.55)"
        case "PROJECT": return "rgba(16,150,100,0.55)"
        default:        return "rgba(80,100,130,0.50)"
      }
    }
  }, [isDark, nodeTypeMap])

  return (
    <ForceGraph2D
      ref={fgRef as React.MutableRefObject<ForceGraphMethods<NodeObject, object>>}
      graphData={{ nodes: sortedNodes as NodeObject[], links: links as object[] }}
      width={width}
      height={height}
      backgroundColor="transparent"
      nodeLabel={() => ""}
      nodeCanvasObjectMode={() => "replace"}
      nodeCanvasObject={drawNode}
      nodeVal={(n) => { const r = NODE_RADIUS[(n as RawNode).type]; return r * r }}
      nodeColor={(n) => nodeColor(n as RawNode)}
      linkColor={getLinkColor}
      linkWidth={1.8}
      linkCurvature={0.12}
      linkDirectionalParticles={2}
      linkDirectionalParticleWidth={2}
      linkDirectionalParticleColor={getLinkColor}
      linkDirectionalParticleSpeed={0.005}
      onNodeClick={handleClick}
      onBackgroundClick={onBackgroundClick}
      enableZoomInteraction
      enablePanInteraction
      enableNodeDrag
      cooldownTime={3000}
      d3VelocityDecay={0.3}
      d3AlphaDecay={0.02}
    />
  )
})
