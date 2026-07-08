import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import Link from "next/link"
import { TrendingDown, Repeat, Play, Pause } from "lucide-react"
import { getOrCreateDefaultExpenseCategories, toggleRecurringExpenseActive, generatePendingRecurringExpenses } from "@/actions/expense"
import { ExpenseDonutChart, type DonutSegment } from "@/components/modules/depenses/ExpenseDonutChart"
import { ExpenseDialog } from "@/components/modules/depenses/ExpenseDialog"
import { ExpenseCategoryManager } from "@/components/modules/depenses/ExpenseCategoryManager"
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
      include: { category: { select: { id: true, name: true, color: true } } },
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

  const monthExpenses = expenses.filter((e) => e.date >= monthStart && e.date <= monthEnd)
  const filteredMonthExpenses = scopeFilter ? monthExpenses.filter((e) => e.scope === scopeFilter) : monthExpenses

  const monthTotal = monthExpenses.reduce((s, e) => s + e.amount, 0)
  const proTotal = monthExpenses.filter((e) => e.scope === "PRO").reduce((s, e) => s + e.amount, 0)
  const persoTotal = monthExpenses.filter((e) => e.scope === "PERSO").reduce((s, e) => s + e.amount, 0)

  const monthlyRecurringTotal = activeRecurring.reduce((s, r) => s + monthlyEquivalent(r.amount, r.frequency), 0)
  const yearlyRecurringTotal = activeRecurring.reduce((s, r) => s + yearlyEquivalent(r.amount, r.frequency), 0)

  // Répartition par catégorie (donut) — mois courant, filtrée par portée si sélectionnée
  const byCategory = new Map<string, DonutSegment>()
  for (const e of filteredMonthExpenses) {
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
          <h1 className="text-2xl font-bold tracking-tight">Dépenses</h1>
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
          <h2 className="font-semibold text-sm">Dépenses récentes</h2>
          {expenses.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">Aucune dépense enregistrée</p>
          ) : (
            <div className="space-y-1.5 max-h-[420px] overflow-y-auto pr-1">
              {expenses.map((e) => (
                <div key={e.id} className="flex items-center gap-3 py-1.5 group">
                  <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: e.category?.color ?? "#94a3b8" }} />
                  <span className="flex-1 text-sm truncate min-w-0">{e.label}</span>
                  <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${e.scope === "PRO" ? "bg-indigo-500/15 text-indigo-600" : "bg-slate-500/15 text-slate-600"}`}>
                    {e.scope === "PRO" ? "Pro" : "Perso"}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(e.date).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                  </span>
                  <span className="shrink-0 text-sm font-medium tabular-nums w-16 text-right">{fmt(e.amount)} €</span>
                  <ExpenseDialog
                    categories={categories}
                    expense={{ id: e.id, label: e.label, amount: e.amount, date: e.date, scope: e.scope, categoryId: e.categoryId, notes: e.notes }}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Dépenses récurrentes */}
      <div className="rounded-xl border border-border/50 bg-card p-5 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h2 className="font-semibold text-sm">Dépenses récurrentes</h2>
          <div className="flex items-center gap-2">
            <form action={async () => { "use server"; await generatePendingRecurringExpenses() }}>
              <button type="submit" className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-muted transition-colors">
                <Repeat className="h-3.5 w-3.5" />
                Générer les dépenses en attente
              </button>
            </form>
            <RecurringExpenseDialog categories={categories} />
          </div>
        </div>

        {recurringExpenses.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">Aucune dépense récurrente pour l&apos;instant</p>
        ) : (
          <div className="divide-y divide-border/50">
            {recurringExpenses.map((r) => (
              <div key={r.id} className={`flex items-center gap-3 py-3 group ${!r.isActive ? "opacity-50" : ""}`}>
                <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: r.category?.color ?? "#94a3b8" }} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{r.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {r.category?.name ?? "Sans catégorie"} · {FREQUENCY_LABELS[r.frequency]} · {r._count.expenses} générée{r._count.expenses > 1 ? "s" : ""}
                  </p>
                </div>
                <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${r.scope === "PRO" ? "bg-indigo-500/15 text-indigo-600" : "bg-slate-500/15 text-slate-600"}`}>
                  {r.scope === "PRO" ? "Pro" : "Perso"}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground whitespace-nowrap">
                  Prochaine : {new Date(r.nextGenerationDate).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}
                </span>
                <span className="shrink-0 text-sm font-medium tabular-nums w-16 text-right">{fmt(r.amount)} €</span>
                <form action={async () => { "use server"; await toggleRecurringExpenseActive(r.id, !r.isActive) }}>
                  <button type="submit" className="text-muted-foreground hover:text-foreground transition-colors" title={r.isActive ? "Mettre en pause" : "Réactiver"}>
                    {r.isActive ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                  </button>
                </form>
                <RecurringExpenseDialog
                  categories={categories}
                  recurringExpense={{
                    id: r.id, label: r.label, amount: r.amount, scope: r.scope, frequency: r.frequency,
                    nextGenerationDate: r.nextGenerationDate, categoryId: r.categoryId, notes: r.notes,
                  }}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-border/50 bg-card p-5 space-y-3">
        <h2 className="font-semibold text-sm">Catégories</h2>
        <ExpenseCategoryManager initialCategories={categories} />
      </div>
    </div>
  )
}
