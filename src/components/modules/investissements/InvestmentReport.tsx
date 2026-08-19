"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ChevronLeft, Download, Printer } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  computeMonthlySeries, computeAnnualSeries, platformValueAt, metaForType, fmtEur2, fmtPctSigned,
} from "@/lib/investments"
import type { PlatformData } from "./InvestmentsView"

function pad(n: number) { return String(n).padStart(2, "0") }
function toInputDate(d: Date) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` }
const fr2 = (n: number) => n.toFixed(2).replace(".", ",")

/** Stats d'une plateforme sur une fenêtre [fromMs, toMs] arbitraire (conscient des dépôts). */
function periodStat(entries: PlatformData["entries"], fromMs: number, toMs: number) {
  const lite = entries.map((e) => ({ date: e.date, capital: e.capital, contribution: e.contribution }))
  const start = platformValueAt(lite, fromMs - 1)
  const end = platformValueAt(lite, toMs)
  let deposits = 0, withdrawals = 0
  for (const e of entries) {
    const t = new Date(e.date).getTime()
    if (t > fromMs - 1 && t <= toMs) {
      if (e.contribution > 0) deposits += e.contribution
      else withdrawals += e.contribution
    }
  }
  const contrib = deposits + withdrawals
  const gain = end - start - contrib
  const perf = start > 0 ? gain / start : contrib > 0 ? gain / contrib : 0
  return { start, end, deposits, withdrawals, contrib, gain, perf }
}

export function InvestmentReport({ platforms, userName }: { platforms: PlatformData[]; userName: string }) {
  const [nowMs, setNowMs] = useState(0)
  const [selected, setSelected] = useState<Set<string>>(() => new Set(platforms.map((p) => p.id)))
  const [fromStr, setFromStr] = useState("")
  const [toStr, setToStr] = useState("")

  useEffect(() => {
    const now = new Date()
    /* eslint-disable react-hooks/set-state-in-effect */
    setNowMs(now.getTime())
    setFromStr(`${now.getFullYear()}-01-01`) // année en cours par défaut
    setToStr(toInputDate(now))
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [])

  const earliest = useMemo(() => {
    let min = Infinity
    for (const p of platforms) for (const e of p.entries) min = Math.min(min, new Date(e.date).getTime())
    return Number.isFinite(min) ? min : nowMs
  }, [platforms, nowMs])

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }
  const allOn = selected.size === platforms.length

  const fromMs = fromStr ? new Date(`${fromStr}T00:00:00`).getTime() : 0
  const toMs = toStr ? new Date(`${toStr}T23:59:59`).getTime() : nowMs

  const chosen = platforms.filter((p) => selected.has(p.id))

  const chosenLite = useMemo(
    () => chosen.map((p) => ({ entries: p.entries.map((e) => ({ date: e.date, capital: e.capital, contribution: e.contribution })) })),
    [chosen],
  )
  const monthly = useMemo(() => computeMonthlySeries(chosenLite, fromMs, toMs), [chosenLite, fromMs, toMs])
  const annual = useMemo(() => computeAnnualSeries(chosenLite, fromMs, toMs), [chosenLite, fromMs, toMs])

  const perPlatform = useMemo(() => chosen.map((p) => ({ p, s: periodStat(p.entries, fromMs, toMs) })), [chosen, fromMs, toMs])

  const totals = useMemo(() => {
    const start = perPlatform.reduce((s, x) => s + x.s.start, 0)
    const end = perPlatform.reduce((s, x) => s + x.s.end, 0)
    const deposits = perPlatform.reduce((s, x) => s + x.s.deposits, 0)
    const withdrawals = perPlatform.reduce((s, x) => s + x.s.withdrawals, 0)
    const contrib = deposits + withdrawals
    const gain = end - start - contrib
    const perf = start > 0 ? gain / start : contrib > 0 ? gain / contrib : 0
    return { start, end, deposits, withdrawals, contrib, gain, perf }
  }, [perPlatform])

  const periodLabel = fromStr && toStr
    ? `${new Date(`${fromStr}T00:00:00`).toLocaleDateString("fr-FR")} → ${new Date(`${toStr}T00:00:00`).toLocaleDateString("fr-FR")}`
    : "—"

  // Nom de fichier CSV/PDF : Rapport-investissements-Nom-Prenom-periode
  const fileBase = ["Rapport-investissements",
    (userName || "").trim().replace(/[\\/:*?"<>|]/g, "").replace(/\s+/g, "-"),
    fromStr && toStr ? `${fromStr}_${toStr}` : "periode",
  ].filter(Boolean).join("-")

  function setPreset(kind: "current" | "last" | "12m" | "all") {
    if (!nowMs) return
    const now = new Date(nowMs)
    if (kind === "current") { setFromStr(`${now.getFullYear()}-01-01`); setToStr(toInputDate(now)) }
    else if (kind === "last") { setFromStr(`${now.getFullYear() - 1}-01-01`); setToStr(`${now.getFullYear() - 1}-12-31`) }
    else if (kind === "12m") { const d = new Date(nowMs - 365 * 86400000); setFromStr(toInputDate(d)); setToStr(toInputDate(now)) }
    else { setFromStr(toInputDate(new Date(earliest))); setToStr(toInputDate(now)) }
  }

  function downloadCsv() {
    const sep = ";"
    const head = ["Mois", "Valeur fin de mois (€)", "Dépôts (€)", "Retraits (€)", "Gain du mois (€)", "Performance mois (%)", "Plus-value cumulée (€)"]
    const lines = monthly.map((r) => [r.label, fr2(r.value), fr2(r.deposits), fr2(r.withdrawals), fr2(r.gain), fr2(r.returnPct * 100), fr2(r.cumulGain)])
    const totalLine = ["TOTAL période", fr2(totals.end), fr2(totals.deposits), fr2(totals.withdrawals), fr2(totals.gain), fr2(totals.perf * 100), ""]
    const csv = [head, ...lines, totalLine].map((row) => row.map((c) => `"${c}"`).join(sep)).join("\r\n")
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${fileBase}.csv`
    document.body.appendChild(a); a.click(); a.remove()
    URL.revokeObjectURL(url)
  }

  // Le nom par défaut du PDF « Enregistrer en PDF » vient du titre du document : on le
  // fixe le temps de l'impression puis on le restaure.
  function printReport() {
    const prev = document.title
    document.title = fileBase
    const restore = () => { document.title = prev; window.removeEventListener("afterprint", restore) }
    window.addEventListener("afterprint", restore)
    window.print()
  }

  return (
    <div className="space-y-6">
      <div className="print:hidden">
        <Link href="/investissements" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ChevronLeft className="h-4 w-4" /> Investissements
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">Rapport de performances</h1>
        <p className="mt-1 text-sm text-muted-foreground">À exporter (CSV) ou imprimer (PDF) pour ta conseillère en gestion de patrimoine.</p>
      </div>

      {/* Contrôles — masqués à l'impression */}
      <div className="print:hidden space-y-4 rounded-xl border border-border/50 bg-card p-4">
        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Plateformes</span>
            <button type="button" onClick={() => setSelected(allOn ? new Set() : new Set(platforms.map((p) => p.id)))} className="text-xs text-primary hover:underline">
              {allOn ? "Tout décocher" : "Tout cocher"}
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {platforms.map((p) => {
              const on = selected.has(p.id)
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => toggle(p.id)}
                  className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                    on ? "border-primary/40 bg-primary/10 text-foreground" : "border-border/60 text-muted-foreground hover:bg-muted/50")}
                >
                  <span aria-hidden>{metaForType(p.type).icon}</span> {p.name}
                </button>
              )
            })}
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <label className="space-y-1">
            <span className="block text-xs text-muted-foreground">Depuis</span>
            <input type="date" value={fromStr} onChange={(e) => setFromStr(e.target.value)} className="h-9 rounded-md border border-input bg-transparent px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
          </label>
          <label className="space-y-1">
            <span className="block text-xs text-muted-foreground">Jusqu&apos;au</span>
            <input type="date" value={toStr} onChange={(e) => setToStr(e.target.value)} className="h-9 rounded-md border border-input bg-transparent px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
          </label>
          <div className="flex flex-wrap gap-1.5">
            <Button type="button" size="xs" variant="outline" onClick={() => setPreset("current")}>Année en cours</Button>
            <Button type="button" size="xs" variant="outline" onClick={() => setPreset("last")}>Année dernière</Button>
            <Button type="button" size="xs" variant="outline" onClick={() => setPreset("12m")}>12 derniers mois</Button>
            <Button type="button" size="xs" variant="outline" onClick={() => setPreset("all")}>Tout</Button>
          </div>
          <div className="ml-auto flex gap-2">
            <Button type="button" variant="outline" onClick={downloadCsv} disabled={monthly.length === 0}><Download className="h-4 w-4" /> CSV</Button>
            <Button type="button" onClick={printReport} disabled={monthly.length === 0}><Printer className="h-4 w-4" /> Imprimer / PDF</Button>
          </div>
        </div>
      </div>

      {/* Rapport imprimable */}
      <div className="space-y-6 rounded-xl border border-border/50 bg-card p-6 print:border-0 print:bg-transparent print:p-0">
        <div className="flex items-start justify-between gap-4 border-b border-border/50 pb-4">
          <div>
            <h2 className="text-lg font-bold">Suivi des investissements</h2>
            <p className="text-sm text-muted-foreground">Période : {periodLabel}</p>
            <p className="text-xs text-muted-foreground">{chosen.length} plateforme{chosen.length > 1 ? "s" : ""} : {chosen.map((p) => p.name).join(", ") || "—"}</p>
          </div>
        </div>

        {chosen.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Sélectionne au moins une plateforme.</p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Kpi label="Valeur début" value={fmtEur2(totals.start)} />
              <Kpi label="Valeur fin" value={fmtEur2(totals.end)} strong />
              <Kpi label="Apports (période)" value={fmtEur2(totals.contrib)} />
              <Kpi label="Plus-value (période)" value={`${totals.gain >= 0 ? "+" : ""}${fmtEur2(totals.gain)}`} sub={fmtPctSigned(totals.perf)} tone={totals.gain >= 0 ? "pos" : "neg"} />
            </div>

            {annual.length >= 2 && (
              <div className="break-inside-avoid">
                <h3 className="mb-2 text-sm font-semibold">Performances annuelles</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border/60 text-left text-xs text-muted-foreground">
                        <th className="px-3 py-2 font-medium">Année</th>
                        <th className="px-3 py-2 text-right font-medium">Valeur</th>
                        <th className="px-3 py-2 text-right font-medium">Dépôts</th>
                        <th className="px-3 py-2 text-right font-medium">Retraits</th>
                        <th className="px-3 py-2 text-right font-medium">Gain</th>
                        <th className="px-3 py-2 text-right font-medium">Perf.</th>
                        <th className="px-3 py-2 text-right font-medium">Plus-value cumulée</th>
                      </tr>
                    </thead>
                    <tbody>
                      {annual.map((r) => (
                        <tr key={r.year} className="border-b border-border/40 font-medium last:border-0">
                          <td className="whitespace-nowrap px-3 py-1.5">{r.year}</td>
                          <td className="px-3 py-1.5 text-right tabular-nums amount-sensitive">{fmtEur2(r.value)}</td>
                          <td className="px-3 py-1.5 text-right font-normal tabular-nums text-blue-600 dark:text-blue-400 amount-sensitive">
                            {r.deposits ? `+${fmtEur2(r.deposits)}` : "—"}
                          </td>
                          <td className="px-3 py-1.5 text-right font-normal tabular-nums text-amber-600 dark:text-amber-400 amount-sensitive">
                            {r.withdrawals ? fmtEur2(r.withdrawals) : "—"}
                          </td>
                          <td className={cn("px-3 py-1.5 text-right tabular-nums amount-sensitive", r.gain >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400")}>
                            {r.gain >= 0 ? "+" : ""}{fmtEur2(r.gain)}
                          </td>
                          <td className={cn("px-3 py-1.5 text-right tabular-nums", r.returnPct >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400")}>
                            {fmtPctSigned(r.returnPct)}
                          </td>
                          <td className={cn("px-3 py-1.5 text-right tabular-nums font-normal amount-sensitive", r.cumulGain >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400")}>
                            {r.cumulGain >= 0 ? "+" : ""}{fmtEur2(r.cumulGain)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div>
              <h3 className="mb-2 text-sm font-semibold">Performances mensuelles</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/60 text-left text-xs text-muted-foreground">
                      <th className="px-3 py-2 font-medium">Mois</th>
                      <th className="px-3 py-2 text-right font-medium">Valeur</th>
                      <th className="px-3 py-2 text-right font-medium">Dépôts</th>
                      <th className="px-3 py-2 text-right font-medium">Retraits</th>
                      <th className="px-3 py-2 text-right font-medium">Gain</th>
                      <th className="px-3 py-2 text-right font-medium">Perf.</th>
                      <th className="px-3 py-2 text-right font-medium">Plus-value cumulée</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthly.map((r) => (
                      <tr key={r.ym} className="border-b border-border/40 last:border-0">
                        <td className="whitespace-nowrap px-3 py-1.5 capitalize">{r.label}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums amount-sensitive">{fmtEur2(r.value)}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums text-blue-600 dark:text-blue-400 amount-sensitive">
                          {r.deposits ? `+${fmtEur2(r.deposits)}` : "—"}
                        </td>
                        <td className="px-3 py-1.5 text-right tabular-nums text-amber-600 dark:text-amber-400 amount-sensitive">
                          {r.withdrawals ? fmtEur2(r.withdrawals) : "—"}
                        </td>
                        <td className={cn("px-3 py-1.5 text-right tabular-nums amount-sensitive", r.gain >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400")}>
                          {r.gain >= 0 ? "+" : ""}{fmtEur2(r.gain)}
                        </td>
                        <td className={cn("px-3 py-1.5 text-right tabular-nums", r.returnPct >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400")}>
                          {fmtPctSigned(r.returnPct)}
                        </td>
                        <td className={cn("px-3 py-1.5 text-right tabular-nums amount-sensitive", r.cumulGain >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400")}>
                          {r.cumulGain >= 0 ? "+" : ""}{fmtEur2(r.cumulGain)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <h3 className="mb-2 text-sm font-semibold">Détail par plateforme (sur la période)</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/60 text-left text-xs text-muted-foreground">
                      <th className="px-3 py-2 font-medium">Plateforme</th>
                      <th className="px-3 py-2 text-right font-medium">Valeur début</th>
                      <th className="px-3 py-2 text-right font-medium">Dépôts</th>
                      <th className="px-3 py-2 text-right font-medium">Retraits</th>
                      <th className="px-3 py-2 text-right font-medium">Valeur fin</th>
                      <th className="px-3 py-2 text-right font-medium">Plus-value</th>
                      <th className="px-3 py-2 text-right font-medium">Perf.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {perPlatform.map(({ p, s }) => (
                      <tr key={p.id} className="border-b border-border/40 last:border-0">
                        <td className="whitespace-nowrap px-3 py-1.5">{metaForType(p.type).icon} {p.name}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums amount-sensitive">{fmtEur2(s.start)}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums text-blue-600 dark:text-blue-400 amount-sensitive">{s.deposits ? `+${fmtEur2(s.deposits)}` : "—"}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums text-amber-600 dark:text-amber-400 amount-sensitive">{s.withdrawals ? fmtEur2(s.withdrawals) : "—"}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums font-medium amount-sensitive">{fmtEur2(s.end)}</td>
                        <td className={cn("px-3 py-1.5 text-right tabular-nums amount-sensitive", s.gain >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400")}>
                          {s.gain >= 0 ? "+" : ""}{fmtEur2(s.gain)}
                        </td>
                        <td className={cn("px-3 py-1.5 text-right tabular-nums", s.perf >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400")}>
                          {fmtPctSigned(s.perf)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <p className="pt-2 text-[11px] text-muted-foreground">
              Plus-value = valeur − apports nets (dépôts − retraits). Un transfert entre plateformes (retrait d&apos;un côté, dépôt de l&apos;autre) s&apos;annule et n&apos;affecte donc pas la performance. Performance = gain de la période rapporté à la valeur de début. Données personnelles — export généré depuis l&apos;ERP.
            </p>
          </>
        )}
      </div>
    </div>
  )
}

function Kpi({ label, value, sub, tone, strong }: { label: string; value: string; sub?: string; tone?: "pos" | "neg"; strong?: boolean }) {
  return (
    <div className="min-w-0 rounded-lg border border-border/50 px-3 py-2">
      <p className="truncate text-[11px] text-muted-foreground">{label}</p>
      <p className={cn("mt-0.5 tabular-nums amount-sensitive", strong ? "text-lg font-bold" : "text-sm font-semibold",
        tone === "pos" && "text-emerald-600 dark:text-emerald-400", tone === "neg" && "text-red-600 dark:text-red-400")}>{value}</p>
      {sub && <p className={cn("text-[11px] tabular-nums", tone === "pos" ? "text-emerald-600/80 dark:text-emerald-400/80" : tone === "neg" ? "text-red-600/80 dark:text-red-400/80" : "text-muted-foreground")}>{sub}</p>}
    </div>
  )
}
