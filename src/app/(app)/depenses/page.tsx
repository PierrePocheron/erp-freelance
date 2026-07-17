import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import Link from "next/link"
import { TrendingDown, Repeat, Play, Pause } from "lucide-react"
import { getOrCreateDefaultExpenseCategories, toggleRecurringExpenseActive, generatePendingRecurringExpenses } from "@/actions/expense"
import { getOccurrencesInRange } from "@/lib/dates"
import { ExpenseDonutChart, type DonutSegment } from "@/components/modules/depenses/ExpenseDonutChart"
import { ExpenseDialog } from "@/components/modules/depenses/ExpenseDialog"
import { RecurringExpenseDialog, FREQUENCY_LABELS } from "@/components/modules/depenses/RecurringExpenseDialog"

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
  searchParams: Promise<{ scope?: string }>
}) {
  const session = await auth()
  const userId = session!.user.id
  const { scope: scopeParam } = await searchParams
  const scopeFilter: "PRO" | "PERSO" | null = scopeParam === "PRO" || scopeParam === "PERSO" ? scopeParam : null

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)

  const [categories, expenses, recurringExpenses] = await Promise.all([
    getOrCreateDefaultExpenseCategories(),
    prisma.expense.findMany({
      where: { userId },
      orderBy: { date: "desc" },
      take: 100,
      include: {
        category: { select: { id: true, name: true, color: true } },
        // Une dépense générée depuis une récurrente affiche la fréquence
        // d'origine (mensuelle, annuelle…) plutôt que « Ponctuelle »
        recurringExpense: { select: { frequency: true } },
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

  type ExpenseRow =
    | { kind: "ONE"; sortDate: Date; e: (typeof expenses)[number] }
    | { kind: "RECURRING"; sortDate: Date; r: (typeof recurringExpenses)[number] }

  const expenseRows: ExpenseRow[] = [
    ...expenses.map((e) => ({ kind: "ONE" as const, sortDate: e.date, e })),
    ...recurringExpenses.map((r) => ({ kind: "RECURRING" as const, sortDate: r.nextGenerationDate, r })),
  ].sort((a, b) => b.sortDate.getTime() - a.sortDate.getTime())

  // Éléments du mois : dépenses ponctuelles datées ce mois + occurrences des
  // dépenses récurrentes actives tombant ce mois-ci (projetées, non encore
  // matérialisées en Expense — sans elles les stats affichent 0 tant que rien
  // n'a été « généré »). Pas de double comptage : après génération, le
  // nextGenerationDate pointe toujours vers une occurrence future.
  type MonthItem = { amount: number; scope: string; category: { id: string; name: string; color: string } | null }
  const monthItems: MonthItem[] = [
    ...expenses
      .filter((e) => e.date >= monthStart && e.date <= monthEnd)
      .map((e) => ({ amount: e.amount, scope: e.scope, category: e.category })),
    ...activeRecurring.flatMap((r) =>
      getOccurrencesInRange(r.nextGenerationDate, r.frequency, monthStart, monthEnd)
        .map(() => ({ amount: r.amount, scope: r.scope, category: r.category }))
    ),
  ]
  const filteredMonthItems = scopeFilter ? monthItems.filter((e) => e.scope === scopeFilter) : monthItems

  const monthTotal = monthItems.reduce((s, e) => s + e.amount, 0)
  const proTotal = monthItems.filter((e) => e.scope === "PRO").reduce((s, e) => s + e.amount, 0)
  const persoTotal = monthItems.filter((e) => e.scope === "PERSO").reduce((s, e) => s + e.amount, 0)

  const monthlyRecurringTotal = activeRecurring.reduce((s, r) => s + monthlyEquivalent(r.amount, r.frequency), 0)
  const yearlyRecurringTotal = activeRecurring.reduce((s, r) => s + yearlyEquivalent(r.amount, r.frequency), 0)

  // Répartition par catégorie (donut) — mois courant, filtrée par portée si sélectionnée
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

      {/* Stats du mois */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border/50 bg-card p-4 space-y-1">
          <div className="flex items-center gap-2 text-muted-foreground text-xs">
            <TrendingDown className="h-3.5 w-3.5" />
            Total du mois
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

      {/* Camembert + liste */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-xl border border-border/50 bg-card p-5 space-y-4 lg:col-span-1">
          <h2 className="font-semibold text-sm">Répartition par catégorie</h2>
          <div className="flex gap-1.5 text-xs">
            <Link href="/depenses" className={`px-2 py-1 rounded-md ${!scopeFilter ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>Tout</Link>
            <Link href="/depenses?scope=PRO" className={`px-2 py-1 rounded-md ${scopeFilter === "PRO" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>Pro</Link>
            <Link href="/depenses?scope=PERSO" className={`px-2 py-1 rounded-md ${scopeFilter === "PERSO" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>Perso</Link>
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
          <div className="flex items-center justify-between flex-wrap gap-3">
            <h2 className="font-semibold text-sm">Dépenses</h2>
            <form action={async () => { "use server"; await generatePendingRecurringExpenses() }}>
              <button type="submit" className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-muted transition-colors">
                <Repeat className="h-3.5 w-3.5" />
                Générer les dépenses en attente
              </button>
            </form>
          </div>
          {expenseRows.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">Aucune dépense enregistrée</p>
          ) : (
            <div className="space-y-1.5 max-h-[520px] overflow-y-auto pr-1">
              {expenseRows.map((row) => row.kind === "ONE" ? (
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
                  <ExpenseDialog
                    categories={categories}
                    expense={{ id: row.e.id, label: row.e.label, merchant: row.e.merchant, amount: row.e.amount, date: row.e.date, scope: row.e.scope, categoryId: row.e.categoryId, notes: row.e.notes }}
                  />
                </div>
              ) : (
                <div key={`r-${row.r.id}`} className={`flex items-center gap-3 py-1.5 group ${!row.r.isActive ? "opacity-50" : ""}`}>
                  <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: row.r.category?.color ?? "#94a3b8" }} />
                  <span className="flex-1 text-sm truncate min-w-0">{row.r.label}</span>
                  <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${row.r.scope === "PRO" ? "bg-indigo-500/15 text-indigo-600" : "bg-slate-500/15 text-slate-600"}`}>
                    {row.r.scope === "PRO" ? "Pro" : "Perso"}
                  </span>
                  <span className="shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium bg-primary/10 text-primary">
                    {FREQUENCY_LABELS[row.r.frequency]}
                  </span>
                  {row.r.dateToConfirm ? (
                    <span className="shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium bg-amber-500/10 text-amber-700 whitespace-nowrap">
                      À compléter
                    </span>
                  ) : (
                    <span className="shrink-0 text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(row.r.nextGenerationDate).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                    </span>
                  )}
                  <span className="shrink-0 text-sm font-medium tabular-nums w-16 text-right">{fmt(row.r.amount)} €</span>
                  <form action={async () => { "use server"; await toggleRecurringExpenseActive(row.r.id, !row.r.isActive) }}>
                    <button type="submit" className="text-muted-foreground hover:text-foreground transition-colors" title={row.r.isActive ? "Mettre en pause" : "Réactiver"}>
                      {row.r.isActive ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                    </button>
                  </form>
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
