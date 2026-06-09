"use client"

// Ce composant est importé uniquement côté client (ssr: false) pour éviter
// les erreurs "window is not defined" de react-force-graph-2d.

import ForceGraph2D from "react-force-graph-2d"
import type { ForceGraphMethods, NodeObject } from "react-force-graph-2d"
import { useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from "react"
import type { RawNode, RawLink } from "./graph-types"
import { nodeColor, NODE_RADIUS } from "./graph-types"

export type GraphMethods = {
  zoomToFit: (ms?: number) => void
}

type Props = {
  nodes:           RawNode[]
  links:           RawLink[]
  collapsedIds:    Set<string>
  onNodeClick:     (node: RawNode) => void
  onNodeDblClick:  (node: RawNode) => void
  width:           number
  height:          number
}

const DBL_CLICK_MS = 300

export const ForceGraphCanvas = forwardRef<GraphMethods, Props>(function ForceGraphCanvas(
  { nodes, links, collapsedIds, onNodeClick, onNodeDblClick, width, height },
  ref
) {
  const fgRef      = useRef<ForceGraphMethods<NodeObject, object> | undefined>(undefined)
  const lastClick  = useRef<{ id: string | number; time: number } | null>(null)
  const singleTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useImperativeHandle(ref, () => ({
    zoomToFit: (ms = 600) => fgRef.current?.zoomToFit(ms, 60),
  }))

  // Configure D3 forces : charge réduite + liens courts pour resserrer le graphe
  useEffect(() => {
    const fg = fgRef.current
    if (!fg) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const charge = fg.d3Force("charge") as any
    if (charge?.strength) charge.strength(-60)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const link = fg.d3Force("link") as any
    if (link?.distance) link.distance(55)
    fg.d3ReheatSimulation()
  }, [])

  // Initial fit after first render
  useEffect(() => {
    const t = setTimeout(() => fgRef.current?.zoomToFit(600, 60), 500)
    return () => clearTimeout(t)
  }, [])

  // Manual double-click detection on top of onNodeClick
  const handleClick = useCallback((raw: NodeObject) => {
    const node = raw as RawNode
    const now  = Date.now()
    const prev = lastClick.current

    if (prev && prev.id === node.id && now - prev.time < DBL_CLICK_MS) {
      // It's a double-click — cancel the pending single-click
      if (singleTimer.current) clearTimeout(singleTimer.current)
      lastClick.current = null
      onNodeDblClick(node)
    } else {
      lastClick.current = { id: node.id, time: now }
      // Delay single-click to let double-click cancel it
      singleTimer.current = setTimeout(() => {
        if (lastClick.current?.id === node.id) {
          onNodeClick(node)
          lastClick.current = null
        }
      }, DBL_CLICK_MS)
    }
  }, [onNodeClick, onNodeDblClick])

  const drawNode = useCallback((raw: NodeObject, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const n = raw as RawNode & { x: number; y: number }
    const r = NODE_RADIUS[n.type]
    const color = nodeColor(n)

    // Glow for companies
    if (n.type === "COMPANY") {
      ctx.shadowColor = color
      ctx.shadowBlur  = 14
    }

    // Main circle
    ctx.beginPath()
    ctx.arc(n.x, n.y, r, 0, 2 * Math.PI)
    ctx.fillStyle = color
    ctx.fill()

    // Ring
    ctx.strokeStyle = "rgba(255,255,255,0.2)"
    ctx.lineWidth   = n.type === "COMPANY" ? 2 : 1
    ctx.stroke()

    ctx.shadowBlur = 0

    // Red dot if collapsed
    if (collapsedIds.has(n.id)) {
      ctx.beginPath()
      ctx.arc(n.x + r - 2, n.y - r + 2, 4, 0, 2 * Math.PI)
      ctx.fillStyle = "#ef4444"
      ctx.fill()
    }

    // Label — toujours visible pour tous les nœuds
    const fontSize = n.type === "COMPANY"
      ? Math.max(5, 13 / globalScale)
      : Math.max(4, 10 / globalScale)

    const text = n.label.length > 22 ? n.label.slice(0, 20) + "…" : n.label
    ctx.font = `${n.type === "COMPANY" ? "600 " : ""}${fontSize}px Inter, system-ui, sans-serif`
    ctx.textAlign    = "center"
    ctx.textBaseline = "top"

    const tw = ctx.measureText(text).width
    const ty = n.y + r + 3

    // Backdrop
    ctx.fillStyle = "rgba(0,0,0,0.55)"
    ctx.beginPath()
    ctx.roundRect(n.x - tw / 2 - 3, ty - 1, tw + 6, fontSize + 4, 2)
    ctx.fill()

    ctx.fillStyle = n.type === "COMPANY" ? "#fef3c7" : "rgba(255,255,255,0.88)"
    ctx.fillText(text, n.x, ty + 1)
  }, [collapsedIds])

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
      linkColor={() => "rgba(150,150,180,0.22)"}
      linkWidth={1}
      linkCurvature={0.1}
      onNodeClick={handleClick}
      enableZoomInteraction
      enablePanInteraction
      enableNodeDrag
      cooldownTime={2500}
      d3VelocityDecay={0.25}
    />
  )
})
