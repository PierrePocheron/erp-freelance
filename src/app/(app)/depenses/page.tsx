import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import Link from "next/link"
import { TrendingDown, Repeat, Play, Pause, ChevronLeft, ChevronRight } from "lucide-react"
import { getOrCreateDefaultExpenseCategories, toggleRecurringExpenseActive, generatePendingRecurringExpenses } from "@/actions/expense"
import { getOccurrencesInRange } from "@/lib/dates"
import { ExpenseDonutChart, type DonutSegment } from "@/components/modules/depenses/ExpenseDonutChart"
import { ExpenseDialog } from "@/components/modules/depenses/ExpenseDialog"
import { RecurringExpenseDialog } from "@/components/modules/depenses/RecurringExpenseDialog"
// Depuis le module neutre, PAS depuis le composant client : importées à
// travers une frontière "use client", ces constantes deviennent des
// références client et se rendent vides côté serveur (badge fréquence vide).
import { FREQUENCY_LABELS } from "@/lib/expense-constants"

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

export default async function DepensesPage({
  searchParams,
}: {
  searchParams: Promise<{ scope?: string; mois?: string }>
}) {
  const session = await auth()
  const userId = session!.user.id
  const { scope: scopeParam, mois: moisParam } = await searchParams
  const scopeFilter: "PRO" | "PERSO" | null = scopeParam === "PRO" || scopeParam === "PERSO" ? scopeParam : null

  // Les occurrences récurrentes échues se matérialisent automatiquement à
  // l'ouverture de la page (comme markLateInvoices côté facturation) — plus
  // de bouton « Générer » à actionner à la main.
  await generatePendingRecurringExpenses()

  // ── Mois affiché (?mois=YYYY-MM, défaut : mois courant) ───────────────────
  const now = new Date()
  const moisMatch = moisParam?.match(/^(\d{4})-(\d{2})$/)
  const viewYear = moisMatch ? Number(moisMatch[1]) : now.getFullYear()
  const viewMonth = moisMatch ? Number(moisMatch[2]) - 1 : now.getMonth()
  const monthStart = new Date(viewYear, viewMonth, 1)
  const monthEnd = new Date(viewYear, viewMonth + 1, 0, 23, 59, 59)
  const isCurrentMonth = viewYear === now.getFullYear() && viewMonth === now.getMonth()

  const monthKey = (y: number, m0: number) => `${y}-${String(m0 + 1).padStart(2, "0")}`
  const monthHref = (y: number, m0: number) =>
    `/depenses?mois=${monthKey(y, m0)}${scopeFilter ? `&scope=${scopeFilter}` : ""}`
  const prevHref = monthHref(viewMonth === 0 ? viewYear - 1 : viewYear, viewMonth === 0 ? 11 : viewMonth - 1)
  const nextHref = monthHref(viewMonth === 11 ? viewYear + 1 : viewYear, viewMonth === 11 ? 0 : viewMonth + 1)
  const scopeHref = (scope: "PRO" | "PERSO" | null) =>
    `/depenses?${[!isCurrentMonth && `mois=${monthKey(viewYear, viewMonth)}`, scope && `scope=${scope}`].filter(Boolean).join("&")}`
  const monthLabel = monthStart.toLocaleDateString("fr-FR", { month: "long", year: "numeric" })

  const [categories, monthExpenses, recurringExpenses] = await Promise.all([
    getOrCreateDefaultExpenseCategories(),
    prisma.expense.findMany({
      where: { userId, date: { gte: monthStart, lte: monthEnd } },
      orderBy: { date: "asc" },
      include: {
        category: { select: { id: true, name: true, color: true } },
        // Une dépense générée depuis une récurrente affiche la fréquence
        // d'origine, et porte le bouton pause/reprise de sa récurrente parente
        recurringExpense: { select: { id: true, frequency: true, isActive: true } },
      },
    }),
    prisma.recurringExpense.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
      include: {
        category: { select: { id: true, name: true, color: true } },
        _count: { select: { expenses: true } },
      },
    }),
  ])

  const activeRecurring = recurringExpenses.filter((r) => r.isActive)

  // Occurrences récurrentes À VENIR sur le mois affiché : après la génération
  // automatique, nextGenerationDate est toujours futur pour les actives — la
  // projection couvre donc le reste du mois courant et les mois futurs, sans
  // double compte avec les dépenses déjà matérialisées. Les récurrentes EN
  // PAUSE sont projetées aussi (affichées grisées pour matérialiser la pause)
  // mais exclues des totaux : elles ne seront pas prélevées.
  const upcoming = recurringExpenses
    .filter((r) => !r.dateToConfirm)
    .flatMap((r) =>
      getOccurrencesInRange(r.nextGenerationDate, r.frequency, monthStart, monthEnd)
        .map((date) => ({ r, date }))
    )

  // Les récurrentes sans date connue n'apparaîtraient nulle part : rattachées
  // au mois courant pour rester éditables (compléter la date, pause, etc.)
  const withoutDate = isCurrentMonth ? recurringExpenses.filter((r) => r.dateToConfirm) : []

  type MonthRow =
    | { kind: "REAL"; date: Date; e: (typeof monthExpenses)[number] }
    | { kind: "UPCOMING"; date: Date; r: (typeof recurringExpenses)[number] }
    | { kind: "NODATE"; date: Date; r: (typeof recurringExpenses)[number] }

  const monthRows: MonthRow[] = [
    ...monthExpenses.map((e) => ({ kind: "REAL" as const, date: e.date, e })),
    ...upcoming.map(({ r, date }) => ({ kind: "UPCOMING" as const, date, r })),
    // Sans date → en fin de liste
    ...withoutDate.map((r) => ({ kind: "NODATE" as const, date: monthEnd, r })),
  ].sort((a, b) => a.date.getTime() - b.date.getTime())

  // ── Stats du mois affiché (réel + à venir actif) ──────────────────────────
  type MonthItem = { amount: number; scope: string; category: { id: string; name: string; color: string } | null }
  const monthItems: MonthItem[] = [
    ...monthExpenses.map((e) => ({ amount: e.amount, scope: e.scope, category: e.category })),
    ...upcoming.filter(({ r }) => r.isActive).map(({ r }) => ({ amount: r.amount, scope: r.scope, category: r.category })),
  ]
  const filteredMonthItems = scopeFilter ? monthItems.filter((e) => e.scope === scopeFilter) : monthItems

  const monthTotal = monthItems.reduce((s, e) => s + e.amount, 0)
  const proTotal = monthItems.filter((e) => e.scope === "PRO").reduce((s, e) => s + e.amount, 0)
  const persoTotal = monthItems.filter((e) => e.scope === "PERSO").reduce((s, e) => s + e.amount, 0)

  const monthlyRecurringTotal = activeRecurring.reduce((s, r) => s + monthlyEquivalent(r.amount, r.frequency), 0)
  const yearlyRecurringTotal = activeRecurring.reduce((s, r) => s + yearlyEquivalent(r.amount, r.frequency), 0)

  // Répartition par catégorie (donut) — mois affiché, filtrée par portée si sélectionnée
  const byCategory = new Map<string, DonutSegment>()
  for (const e of filteredMonthItems) {
    const key = e.category?.id ?? "none"
    const existing = byCategory.get(key)
    if (existing) existing.value += e.amount
    else byCategory.set(key, { id: key, label: e.category?.name ?? "Sans catégorie", value: e.amount, color: e.category?.color ?? "#94a3b8" })
  }
  const donutSegments = Array.from(byCategory.values()).sort((a, b) => b.value - a.value)

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
            <Link href={scopeHref(null)} className={`px-2 py-1 rounded-md ${!scopeFilter ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>Tout</Link>
            <Link href={scopeHref("PRO")} className={`px-2 py-1 rounded-md ${scopeFilter === "PRO" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>Pro</Link>
            <Link href={scopeHref("PERSO")} className={`px-2 py-1 rounded-md ${scopeFilter === "PERSO" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>Perso</Link>
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
                <Link href={scopeFilter ? `/depenses?scope=${scopeFilter}` : "/depenses"} className="text-xs text-primary hover:underline mr-1">
                  Ce mois-ci
                </Link>
              )}
              <Link href={prevHref} className="flex h-7 w-7 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted hover:text-foreground transition-colors" title="Mois précédent">
                <ChevronLeft className="h-4 w-4" />
              </Link>
              <span className={`min-w-28 text-center text-xs font-semibold capitalize tabular-nums ${isCurrentMonth ? "text-primary" : ""}`}>
                {monthLabel}
              </span>
              <Link href={nextHref} className="flex h-7 w-7 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted hover:text-foreground transition-colors" title="Mois suivant">
                <ChevronRight className="h-4 w-4" />
              </Link>
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
                      <form action={async () => { "use server"; await toggleRecurringExpenseActive(row.e.recurringExpense!.id, !row.e.recurringExpense!.isActive) }}>
                        <button type="submit" className="text-muted-foreground hover:text-foreground transition-colors" title={row.e.recurringExpense.isActive ? "Mettre la récurrente en pause" : "Réactiver la récurrente"}>
                          {row.e.recurringExpense.isActive ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                        </button>
                      </form>
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
                    <form action={async () => { "use server"; await toggleRecurringExpenseActive(row.r.id, !row.r.isActive) }}>
                      <button type="submit" className="text-muted-foreground hover:text-foreground transition-colors" title={row.r.isActive ? "Mettre en pause" : "Réactiver"}>
                        {row.r.isActive ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                      </button>
                    </form>
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
