"use client"

import ForceGraph2D from "react-force-graph-2d"
import type { ForceGraphMethods, NodeObject } from "react-force-graph-2d"
import { useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from "react"
import type { RawNode, RawLink } from "./graph-types"
import { nodeColor, NODE_RADIUS } from "./graph-types"

export type GraphMethods = { zoomToFit: (ms?: number) => void }

type Props = {
  nodes:          RawNode[]
  links:          RawLink[]
  collapsedIds:   Set<string>
  onNodeClick:    (node: RawNode) => void
  onNodeDblClick: (node: RawNode) => void
  width:  number
  height: number
}

const DBL_MS = 280

export const ForceGraphCanvas = forwardRef<GraphMethods, Props>(function ForceGraphCanvas(
  { nodes, links, collapsedIds, onNodeClick, onNodeDblClick, width, height },
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
      if (charge?.strength) charge.strength(-120)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const link = fg.d3Force("link") as any
      if (link?.distance) link.distance(70)
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
    const r     = NODE_RADIUS[n.type]
    const color = nodeColor(n)
    const x     = n.x
    const y     = n.y

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

    // Shadow for readability (no opaque box)
    ctx.shadowColor = "rgba(0,0,0,0.95)"
    ctx.shadowBlur  = 5
    ctx.fillStyle   = isCompany ? "#fde68a" : "rgba(226,232,240,0.95)"
    ctx.fillText(text, x, ty)
    ctx.shadowBlur = 0

    // Second pass for crispness
    ctx.fillStyle = isCompany ? "#fde68a" : "rgba(248,250,252,0.9)"
    ctx.fillText(text, x, ty)

  }, [collapsedIds])

  // ── Link color based on connection depth ──────────────────────────────────
  const getLinkColor = useCallback((link: object) => {
    const l = link as { source: { type?: string } | string; target: { type?: string } | string }
    const srcType = typeof l.source === "object" ? (l.source as RawNode).type : ""
    switch (srcType) {
      case "COMPANY": return "rgba(245,158,11,0.45)"   // amber
      case "CLIENT":  return "rgba(139,92,246,0.45)"   // violet
      case "PROJECT": return "rgba(52,211,153,0.45)"   // emerald
      default:        return "rgba(148,163,184,0.35)"
    }
  }, [])

  return (
    <ForceGraph2D
      ref={fgRef as React.MutableRefObject<ForceGraphMethods<NodeObject, object>>}
      graphData={{ nodes: nodes as NodeObject[], links: links as object[] }}
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
      enableZoomInteraction
      enablePanInteraction
      enableNodeDrag
      cooldownTime={3000}
      d3VelocityDecay={0.3}
      d3AlphaDecay={0.02}
    />
  )
})
