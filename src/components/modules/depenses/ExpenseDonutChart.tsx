"use client"

import { useState } from "react"

export type DonutSegment = { id: string; label: string; value: number; color: string }

/**
 * Camembert en SVG pur (stroke-dasharray/-dashoffset) — pas de dépendance de
 * charting externe, comme le reste du codebase (cf. MonthlyRevenueChart.tsx).
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
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius

  const { arcs } = segments
    .filter((s) => s.value > 0)
    .reduce<{ arcs: (DonutSegment & { fraction: number; dasharray: string; dashoffset: number })[]; offset: number }>(
      (state, seg) => {
        const fraction = total > 0 ? seg.value / total : 0
        const dash = fraction * circumference
        const arc = { ...seg, fraction, dasharray: `${dash} ${circumference - dash}`, dashoffset: -state.offset }
        return { arcs: [...state.arcs, arc], offset: state.offset + dash }
      },
      { arcs: [], offset: 0 }
    )

  const hoveredArc = arcs.find((a) => a.id === hovered)

  if (total === 0) {
    return (
      <div className="flex items-center justify-center text-center px-4" style={{ width: size, height: size }}>
        <p className="text-xs text-muted-foreground">Aucune dépense sur la période</p>
      </div>
    )
  }

  return (
    <div className="relative inline-flex items-center justify-center shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke="currentColor" strokeWidth={strokeWidth}
          className="text-muted/25"
        />
        {arcs.map((arc) => (
          <circle
            key={arc.id}
            cx={size / 2} cy={size / 2} r={radius}
            fill="none"
            stroke={arc.color}
            strokeWidth={strokeWidth}
            strokeDasharray={arc.dasharray}
            strokeDashoffset={arc.dashoffset}
            strokeLinecap="butt"
            className="transition-opacity cursor-pointer"
            style={{ opacity: hovered && hovered !== arc.id ? 0.35 : 1 }}
            onMouseEnter={() => setHovered(arc.id)}
            onMouseLeave={() => setHovered(null)}
          />
        ))}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none px-2 text-center">
        {hoveredArc ? (
          <>
            <p className="text-xs text-muted-foreground truncate max-w-full">{hoveredArc.label}</p>
            <p className="text-lg font-bold tabular-nums" style={{ color: hoveredArc.color }}>
              {hoveredArc.value.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} €
            </p>
            <p className="text-[10px] text-muted-foreground">{Math.round(hoveredArc.fraction * 100)}%</p>
          </>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">Total</p>
            <p className="text-lg font-bold tabular-nums">
              {total.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} €
            </p>
          </>
        )}
      </div>
    </div>
  )
}
