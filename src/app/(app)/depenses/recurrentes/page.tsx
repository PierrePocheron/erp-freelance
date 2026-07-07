import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import Link from "next/link"
import { ChevronLeft, Repeat, Play, Pause } from "lucide-react"
import { getOrCreateDefaultExpenseCategories, toggleRecurringExpenseActive, generatePendingRecurringExpenses } from "@/actions/expense"
import { RecurringExpenseDialog, FREQUENCY_LABELS } from "@/components/modules/depenses/RecurringExpenseDialog"

const fmt = (n: number) => n.toLocaleString("fr-FR", { maximumFractionDigits: 0 })

export default async function RecurringExpensesPage() {
  const session = await auth()
  const userId = session!.user.id

  const [categories, recurringExpenses] = await Promise.all([
    getOrCreateDefaultExpenseCategories(),
    prisma.recurringExpense.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
      include: {
        category: { select: { id: true, name: true, color: true } },
        _count: { select: { expenses: true } },
      },
    }),
  ])

  return (
    <div className="space-y-6">
      <div>
        <Link href="/depenses" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-3">
          <ChevronLeft className="h-4 w-4" /> Dépenses
        </Link>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Dépenses récurrentes</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Loyer, abonnements, assurances… générées mois après mois
            </p>
          </div>
          <div className="flex items-center gap-2">
            <form action={async () => { "use server"; await generatePendingRecurringExpenses() }}>
              <button type="submit" className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:bg-muted transition-colors">
                <Repeat className="h-3.5 w-3.5" />
                Générer les dépenses en attente
              </button>
            </form>
            <RecurringExpenseDialog categories={categories} />
          </div>
        </div>
      </div>

      {recurringExpenses.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/50 p-8 text-center space-y-1">
          <Repeat className="h-6 w-6 text-muted-foreground mx-auto" />
          <p className="text-sm text-muted-foreground">Aucune dépense récurrente pour l&apos;instant</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border/50 bg-card divide-y divide-border/50">
          {recurringExpenses.map((r) => (
            <div key={r.id} className={`flex items-center gap-3 p-4 group ${!r.isActive ? "opacity-50" : ""}`}>
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
  )
}
