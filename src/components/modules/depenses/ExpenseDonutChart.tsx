"use client"

import { useState } from "react"

export type DonutSegment = { id: string; label: string; value: number; color: string }

/**
 * Anneau de répartition en SVG pur — pas de dépendance de charting externe, comme le
 * reste du codebase (cf. MonthlyRevenueChart.tsx).
 *
 * Chaque part est un VRAI secteur annulaire (<path> : arc extérieur + arc intérieur), et
 * non un tiret de `stroke-dasharray` sur un cercle : pour une part plus courte que
 * l'épaisseur du trait (ex. 3 % sur 26 px), WebKit/Safari approxime le tiret par un
 * quadrilatère (tangente au milieu) qui déborde de l'anneau et mord dans le trou —
 * le « drapeau » vu sur la part Transport. Le secteur exact règle ça partout, et permet
 * un survol qui grossit vers l'extérieur seulement (rayon intérieur constant).
 */
export function ExpenseDonutChart({
  segments,
  size = 180,
  strokeWidth = 26,
}: {
  segments: DonutSegment[]
  size?: number
  strokeWidth?: number
}) {
  const [hovered, setHovered] = useState<string | null>(null)
  const total = segments.reduce((s, seg) => s + seg.value, 0)

  const HOVER_GROW = 3                          // marge extérieure réservée à la part survolée
  const cx = size / 2, cy = size / 2
  const rOut = size / 2 - HOVER_GROW
  const rIn  = rOut - strokeWidth

  const { arcs } = segments
    .filter((s) => s.value > 0)
    .reduce<{ arcs: (DonutSegment & { fraction: number; a0: number; a1: number })[]; angle: number }>(
      (state, seg) => {
        const fraction = total > 0 ? seg.value / total : 0
        const a0 = state.angle, a1 = a0 + fraction * 2 * Math.PI
        return { arcs: [...state.arcs, { ...seg, fraction, a0, a1 }], angle: a1 }
      },
      { arcs: [], angle: -Math.PI / 2 }        // départ à 12 h, sens horaire
    )

  const hoveredArc = arcs.find((a) => a.id === hovered)

  if (total === 0) {
    return (
      <div className="flex items-center justify-center text-center px-4" style={{ width: size, height: size }}>
        <p className="text-xs text-muted-foreground">Aucune dépense sur la période</p>
      </div>
    )
  }

  // Secteur annulaire exact entre a0 et a1 (radians), rayons rIn/rOut.
  const pt = (r: number, a: number) => `${(cx + r * Math.cos(a)).toFixed(3)} ${(cy + r * Math.sin(a)).toFixed(3)}`
  const sectorPath = (a0: number, a1: number, ro: number) => {
    const large = a1 - a0 > Math.PI ? 1 : 0
    return `M ${pt(ro, a0)} A ${ro} ${ro} 0 ${large} 1 ${pt(ro, a1)} L ${pt(rIn, a1)} A ${rIn} ${rIn} 0 ${large} 0 ${pt(rIn, a0)} Z`
  }

  const chartLabel =
    `Répartition des dépenses par catégorie, total ${total.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} € : ` +
    arcs
      .map((a) => `${a.label} ${a.value.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} € (${Math.round(a.fraction * 100)} %)`)
      .join(", ")

  return (
    <div className="relative inline-flex items-center justify-center shrink-0" style={{ width: size, height: size }}>
      <svg role="img" aria-label={chartLabel} width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Fond de l'anneau */}
        <circle cx={cx} cy={cy} r={(rIn + rOut) / 2} fill="none" stroke="currentColor" strokeWidth={strokeWidth} className="text-muted/25" />
        {arcs.map((arc) => {
          const isHovered = hovered === arc.id
          const ro = isHovered ? rOut + HOVER_GROW : rOut
          // Une part à 100 % ne peut pas être un seul arc SVG (début = fin) → anneau plein.
          const full = arc.fraction >= 0.9999
          const common = {
            className: "transition-opacity cursor-pointer",
            style: { opacity: hovered && !isHovered ? 0.35 : 1 },
            onMouseEnter: () => setHovered(arc.id),
            onMouseLeave: () => setHovered(null),
          }
          return full
            ? <circle key={arc.id} cx={cx} cy={cy} r={(rIn + ro) / 2} fill="none" stroke={arc.color} strokeWidth={ro - rIn} {...common} />
            : <path key={arc.id} d={sectorPath(arc.a0, arc.a1, ro)} fill={arc.color} {...common} />
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none px-2 text-center">
        {hoveredArc ? (
          <>
            <p className="text-xs text-muted-foreground truncate max-w-full">{hoveredArc.label}</p>
            <p className="text-lg font-bold tabular-nums amount-sensitive" style={{ color: hoveredArc.color }}>
              {hoveredArc.value.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} €
            </p>
            <p className="text-[10px] text-muted-foreground">{Math.round(hoveredArc.fraction * 100)}%</p>
          </>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">Total</p>
            <p className="text-lg font-bold tabular-nums amount-sensitive">
              {total.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} €
            </p>
          </>
        )}
      </div>
    </div>
  )
}
