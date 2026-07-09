"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Plus, Pencil, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog"
import { createExpense, updateExpense, deleteExpense, createRecurringExpense } from "@/actions/expense"
import { ExpenseCategoryCombobox, type ExpenseCategory } from "./ExpenseCategoryCombobox"
import { FREQUENCY_LABELS } from "./RecurringExpenseDialog"

export type ExpenseForEdit = {
  id: string
  label: string
  amount: number
  date: Date | string
  scope: "PRO" | "PERSO"
  categoryId: string | null
  notes: string | null
}

export function ExpenseDialog({
  categories,
  expense,
}: {
  categories: ExpenseCategory[]
  expense?: ExpenseForEdit
}) {
  const router = useRouter()
  const isEdit = !!expense
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [isDeleting, startDelete] = useTransition()

  const [label, setLabel]           = useState(expense?.label ?? "")
  const [amount, setAmount]         = useState(expense ? String(expense.amount) : "")
  const [date, setDate]             = useState(() => new Date(expense?.date ?? new Date()).toISOString().slice(0, 10))
  const [scope, setScope]           = useState<"PRO" | "PERSO">(expense?.scope ?? "PERSO")
  const [categoryId, setCategoryId] = useState(expense?.categoryId ?? "")
  const [notes, setNotes]           = useState(expense?.notes ?? "")
  const [frequency, setFrequency]   = useState<"ONETIME" | "WEEKLY" | "MONTHLY" | "QUARTERLY" | "YEARLY">("MONTHLY")
  const isRecurring = frequency !== "ONETIME"

  function resetForm() {
    setLabel("")
    setAmount("")
    setDate(new Date().toISOString().slice(0, 10))
    setScope("PERSO")
    setCategoryId("")
    setNotes("")
    setFrequency("MONTHLY")
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const amountNum = parseFloat(amount.replace(",", "."))
    if (!label.trim() || !date || !amountNum || amountNum <= 0) return

    const shared = {
      label: label.trim(),
      amount: amountNum,
      scope,
      categoryId: categoryId || null,
      notes: notes.trim() || null,
    }

    startTransition(async () => {
      if (isEdit) {
        await updateExpense(expense.id, { ...shared, date: new Date(`${date}T00:00:00`) })
      } else if (isRecurring) {
        await createRecurringExpense({ ...shared, frequency, nextGenerationDate: new Date(`${date}T00:00:00`) })
      } else {
        await createExpense({ ...shared, date: new Date(`${date}T00:00:00`) })
      }
      if (!isEdit) resetForm()
      setOpen(false)
      router.refresh()
    })
  }

  function handleDelete() {
    if (!expense) return
    startDelete(async () => {
      await deleteExpense(expense.id)
      setOpen(false)
      router.refresh()
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {isEdit ? (
        <DialogTrigger
          render={<button className="text-muted-foreground hover:text-foreground transition-colors opacity-0 group-hover:opacity-100" title="Modifier" />}
        >
          <Pencil className="h-3.5 w-3.5" />
        </DialogTrigger>
      ) : (
        <DialogTrigger render={<Button size="sm" className="gap-1.5" />}>
          <Plus className="h-3.5 w-3.5" />
          Ajouter une dépense
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Modifier la dépense" : "Nouvelle dépense"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Libellé</label>
            <Input value={label} onChange={e => setLabel(e.target.value)} placeholder="Courses, essence, forfait mobile…" required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Montant (€)</label>
              <Input type="text" inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" required />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">{!isEdit && isRecurring ? "Prochaine échéance" : "Date"}</label>
              <Input type="date" value={date} onChange={e => setDate(e.target.value)} required />
            </div>
          </div>

          {!isEdit && (
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Fréquence</label>
              <select
                value={frequency}
                onChange={e => setFrequency(e.target.value as typeof frequency)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="ONETIME">Ponctuelle</option>
                {Object.entries(FREQUENCY_LABELS).filter(([v]) => v !== "CUSTOM").map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Portée</label>
              <select
                value={scope}
                onChange={e => setScope(e.target.value as "PRO" | "PERSO")}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="PERSO">Perso</option>
                <option value="PRO">Pro</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Catégorie</label>
              <ExpenseCategoryCombobox categories={categories} value={categoryId} onChange={setCategoryId} />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Notes (optionnel)</label>
            <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Détail, référence…" />
          </div>

          <div className="flex items-center justify-between pt-1">
            {isEdit ? (
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                className="flex items-center gap-1.5 text-xs text-red-600 hover:text-red-700 disabled:opacity-50 transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Supprimer
              </button>
            ) : <span />}
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>Annuler</Button>
              <Button type="submit" size="sm" disabled={isPending}>
                {isPending ? "Enregistrement…" : isEdit ? "Enregistrer" : "Ajouter"}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
