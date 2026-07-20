import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getOrCreateDefaultExpenseCategories, generatePendingRecurringExpenses } from "@/actions/expense"
import { DepensesView } from "@/components/modules/depenses/DepensesView"

export default async function DepensesPage() {
  const session = await auth()
  const userId = session!.user.id

  // Les occurrences récurrentes échues se matérialisent automatiquement à
  // l'ouverture de la page (comme markLateInvoices côté facturation).
  await generatePendingRecurringExpenses()

  // Toutes les dépenses sont chargées d'un coup (volume faible) : la
  // navigation entre mois et le filtre Pro/Perso se font ensuite côté client
  // dans DepensesView, sans aller-retour serveur — c'est ce qui rend le
  // changement de mois instantané.
  const [categories, expenses, recurringExpenses] = await Promise.all([
    getOrCreateDefaultExpenseCategories(),
    prisma.expense.findMany({
      where: { userId },
      orderBy: { date: "asc" },
      include: {
        category: { select: { id: true, name: true, color: true } },
        recurringExpense: { select: { id: true, frequency: true, isActive: true } },
      },
    }),
    prisma.recurringExpense.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
      include: {
        category: { select: { id: true, name: true, color: true } },
      },
    }),
  ])

  return (
    <DepensesView
      categories={categories}
      expenses={expenses}
      recurringExpenses={recurringExpenses}
    />
  )
}
