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
const TYPE_Z: Record<NodeType, number> = {
  REVENUE: 0, INVOICE: 0, QUOTE: 0, PROJECT: 1, CLIENT: 2, COMPANY: 3, SOURCE: 4,
}

// ── Icône minimaliste par type ──────────────────────────────────────────────
function drawNodeIcon(
  ctx: CanvasRenderingContext2D,
  type: NodeType,
  cx: number,
  cy: number,
  r: number,
) {
  if (r < 7) return
  const s  = r * 0.50
  const lw = Math.max(0.5, r * 0.075)

  ctx.save()
  ctx.strokeStyle = "rgba(255,255,255,0.72)"
  ctx.fillStyle   = "rgba(255,255,255,0.72)"
  ctx.lineWidth   = lw
  ctx.lineCap     = "round"
  ctx.lineJoin    = "round"
  ctx.textAlign    = "center"
  ctx.textBaseline = "middle"

  switch (type) {
    case "SOURCE": {
      ctx.font = `bold ${s * 1.05}px sans-serif`
      ctx.fillText("★", cx, cy + s * 0.07)
      break
    }
    case "COMPANY": {
      // Bâtiment : carré + 4 fenêtres + porte
      const bw = s, bh = s * 1.25
      const bx = cx - bw / 2, by = cy - bh / 2
      ctx.strokeRect(bx, by, bw, bh)
      const ws = s * 0.20
      ctx.fillRect(bx + s * 0.10,            by + s * 0.15, ws, ws)
      ctx.fillRect(bx + bw - s * 0.10 - ws,  by + s * 0.15, ws, ws)
      ctx.fillRect(bx + s * 0.10,            by + s * 0.52, ws, ws)
      ctx.fillRect(bx + bw - s * 0.10 - ws,  by + s * 0.52, ws, ws)
      ctx.fillRect(cx - s * 0.15, by + bh - s * 0.42, s * 0.30, s * 0.42)
      break
    }
    case "CLIENT": {
      // Silhouette : tête + épaules
      ctx.beginPath(); ctx.arc(cx, cy - s * 0.28, s * 0.35, 0, 2 * Math.PI); ctx.stroke()
      ctx.beginPath(); ctx.arc(cx, cy + s * 0.95, s * 0.82, Math.PI * 1.18, Math.PI * 1.82); ctx.stroke()
      break
    }
    case "PROJECT": {
      // Dossier : rectangle + onglet
      const fw = s * 1.05, fh = s * 0.82
      const fx = cx - fw / 2, fy = cy - fh / 2 + fh * 0.18
      ctx.strokeRect(fx, fy, fw, fh)
      ctx.beginPath()
      ctx.moveTo(fx, fy)
      ctx.lineTo(fx, cy - fh / 2)
      ctx.lineTo(fx + fw * 0.38, cy - fh / 2)
      ctx.lineTo(fx + fw * 0.50, fy)
      ctx.stroke()
      break
    }
    case "INVOICE": {
      // Document + 3 lignes
      const dw = s * 0.82, dh = s * 1.05
      const dx = cx - dw / 2, dy = cy - dh / 2
      ctx.strokeRect(dx, dy, dw, dh)
      for (let i = 0; i < 3; i++) {
        ctx.beginPath()
        ctx.moveTo(dx + dw * 0.18, dy + dh * (0.27 + i * 0.25))
        ctx.lineTo(dx + dw * 0.82, dy + dh * (0.27 + i * 0.25))
        ctx.stroke()
      }
      break
    }
    case "QUOTE": {
      // Document + "?"
      const qw = s * 0.82, qh = s * 1.05
      ctx.strokeRect(cx - qw / 2, cy - qh / 2, qw, qh)
      ctx.font = `bold ${s * 0.62}px -apple-system, sans-serif`
      ctx.fillText("?", cx, cy + s * 0.10)
      break
    }
    case "REVENUE": {
      // Signe €
      ctx.font = `600 ${s * 0.95}px -apple-system, sans-serif`
      ctx.fillText("€", cx, cy + s * 0.07)
      break
    }
  }

  ctx.restore()
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
  highlightedIds?: Set<string>   // nœuds mis en valeur (résultats de recherche)
  dimmedIds?:      Set<string>   // nœuds atténués (non-correspondants à la recherche)
}

const DBL_MS = 280

export const ForceGraphCanvas = forwardRef<GraphMethods, Props>(function ForceGraphCanvas(
  { nodes, links, collapsedIds, onNodeClick, onNodeDblClick, onBackgroundClick,
    width, height, isDark = true, highlightedIds, dimmedIds },
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
      if (charge?.strength) charge.strength(-28)   // moins de répulsion → clusters plus denses
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const link = fg.d3Force("link") as any
      if (link?.distance) link.distance(22)         // liens plus courts → familles resserrées
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

  // ── Pointer hit area : uniquement le cercle principal ──────────────────────
  const paintPointerArea = useCallback((raw: NodeObject, color: string, ctx: CanvasRenderingContext2D) => {
    const n = raw as RawNode & { x: number; y: number }
    if (!isFinite(n.x) || !isFinite(n.y)) return
    ctx.beginPath()
    ctx.arc(n.x, n.y, NODE_RADIUS[n.type], 0, 2 * Math.PI)
    ctx.fillStyle = color
    ctx.fill()
  }, [])

  // ── Node renderer ──────────────────────────────────────────────────────────
  const drawNode = useCallback((raw: NodeObject, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const n = raw as RawNode & { x: number; y: number }
    const x = n.x, y = n.y
    if (!isFinite(x) || !isFinite(y)) return

    const r     = NODE_RADIUS[n.type]
    const color = n.type === "SOURCE" && n.meta.color ? n.meta.color : nodeColor(n)

    // ── Dim / highlight ────────────────────────────────────────────────────
    const isDimmed      = dimmedIds?.has(n.id) ?? false
    const isHighlighted = highlightedIds?.has(n.id) ?? false
    const prevAlpha     = ctx.globalAlpha
    if (isDimmed) ctx.globalAlpha = prevAlpha * 0.13

    // ── SOURCE : hexagone distinctif ───────────────────────────────────────
    if (n.type === "SOURCE") {
      // Halo externe
      const haloS = ctx.createRadialGradient(x, y, r * 0.6, x, y, r * 2.4)
      haloS.addColorStop(0, color + "55"); haloS.addColorStop(1, color + "00")
      ctx.beginPath(); ctx.arc(x, y, r * 2.4, 0, 2 * Math.PI)
      ctx.fillStyle = haloS; ctx.fill()

      // Hexagone
      const sides = 6
      ctx.beginPath()
      for (let i = 0; i < sides; i++) {
        const angle = (Math.PI / 180) * (60 * i - 30)
        const px = x + r * Math.cos(angle), py = y + r * Math.sin(angle)
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py)
      }
      ctx.closePath(); ctx.fillStyle = color; ctx.fill()

      // Highlight interne
      const hiS = ctx.createRadialGradient(x - r * 0.35, y - r * 0.35, 0, x, y, r)
      hiS.addColorStop(0, "rgba(255,255,255,0.35)"); hiS.addColorStop(1, "rgba(255,255,255,0.00)")
      ctx.beginPath()
      for (let i = 0; i < sides; i++) {
        const angle = (Math.PI / 180) * (60 * i - 30)
        const px = x + r * Math.cos(angle), py = y + r * Math.sin(angle)
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py)
      }
      ctx.closePath(); ctx.fillStyle = hiS; ctx.fill()

      // Icône ★ au centre
      drawNodeIcon(ctx, "SOURCE", x, y, r)

      // Bordure
      ctx.strokeStyle = "rgba(255,255,255,0.25)"; ctx.lineWidth = 1.5
      ctx.beginPath()
      for (let i = 0; i < sides; i++) {
        const angle = (Math.PI / 180) * (60 * i - 30)
        const px = x + r * Math.cos(angle), py = y + r * Math.sin(angle)
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py)
      }
      ctx.closePath(); ctx.stroke()

      // Anneau collapse tiretté
      if (collapsedIds.has(n.id)) {
        ctx.beginPath(); ctx.arc(x, y, r + 4, 0, 2 * Math.PI)
        ctx.setLineDash([4, 3]); ctx.strokeStyle = "rgba(251,146,60,0.80)"; ctx.lineWidth = 1.8
        ctx.stroke(); ctx.setLineDash([])
      }

      // Anneau de mise en valeur (recherche)
      if (isHighlighted) {
        ctx.beginPath(); ctx.arc(x, y, r + 6, 0, 2 * Math.PI)
        ctx.strokeStyle = "rgba(255,255,255,0.75)"; ctx.lineWidth = 2.0; ctx.stroke()
      }

      // Label — plafonné à r×0.68 pour rester visuellement dans le nœud
      const rawFsz  = 15 / globalScale
      const fsz     = Math.max(7, Math.min(r * 0.68, rawFsz))
      const shadowC = isDark ? "rgba(0,0,0,0.95)" : "rgba(255,255,255,0.85)"

      if (fsz * globalScale >= 5) {
        const text   = n.label.length > 22 ? n.label.slice(0, 21) + "…" : n.label
        const labelC = isDark ? "#fde68a" : "#92400e"
        ctx.font = `700 ${fsz}px -apple-system, "Inter", sans-serif`
        ctx.textAlign = "center"; ctx.textBaseline = "top"
        ctx.shadowColor = shadowC; ctx.shadowBlur = 6
        ctx.fillStyle = labelC; ctx.fillText(text, x, y + r + 4)
        ctx.shadowBlur = 0; ctx.fillStyle = labelC; ctx.fillText(text, x, y + r + 4)

        // Bucket badge — seulement si assez de place
        if (n.meta.subtitle && fsz * globalScale >= 7) {
          const rawBsz = 9 / globalScale
          const bsz    = Math.max(4.5, Math.min(r * 0.42, rawBsz))
          ctx.font = `500 ${bsz}px -apple-system, "Inter", sans-serif`
          const badgeC = isDark ? "rgba(248,250,252,0.60)" : "rgba(15,23,42,0.50)"
          ctx.shadowColor = shadowC; ctx.shadowBlur = 4
          ctx.fillStyle = badgeC; ctx.fillText(n.meta.subtitle, x, y + r + 4 + fsz + 2)
          ctx.shadowBlur = 0; ctx.fillStyle = badgeC; ctx.fillText(n.meta.subtitle, x, y + r + 4 + fsz + 2)
        }
      }

      ctx.globalAlpha = prevAlpha
      return
    }

    // ── Outer glow (company only) ──────────────────────────────────────────
    if (n.type === "COMPANY") {
      const grad = ctx.createRadialGradient(x, y, r * 0.6, x, y, r * 2.2)
      grad.addColorStop(0, color + "55"); grad.addColorStop(1, color + "00")
      ctx.beginPath(); ctx.arc(x, y, r * 2.2, 0, 2 * Math.PI)
      ctx.fillStyle = grad; ctx.fill()
    }

    // ── Soft halo (tous les nœuds) ─────────────────────────────────────────
    const halo = ctx.createRadialGradient(x, y, r * 0.5, x, y, r * 1.6)
    halo.addColorStop(0, color + "44"); halo.addColorStop(1, color + "00")
    ctx.beginPath(); ctx.arc(x, y, r * 1.6, 0, 2 * Math.PI)
    ctx.fillStyle = halo; ctx.fill()

    // ── Cercle principal ───────────────────────────────────────────────────
    ctx.beginPath(); ctx.arc(x, y, r, 0, 2 * Math.PI)
    ctx.fillStyle = color; ctx.fill()

    // ── Highlight interne (effet 3D) ───────────────────────────────────────
    const hi = ctx.createRadialGradient(x - r * 0.35, y - r * 0.35, 0, x, y, r)
    hi.addColorStop(0, "rgba(255,255,255,0.35)"); hi.addColorStop(1, "rgba(255,255,255,0.00)")
    ctx.beginPath(); ctx.arc(x, y, r, 0, 2 * Math.PI)
    ctx.fillStyle = hi; ctx.fill()

    // ── Icône au centre ────────────────────────────────────────────────────
    drawNodeIcon(ctx, n.type, x, y, r)

    // ── Bordure ────────────────────────────────────────────────────────────
    ctx.beginPath(); ctx.arc(x, y, r, 0, 2 * Math.PI)
    ctx.strokeStyle = "rgba(255,255,255,0.18)"; ctx.lineWidth = 1; ctx.stroke()

    // ── Coche verte : nœud "terminé" ──────────────────────────────────────
    const isDone = (n.type === "PROJECT" && n.status === "COMPLETED") ||
                   (n.type === "INVOICE"  && n.status === "PAID")      ||
                   (n.type === "REVENUE"  && n.status === "RECEIVED")
    if (isDone) {
      const bx = x + r * 0.70, by = y - r * 0.70
      ctx.beginPath(); ctx.arc(bx, by, 5, 0, 2 * Math.PI)
      ctx.fillStyle = "#22c55e"; ctx.fill()
      ctx.strokeStyle = "rgba(0,0,0,0.30)"; ctx.lineWidth = 0.8; ctx.stroke()
      // Checkmark
      ctx.beginPath()
      ctx.strokeStyle = "#fff"; ctx.lineWidth = 1.4
      ctx.lineCap = "round"; ctx.lineJoin = "round"
      ctx.moveTo(bx - 2.3, by + 0.1)
      ctx.lineTo(bx - 0.3, by + 2.2)
      ctx.lineTo(bx + 2.7, by - 1.9)
      ctx.stroke()
    }

    // ── Anneau collapse tiretté ────────────────────────────────────────────
    if (collapsedIds.has(n.id)) {
      ctx.beginPath(); ctx.arc(x, y, r + 3.5, 0, 2 * Math.PI)
      ctx.setLineDash([3.5, 3]); ctx.strokeStyle = "rgba(251,146,60,0.78)"; ctx.lineWidth = 1.5
      ctx.stroke(); ctx.setLineDash([])
    }

    // ── Anneau de mise en valeur (recherche) ───────────────────────────────
    if (isHighlighted) {
      ctx.beginPath(); ctx.arc(x, y, r + 5, 0, 2 * Math.PI)
      ctx.strokeStyle = "rgba(255,255,255,0.78)"; ctx.lineWidth = 1.8; ctx.stroke()
    }

    // ── Label — taille plafonnée à r×0.72 pour rester proportionnel au nœud ──
    const isCompany   = n.type === "COMPANY"
    const rawFont     = (isCompany ? 14 : 11) / globalScale
    const fontSize    = Math.max(isCompany ? 6 : 4.5, Math.min(r * 0.72, rawFont))
    const screenFont  = fontSize * globalScale  // taille réelle en pixels écran

    // Masquer le label quand le nœud est trop petit à l'écran
    // (COMPANY garde son label plus longtemps — il est le repère principal)
    const minScreen = isCompany ? 4.5 : 6
    if (screenFont >= minScreen) {
      const maxChars   = isCompany ? 26 : 20
      const text       = n.label.length > maxChars ? n.label.slice(0, maxChars - 1) + "…" : n.label
      const fontWeight = isCompany ? "700" : "500"
      const ty         = y + r + 4

      const labelColor  = isDark ? (isCompany ? "#fde68a" : "rgba(248,250,252,0.92)") : (isCompany ? "#92400e" : "rgba(15,23,42,0.88)")
      const shadowColor = isDark ? "rgba(0,0,0,0.95)" : "rgba(255,255,255,0.85)"

      ctx.font = `${fontWeight} ${fontSize}px -apple-system, "Inter", sans-serif`
      ctx.textAlign = "center"; ctx.textBaseline = "top"
      ctx.shadowColor = shadowColor; ctx.shadowBlur = 5
      ctx.fillStyle = labelColor; ctx.fillText(text, x, ty)
      ctx.shadowBlur = 0
      ctx.fillStyle = labelColor; ctx.fillText(text, x, ty)

      // ── Montant — seulement quand assez zoomé (screenFont ≥ 7px) ─────────
      if (n.amount !== undefined && screenFont >= 7 && (n.type === "INVOICE" || n.type === "QUOTE" || n.type === "REVENUE")) {
        const rawAmt      = 9 / globalScale
        const amtFontSize = Math.max(3.5, Math.min(r * 0.55, rawAmt))
        const amtText     = fmtAmount(n.amount)
        ctx.font = `600 ${amtFontSize}px -apple-system, "Inter", sans-serif`
        ctx.textAlign = "center"; ctx.textBaseline = "top"
        const amtColor = isDark ? "rgba(248,250,252,0.65)" : "rgba(15,23,42,0.55)"
        const amtY     = ty + fontSize + 2
        ctx.shadowColor = shadowColor; ctx.shadowBlur = 4
        ctx.fillStyle = amtColor; ctx.fillText(amtText, x, amtY)
        ctx.shadowBlur = 0; ctx.fillStyle = amtColor; ctx.fillText(amtText, x, amtY)
      }
    }

    ctx.globalAlpha = prevAlpha
  }, [collapsedIds, isDark, highlightedIds, dimmedIds])

  // Nœuds triés par profondeur croissante → COMPANY/SOURCE rendu en dernier
  const sortedNodes = useMemo(
    () => [...nodes].sort((a, b) => TYPE_Z[a.type] - TYPE_Z[b.type]),
    [nodes]
  )

  // Index id → type pour résoudre la couleur des liens sans dépendre de D3
  const nodeTypeMap = useMemo(
    () => new Map(nodes.map(n => [n.id, n.type])),
    [nodes]
  )

  // ── Couleur des liens basée sur le type du nœud source ───────────────────
  const getLinkColor = useCallback((link: object) => {
    const l = link as { source: RawNode | string }
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
      nodePointerAreaPaint={paintPointerArea}
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
      d3VelocityDecay={0.45}
      d3AlphaDecay={0.025}
    />
  )
})
