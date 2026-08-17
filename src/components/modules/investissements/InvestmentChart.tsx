"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { cn } from "@/lib/utils"
import { fmtEur, RANGES, capitalAt, type RangeKey } from "@/lib/investments"

type ChartPlatform = { id: string; name: string; color: string; entries: { date: string; capital: number | null; contribution: number }[] }
type Pt = { t: number; v: number }
type Flow = { t: number; amount: number }

const H = 360
const PAD = { left: 56, right: 16, top: 12, bottom: 30 }

/** Valeur de la courbe au temps t, consciente des dépôts (cf. capitalAt) ; null hors plage. */
function valueAt(pts: Pt[], flows: Flow[], t: number): number | null {
  return capitalAt(pts.map((p) => ({ t: p.t, capital: p.v })), flows, t)
}

/**
 * Construit la polyligne d'affichage : la croissance est répartie sur le temps entre
 * deux relevés, et chaque dépôt (flux) apparaît comme une MARCHE VERTICALE à sa date
 * — pas une pente linéaire (qui laisserait croire à une progression du capital).
 */
function buildStepped(valPoints: Pt[], flows: Flow[]): Pt[] {
  if (valPoints.length === 0) return []
  const out: Pt[] = [valPoints[0]]
  for (let i = 1; i < valPoints.length; i++) {
    const a = valPoints[i - 1], b = valPoints[i]
    const fl = flows.filter((f) => f.t > a.t && f.t <= b.t).sort((x, y) => x.t - y.t)
    const F = fl.reduce((s, f) => s + f.amount, 0)
    const growth = b.v - a.v - F
    let run = 0
    for (const f of fl) {
      const frac = b.t === a.t ? 0 : (f.t - a.t) / (b.t - a.t)
      const preCap = a.v + growth * frac + run
      out.push({ t: f.t, v: preCap })          // fin de la croissance avant le dépôt
      out.push({ t: f.t, v: preCap + f.amount }) // marche verticale du dépôt
      run += f.amount
    }
    out.push(b)
  }
  return out
}

/** Graduations « rondes » (1/2/5 × 10ⁿ) entre min et max, ~5 lignes. */
function niceTicks(min: number, max: number, target = 5): number[] {
  const span = Math.max(1, max - min)
  const raw = span / target
  const mag = Math.pow(10, Math.floor(Math.log10(raw)))
  const norm = raw / mag
  const step = (norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10) * mag
  const ticks: number[] = []
  for (let v = Math.ceil(min / step) * step; v <= max + 1e-6; v += step) ticks.push(v)
  return ticks
}

/** Montant compact pour l'axe Y : « 5 k », « 1 k », sinon la valeur brute. */
function fmtK(v: number): string {
  if (v >= 1000) return `${(v / 1000).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} k`
  return v.toLocaleString("fr-FR")
}

const fmtDateTick = (t: number) => new Date(t).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" })

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
      .map((p) => {
        const all = p.entries.map((e) => ({ t: new Date(e.date).getTime(), capital: e.capital, contribution: e.contribution }))
        const pts: Pt[] = all.filter((e) => e.capital != null).map((e) => ({ t: e.t, v: e.capital as number })).sort((a, b) => a.t - b.t)
        const flows: Flow[] = all.filter((e) => e.contribution !== 0).map((e) => ({ t: e.t, amount: e.contribution })).sort((a, b) => a.t - b.t)
        return { id: p.id, name: p.name, color: p.color, pts, flows }
      })
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

    // Points étagés (espace données) par série : dépôts = marches verticales. Sert
    // À LA FOIS au domaine Y (sommets de marches compris) et au tracé, pour qu'une
    // courbe ne sorte jamais du cadre (bug si gros dépôt dans un intervalle en perte).
    const stepped = series.map((s) => {
      const inRange = s.pts.filter((p) => p.t >= left && p.t <= right)
      const valPoints: Pt[] = []
      const vl = valueAt(s.pts, s.flows, left)
      if (vl !== null && (inRange.length === 0 || inRange[0].t > left)) valPoints.push({ t: left, v: vl })
      valPoints.push(...inRange)
      return { id: s.id, name: s.name, color: s.color, seg: buildStepped(valPoints, s.flows), inRange }
    })

    const yValues = stepped.flatMap((s) => s.seg.map((p) => p.v))
    if (yValues.length === 0) return { left, right, span, empty: true as const }
    let yMin = Math.min(...yValues)
    let yMax = Math.max(...yValues)
    const pad = (yMax - yMin) * 0.12 || Math.max(1, yMax * 0.1)
    yMin = Math.max(0, yMin - pad)
    yMax = yMax + pad

    const plotW = width - PAD.left - PAD.right
    const plotH = H - PAD.top - PAD.bottom
    const xOf = (t: number) => PAD.left + ((t - left) / span) * plotW
    const yOf = (v: number) => PAD.top + (1 - (v - yMin) / (yMax - yMin || 1)) * plotH

    const lines = stepped.map((s) => ({
      id: s.id, name: s.name, color: s.color,
      d: s.seg.map((p, i) => `${i === 0 ? "M" : "L"} ${xOf(p.t).toFixed(1)} ${yOf(p.v).toFixed(1)}`).join(" "),
      dots: s.inRange.map((p) => ({ x: xOf(p.t), y: yOf(p.v) })),
    }))

    // Graduations Y sur des nombres ronds (1/2/5 k…) ; graduations X = dates réelles
    // où j'ai saisi des données (relevés ET dépôts).
    const yTicks = niceTicks(yMin, yMax, 5)
    const dateTicks = [...new Set(series.flatMap((s) => [...s.pts.map((p) => p.t), ...s.flows.map((f) => f.t)].filter((t) => t >= left && t <= right)))].sort((a, b) => a - b)
    // Sous-ensemble de dates à étiqueter (évite le chevauchement des libellés)
    const dateLabels: number[] = []
    let lastLabelX = -Infinity
    for (const t of dateTicks) {
      const x = xOf(t)
      if (x - lastLabelX >= 46) { dateLabels.push(t); lastLabelX = x }
    }

    return { left, right, span, yMin, yMax, plotW, plotH, xOf, yOf, lines, yTicks, dateTicks, dateLabels, empty: false as const }
  }, [width, hasData, series, range, now])

  // Survol : temps sous le curseur + valeurs interpolées par plateforme
  const hover = useMemo(() => {
    if (!geo || geo.empty || hoverX === null) return null
    const t = geo.left + ((hoverX - PAD.left) / geo.plotW) * geo.span
    if (t < geo.left || t > geo.right) return null
    const rows = series
      .map((s) => ({ name: s.name, color: s.color, v: valueAt(s.pts, s.flows, t), y: 0 }))
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
                  {/* Grille Y : lignes horizontales fines sur des nombres ronds (1/2/5 k…) */}
                  {geo.yTicks.map((v, i) => (
                    <g key={i}>
                      <line x1={PAD.left} y1={geo.yOf(v)} x2={width - PAD.right} y2={geo.yOf(v)} className="stroke-current text-border/50" strokeWidth={0.5} />
                      <text x={PAD.left - 6} y={geo.yOf(v)} dy="0.32em" textAnchor="end" className="fill-current text-muted-foreground text-[10px] tabular-nums amount-sensitive">
                        {fmtK(v)}
                      </text>
                    </g>
                  ))}
                  {/* Repères verticaux aux dates de relevés (où j'ai saisi des données) */}
                  {geo.dateTicks.map((t, i) => (
                    <line key={i} x1={geo.xOf(t)} y1={PAD.top} x2={geo.xOf(t)} y2={H - PAD.bottom} className="stroke-current text-border/35" strokeWidth={0.5} />
                  ))}
                  {/* Labels de dates espacés */}
                  {geo.dateLabels.map((t, i) => {
                    const x = geo.xOf(t)
                    const anchor = x < PAD.left + 16 ? "start" : x > width - PAD.right - 16 ? "end" : "middle"
                    return (
                      <text key={i} x={x} y={H - 9} textAnchor={anchor} className="fill-current text-muted-foreground text-[10px] tabular-nums">
                        {fmtDateTick(t)}
                      </text>
                    )
                  })}
                  {/* Courbes */}
                  {geo.lines.map((l) => (
                    <g key={l.id}>
                      {l.d && <path d={l.d} fill="none" stroke={l.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />}
                      {l.dots.map((dt, i) => <circle key={i} cx={dt.x} cy={dt.y} r={3} fill={l.color} />)}
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
