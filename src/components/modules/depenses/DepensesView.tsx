"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { TrendingDown, Repeat, Play, Pause, ChevronLeft, ChevronRight } from "lucide-react"
import { toggleRecurringExpenseActive } from "@/actions/expense"
import { getOccurrencesInRange } from "@/lib/dates"
import { FREQUENCY_LABELS } from "@/lib/expense-constants"
import { ExpenseDonutChart, type DonutSegment } from "./ExpenseDonutChart"
import { ExpenseDialog } from "./ExpenseDialog"
import { RecurringExpenseDialog } from "./RecurringExpenseDialog"
import type { ExpenseCategory } from "./ExpenseCategoryCombobox"

const fmt = (n: number) => n.toLocaleString("fr-FR", { maximumFractionDigits: 0 })

function monthlyEquivalent(amount: number, frequency: string): number {
  if (frequency === "WEEKLY") return (amount * 52) / 12
  if (frequency === "MONTHLY") return amount
  if (frequency === "QUARTERLY") return amount / 3
  if (frequency === "YEARLY") return amount / 12
  return 0 // CUSTOM : cadence inconnue, exclue des estimations
}

function yearlyEquivalent(amount: number, frequency: string): number {
  if (frequency === "WEEKLY") return amount * 52
  if (frequency === "MONTHLY") return amount * 12
  if (frequency === "QUARTERLY") return amount * 4
  if (frequency === "YEARLY") return amount
  return 0 // CUSTOM : cadence inconnue, exclue des estimations
}

export type ExpenseItem = {
  id: string
  label: string
  merchant: string | null
  amount: number
  date: Date
  scope: "PRO" | "PERSO"
  categoryId: string | null
  notes: string | null
  recurringExpenseId: string | null
  category: { id: string; name: string; color: string } | null
  recurringExpense: { id: string; frequency: string; isActive: boolean } | null
}

export type RecurringItem = {
  id: string
  label: string
  amount: number
  scope: "PRO" | "PERSO"
  frequency: "WEEKLY" | "MONTHLY" | "QUARTERLY" | "YEARLY" | "CUSTOM"
  nextGenerationDate: Date
  dateToConfirm: boolean
  isActive: boolean
  categoryId: string | null
  notes: string | null
  category: { id: string; name: string; color: string } | null
}

/**
 * Vue Dépenses entièrement côté client : toutes les dépenses sont chargées
 * par la page serveur, le changement de mois / de portée est un simple
 * changement d'état local (URL synchronisée en shallow routing) — aucune
 * navigation serveur, donc instantané.
 */
export function DepensesView({
  categories,
  expenses,
  recurringExpenses,
}: {
  categories: ExpenseCategory[]
  expenses: ExpenseItem[]
  recurringExpenses: RecurringItem[]
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isToggling, startToggle] = useTransition()

  // Date de référence figée au premier rendu (règle react-hooks/purity)
  const [now] = useState(() => new Date())
  const currentKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`

  // ── Mois affiché + portée : état local initialisé depuis l'URL ────────────
  const moisParam = searchParams.get("mois")
  const scopeParam = searchParams.get("scope")
  const [monthKey, setMonthKey] = useState(() =>
    moisParam && /^\d{4}-\d{2}$/.test(moisParam) ? moisParam : currentKey
  )
  const [scopeFilter, setScopeFilter] = useState<"PRO" | "PERSO" | null>(
    scopeParam === "PRO" || scopeParam === "PERSO" ? scopeParam : null
  )

  function syncUrl(nextMonth: string, nextScope: "PRO" | "PERSO" | null) {
    const params = new URLSearchParams(window.location.search)
    if (nextMonth === currentKey) params.delete("mois")
    else params.set("mois", nextMonth)
    if (nextScope) params.set("scope", nextScope)
    else params.delete("scope")
    const qs = params.toString()
    window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname)
  }

  function changeMonth(delta: number) {
    const [y, m] = monthKey.split("-").map(Number)
    const d = new Date(y, m - 1 + delta, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    setMonthKey(key)
    syncUrl(key, scopeFilter)
  }

  function goToCurrentMonth() {
    setMonthKey(currentKey)
    syncUrl(currentKey, scopeFilter)
  }

  function changeScope(scope: "PRO" | "PERSO" | null) {
    setScopeFilter(scope)
    syncUrl(monthKey, scope)
  }

  const [viewYear, viewMonth1] = monthKey.split("-").map(Number)
  const monthStart = useMemo(() => new Date(viewYear, viewMonth1 - 1, 1), [viewYear, viewMonth1])
  const monthEnd = useMemo(() => new Date(viewYear, viewMonth1, 0, 23, 59, 59), [viewYear, viewMonth1])
  const isCurrentMonth = monthKey === currentKey
  const monthLabel = monthStart.toLocaleDateString("fr-FR", { month: "long", year: "numeric" })

  const activeRecurring = recurringExpenses.filter((r) => r.isActive)

  // ── Contenu du mois ───────────────────────────────────────────────────────
  const monthExpenses = useMemo(
    () => expenses
      .filter((e) => e.date >= monthStart && e.date <= monthEnd)
      .sort((a, b) => a.date.getTime() - b.date.getTime()),
    [expenses, monthStart, monthEnd]
  )

  // Occurrences récurrentes projetées sur le mois. Les récurrentes EN PAUSE
  // sont projetées aussi (grisées) mais exclues des totaux.
  const upcoming = useMemo(
    () => recurringExpenses
      .filter((r) => !r.dateToConfirm)
      .flatMap((r) =>
        getOccurrencesInRange(r.nextGenerationDate, r.frequency, monthStart, monthEnd)
          .map((date) => ({ r, date }))
      ),
    [recurringExpenses, monthStart, monthEnd]
  )

  // Les récurrentes sans date connue restent accessibles depuis le mois courant
  const withoutDate = isCurrentMonth ? recurringExpenses.filter((r) => r.dateToConfirm) : []

  type MonthRow =
    | { kind: "REAL"; date: Date; e: ExpenseItem }
    | { kind: "UPCOMING"; date: Date; r: RecurringItem }
    | { kind: "NODATE"; date: Date; r: RecurringItem }

  const monthRows: MonthRow[] = [
    ...monthExpenses.map((e) => ({ kind: "REAL" as const, date: e.date, e })),
    ...upcoming.map(({ r, date }) => ({ kind: "UPCOMING" as const, date, r })),
    ...withoutDate.map((r) => ({ kind: "NODATE" as const, date: monthEnd, r })),
  ].sort((a, b) => a.date.getTime() - b.date.getTime())

  // ── Stats du mois (réel + à venir actif) ──────────────────────────────────
  const monthItems = [
    ...monthExpenses.map((e) => ({ amount: e.amount, scope: e.scope, category: e.category })),
    ...upcoming.filter(({ r }) => r.isActive).map(({ r }) => ({ amount: r.amount, scope: r.scope, category: r.category })),
  ]
  const filteredMonthItems = scopeFilter ? monthItems.filter((e) => e.scope === scopeFilter) : monthItems

  const monthTotal = monthItems.reduce((s, e) => s + e.amount, 0)
  const proTotal = monthItems.filter((e) => e.scope === "PRO").reduce((s, e) => s + e.amount, 0)
  const persoTotal = monthItems.filter((e) => e.scope === "PERSO").reduce((s, e) => s + e.amount, 0)

  const monthlyRecurringTotal = activeRecurring.reduce((s, r) => s + monthlyEquivalent(r.amount, r.frequency), 0)
  const yearlyRecurringTotal = activeRecurring.reduce((s, r) => s + yearlyEquivalent(r.amount, r.frequency), 0)

  const byCategory = new Map<string, DonutSegment>()
  for (const e of filteredMonthItems) {
    const key = e.category?.id ?? "none"
    const existing = byCategory.get(key)
    if (existing) existing.value += e.amount
    else byCategory.set(key, { id: key, label: e.category?.name ?? "Sans catégorie", value: e.amount, color: e.category?.color ?? "#94a3b8" })
  }
  const donutSegments = Array.from(byCategory.values()).sort((a, b) => b.value - a.value)

  function togglePause(id: string, isActive: boolean) {
    startToggle(async () => {
      await toggleRecurringExpenseActive(id, isActive)
      router.refresh()
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="sm:hidden text-2xl font-bold tracking-tight">Dépenses</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Suivi des dépenses pro et perso, par catégorie
          </p>
        </div>
        <ExpenseDialog categories={categories} />
      </div>

      {/* Stats du mois affiché */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border/50 bg-card p-4 space-y-1">
          <div className="flex items-center gap-2 text-muted-foreground text-xs">
            <TrendingDown className="h-3.5 w-3.5" />
            <span className="capitalize">Total — {monthLabel}</span>
          </div>
          <p className="text-2xl font-bold tabular-nums">{fmt(monthTotal)} €</p>
        </div>
        <div className="rounded-xl border border-border/50 bg-card p-4 space-y-1">
          <p className="text-xs text-muted-foreground">Pro</p>
          <p className="text-2xl font-bold tabular-nums">{fmt(proTotal)} €</p>
        </div>
        <div className="rounded-xl border border-border/50 bg-card p-4 space-y-1">
          <p className="text-xs text-muted-foreground">Perso</p>
          <p className="text-2xl font-bold tabular-nums">{fmt(persoTotal)} €</p>
        </div>
      </div>

      {/* Estimations récurrentes — normalisées par mois/an quelle que soit la fréquence */}
      {activeRecurring.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-border/50 bg-card p-4 space-y-1">
            <div className="flex items-center gap-2 text-muted-foreground text-xs">
              <Repeat className="h-3.5 w-3.5" />
              Estimation par mois
            </div>
            <p className="text-2xl font-bold tabular-nums">{fmt(monthlyRecurringTotal)} €</p>
            <p className="text-xs text-muted-foreground">via les dépenses récurrentes actives</p>
          </div>
          <div className="rounded-xl border border-border/50 bg-card p-4 space-y-1">
            <div className="flex items-center gap-2 text-muted-foreground text-xs">
              <Repeat className="h-3.5 w-3.5" />
              Estimation par an
            </div>
            <p className="text-2xl font-bold tabular-nums">{fmt(yearlyRecurringTotal)} €</p>
            <p className="text-xs text-muted-foreground">via les dépenses récurrentes actives</p>
          </div>
        </div>
      )}

      {/* Camembert + liste du mois */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-xl border border-border/50 bg-card p-5 space-y-4 lg:col-span-1">
          <h2 className="font-semibold text-sm">Répartition par catégorie</h2>
          <div className="flex gap-1.5 text-xs">
            <button onClick={() => changeScope(null)} className={`px-2 py-1 rounded-md ${!scopeFilter ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>Tout</button>
            <button onClick={() => changeScope("PRO")} className={`px-2 py-1 rounded-md ${scopeFilter === "PRO" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>Pro</button>
            <button onClick={() => changeScope("PERSO")} className={`px-2 py-1 rounded-md ${scopeFilter === "PERSO" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>Perso</button>
          </div>
          <div className="flex justify-center py-2">
            <ExpenseDonutChart segments={donutSegments} />
          </div>
          {donutSegments.length > 0 && (
            <div className="space-y-1.5">
              {donutSegments.map((seg) => (
                <div key={seg.id} className="flex items-center gap-2 text-xs">
                  <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: seg.color }} />
                  <span className="flex-1 truncate">{seg.label}</span>
                  <span className="font-medium tabular-nums">{fmt(seg.value)} €</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-border/50 bg-card p-5 space-y-4 lg:col-span-2">
          {/* En-tête de carte : titre + navigation entre les mois */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h2 className="font-semibold text-sm capitalize">Dépenses — {monthLabel}</h2>
            <div className="flex items-center gap-1.5">
              {!isCurrentMonth && (
                <button onClick={goToCurrentMonth} className="text-xs text-primary hover:underline mr-1">
                  Ce mois-ci
                </button>
              )}
              <button onClick={() => changeMonth(-1)} className="flex h-7 w-7 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted hover:text-foreground transition-colors" title="Mois précédent">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className={`min-w-28 text-center text-xs font-semibold capitalize tabular-nums ${isCurrentMonth ? "text-primary" : ""}`}>
                {monthLabel}
              </span>
              <button onClick={() => changeMonth(1)} className="flex h-7 w-7 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted hover:text-foreground transition-colors" title="Mois suivant">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
          {monthRows.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">Aucune dépense sur ce mois</p>
          ) : (
            <div className="space-y-1.5 max-h-[520px] overflow-y-auto pr-1">
              {monthRows.map((row) => row.kind === "REAL" ? (
                <div key={`e-${row.e.id}`} className="flex items-center gap-3 py-1.5 group">
                  <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: row.e.category?.color ?? "#94a3b8" }} />
                  <span className="flex-1 text-sm truncate min-w-0">
                    {row.e.merchant && <span className="font-medium">{row.e.merchant} – </span>}
                    {row.e.label}
                  </span>
                  {/* Achat ponctuel sans société/enseigne renseignée → à compléter */}
                  {!row.e.merchant && !row.e.recurringExpenseId && (
                    <span className="shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium bg-amber-500/10 text-amber-700 whitespace-nowrap">
                      À compléter
                    </span>
                  )}
                  <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${row.e.scope === "PRO" ? "bg-indigo-500/15 text-indigo-600" : "bg-slate-500/15 text-slate-600"}`}>
                    {row.e.scope === "PRO" ? "Pro" : "Perso"}
                  </span>
                  {row.e.recurringExpense ? (
                    <span className="shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium bg-primary/10 text-primary">
                      {FREQUENCY_LABELS[row.e.recurringExpense.frequency]}
                    </span>
                  ) : (
                    <span className="shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium bg-muted text-muted-foreground">
                      Ponctuelle
                    </span>
                  )}
                  <span className="shrink-0 text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(row.e.date).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                  </span>
                  <span className="shrink-0 text-sm font-medium tabular-nums w-16 text-right">{fmt(row.e.amount)} €</span>
                  {/* Colonne pause/reprise à largeur FIXE : présente sur toutes les
                      lignes (vide pour les ponctuelles) pour un alignement stable */}
                  <div className="w-4 shrink-0 flex justify-center">
                    {row.e.recurringExpense && (
                      <button
                        onClick={() => togglePause(row.e.recurringExpense!.id, !row.e.recurringExpense!.isActive)}
                        disabled={isToggling}
                        className="text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                        title={row.e.recurringExpense.isActive ? "Mettre la récurrente en pause" : "Réactiver la récurrente"}
                      >
                        {row.e.recurringExpense.isActive ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                      </button>
                    )}
                  </div>
                  <ExpenseDialog
                    categories={categories}
                    expense={{ id: row.e.id, label: row.e.label, merchant: row.e.merchant, amount: row.e.amount, date: row.e.date, scope: row.e.scope, categoryId: row.e.categoryId, notes: row.e.notes, fromRecurring: !!row.e.recurringExpenseId }}
                  />
                </div>
              ) : (
                // Occurrence récurrente projetée (à venir), récurrente en pause,
                // ou récurrente sans date connue (kind NODATE, mois courant)
                <div
                  key={`u-${row.r.id}-${row.date.toISOString()}`}
                  className={`flex items-center gap-3 py-1.5 group ${row.r.isActive ? "opacity-70" : "opacity-40"}`}
                >
                  <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: row.r.category?.color ?? "#94a3b8" }} />
                  <span className="flex-1 text-sm truncate min-w-0">{row.r.label}</span>
                  {!row.r.isActive ? (
                    <span className="shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium bg-muted text-muted-foreground whitespace-nowrap">
                      En pause
                    </span>
                  ) : row.kind === "NODATE" ? (
                    <span className="shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium bg-amber-500/10 text-amber-700 whitespace-nowrap">
                      Date à compléter
                    </span>
                  ) : (
                    <span className="shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium bg-blue-500/10 text-blue-600 whitespace-nowrap">
                      À venir
                    </span>
                  )}
                  <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${row.r.scope === "PRO" ? "bg-indigo-500/15 text-indigo-600" : "bg-slate-500/15 text-slate-600"}`}>
                    {row.r.scope === "PRO" ? "Pro" : "Perso"}
                  </span>
                  <span className="shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium bg-primary/10 text-primary">
                    {FREQUENCY_LABELS[row.r.frequency]}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground whitespace-nowrap">
                    {row.kind === "NODATE" ? "—" : row.date.toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                  </span>
                  <span className="shrink-0 text-sm font-medium tabular-nums w-16 text-right">{fmt(row.r.amount)} €</span>
                  <div className="w-4 shrink-0 flex justify-center">
                    <button
                      onClick={() => togglePause(row.r.id, !row.r.isActive)}
                      disabled={isToggling}
                      className="text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                      title={row.r.isActive ? "Mettre en pause" : "Réactiver"}
                    >
                      {row.r.isActive ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                  <RecurringExpenseDialog
                    categories={categories}
                    recurringExpense={{
                      id: row.r.id, label: row.r.label, amount: row.r.amount, scope: row.r.scope, frequency: row.r.frequency,
                      nextGenerationDate: row.r.nextGenerationDate, dateToConfirm: row.r.dateToConfirm, categoryId: row.r.categoryId, notes: row.r.notes,
                    }}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
