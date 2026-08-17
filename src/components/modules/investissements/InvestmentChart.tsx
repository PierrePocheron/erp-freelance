"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { cn } from "@/lib/utils"
import { fmtEur, RANGES, type RangeKey } from "@/lib/investments"

type ChartPlatform = { id: string; name: string; color: string; entries: { date: string; capital: number }[] }
type Pt = { t: number; v: number }

const H = 300
const PAD = { left: 54, right: 14, top: 12, bottom: 26 }

/** Valeur interpolée (linéaire) d'une série au temps t ; null si hors de sa plage. */
function valueAt(pts: Pt[], t: number): number | null {
  if (pts.length === 0 || t < pts[0].t || t > pts[pts.length - 1].t) return null
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1]
    if (t >= a.t && t <= b.t) return b.t === a.t ? b.v : a.v + ((t - a.t) / (b.t - a.t)) * (b.v - a.v)
  }
  return pts[pts.length - 1].v
}

export function InvestmentChart({ platforms, range, onRangeChange }: { platforms: ChartPlatform[]; range: RangeKey; onRangeChange: (r: RangeKey) => void }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  const [hoverX, setHoverX] = useState<number | null>(null)
  // « Maintenant » calculé après montage (impur en render — cf. React Compiler) ;
  // 0 avant montage → la borne droite retombe sur le dernier relevé, sans mismatch SSR.
  const [now, setNow] = useState(0)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNow(Date.now())
    if (!containerRef.current) return
    const ro = new ResizeObserver((entries) => setWidth(entries[0].contentRect.width))
    ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [])

  const series = useMemo(
    () => platforms
      .map((p) => ({
        ...p,
        pts: p.entries
          .map((e) => ({ t: new Date(e.date).getTime(), v: e.capital }))
          .sort((a, b) => a.t - b.t),
      }))
      .filter((p) => p.pts.length > 0),
    [platforms],
  )

  const hasData = series.length > 0

  const geo = useMemo(() => {
    if (width <= 0 || !hasData) return null
    const allT = series.flatMap((s) => s.pts.map((p) => p.t))
    const minT = Math.min(...allT)
    const maxT = Math.max(...allT, now)
    const rangeDays = RANGES.find((r) => r.key === range)!.days
    const right = maxT
    const left = rangeDays === null ? minT : Math.max(minT, right - rangeDays * 86_400_000)
    const span = Math.max(1, right - left)

    // Domaine Y sur les points visibles (+ interpolation aux bornes)
    const vals: number[] = []
    for (const s of series) {
      for (const p of s.pts) if (p.t >= left && p.t <= right) vals.push(p.v)
      const vl = valueAt(s.pts, left)
      if (vl !== null) vals.push(vl)
    }
    if (vals.length === 0) return { left, right, span, empty: true as const }
    let yMin = Math.min(...vals)
    let yMax = Math.max(...vals)
    const pad = (yMax - yMin) * 0.12 || Math.max(1, yMax * 0.1)
    yMin = Math.max(0, yMin - pad)
    yMax = yMax + pad

    const plotW = width - PAD.left - PAD.right
    const plotH = H - PAD.top - PAD.bottom
    const xOf = (t: number) => PAD.left + ((t - left) / span) * plotW
    const yOf = (v: number) => PAD.top + (1 - (v - yMin) / (yMax - yMin || 1)) * plotH

    const lines = series.map((s) => {
      const inRange = s.pts.filter((p) => p.t >= left && p.t <= right)
      const seg: Pt[] = []
      const vl = valueAt(s.pts, left)
      if (vl !== null && (inRange.length === 0 || inRange[0].t > left)) seg.push({ t: left, v: vl })
      seg.push(...inRange)
      const d = seg.map((p, i) => `${i === 0 ? "M" : "L"} ${xOf(p.t).toFixed(1)} ${yOf(p.v).toFixed(1)}`).join(" ")
      const dots = inRange.map((p) => ({ x: xOf(p.t), y: yOf(p.v) }))
      return { id: s.id, name: s.name, color: s.color, d, dots }
    })

    // Ticks
    const yTicks = Array.from({ length: 4 }, (_, i) => yMin + ((yMax - yMin) * i) / 3)
    const xTicks = Array.from({ length: 5 }, (_, i) => left + (span * i) / 4)

    return { left, right, span, yMin, yMax, plotW, plotH, xOf, yOf, lines, yTicks, xTicks, empty: false as const }
  }, [width, hasData, series, range, now])

  // Survol : temps sous le curseur + valeurs interpolées par plateforme
  const hover = useMemo(() => {
    if (!geo || geo.empty || hoverX === null) return null
    const t = geo.left + ((hoverX - PAD.left) / geo.plotW) * geo.span
    if (t < geo.left || t > geo.right) return null
    const rows = series
      .map((s) => ({ name: s.name, color: s.color, v: valueAt(s.pts, t), y: 0 }))
      .filter((r): r is { name: string; color: string; v: number; y: number } => r.v !== null)
      .map((r) => ({ ...r, y: geo.yOf(r.v) }))
    if (rows.length === 0) return null
    return { t, x: geo.xOf(t), rows }
  }, [geo, hoverX, series])

  function onMove(e: React.MouseEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    setHoverX(e.clientX - rect.left)
  }

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-end gap-1">
        {RANGES.map((r) => (
          <button
            key={r.key}
            onClick={() => onRangeChange(r.key)}
            className={cn(
              "rounded-md px-2 py-1 text-xs font-medium transition-colors",
              range === r.key ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
            )}
          >
            {r.label}
          </button>
        ))}
      </div>

      <div ref={containerRef} className="relative w-full">
        {!hasData ? (
          <div className="flex h-[220px] items-center justify-center text-sm text-muted-foreground">
            Aucun relevé pour l&apos;instant — ajoute du capital sur une plateforme.
          </div>
        ) : (
          <>
            <svg
              width={width || 300}
              height={H}
              onMouseMove={onMove}
              onMouseLeave={() => setHoverX(null)}
              className="block"
              role="img"
              aria-label="Évolution du capital par plateforme"
            >
              {geo && !geo.empty && (
                <>
                  {/* Grille Y + labels */}
                  {geo.yTicks.map((v, i) => (
                    <g key={i}>
                      <line x1={PAD.left} y1={geo.yOf(v)} x2={width - PAD.right} y2={geo.yOf(v)} className="stroke-current text-border/60" strokeDasharray="3 3" />
                      <text x={PAD.left - 6} y={geo.yOf(v)} dy="0.32em" textAnchor="end" className="fill-current text-muted-foreground text-[10px] tabular-nums amount-sensitive">
                        {Math.round(v).toLocaleString("fr-FR")}
                      </text>
                    </g>
                  ))}
                  {/* Labels X */}
                  {geo.xTicks.map((t, i) => (
                    <text key={i} x={geo.xOf(t)} y={H - 8} textAnchor={i === 0 ? "start" : i === geo.xTicks.length - 1 ? "end" : "middle"} className="fill-current text-muted-foreground text-[10px]">
                      {new Date(t).toLocaleDateString("fr-FR", { month: "short", year: "2-digit" })}
                    </text>
                  ))}
                  {/* Courbes */}
                  {geo.lines.map((l) => (
                    <g key={l.id}>
                      {l.d && <path d={l.d} fill="none" stroke={l.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />}
                      {l.dots.map((dt, i) => <circle key={i} cx={dt.x} cy={dt.y} r={2.5} fill={l.color} />)}
                    </g>
                  ))}
                  {/* Crosshair + points au survol */}
                  {hover && (
                    <>
                      <line x1={hover.x} y1={PAD.top} x2={hover.x} y2={H - PAD.bottom} className="stroke-current text-foreground/30" />
                      {hover.rows.map((r, i) => <circle key={i} cx={hover.x} cy={r.y} r={3.5} fill={r.color} strokeWidth={1.5} className="stroke-current text-background" />)}
                    </>
                  )}
                </>
              )}
            </svg>

            {/* Tooltip */}
            {hover && (
              <div
                className="pointer-events-none absolute z-10 rounded-lg border border-border bg-card/95 p-2 shadow-lg backdrop-blur"
                style={{
                  left: Math.min(Math.max(hover.x + 12, 8), (width || 300) - 160),
                  top: PAD.top,
                }}
              >
                <p className="mb-1 text-[10px] font-medium text-muted-foreground">
                  {new Date(hover.t).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}
                </p>
                <div className="space-y-0.5">
                  {hover.rows.map((r, i) => (
                    <div key={i} className="flex items-center gap-1.5 text-xs">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: r.color }} />
                      <span className="truncate">{r.name}</span>
                      <span className="ml-auto font-semibold tabular-nums amount-sensitive">{fmtEur(r.v)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Légende */}
      {hasData && (
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
          {series.map((s) => (
            <span key={s.id} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} /> {s.name}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
