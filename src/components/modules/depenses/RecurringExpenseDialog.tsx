"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Plus, Pencil, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog"
import { createRecurringExpense, updateRecurringExpense, deleteRecurringExpense } from "@/actions/expense"
import type { ExpenseCategory } from "./ExpenseCategoryManager"

export const FREQUENCY_LABELS: Record<string, string> = {
  WEEKLY: "Hebdomadaire",
  MONTHLY: "Mensuelle",
  QUARTERLY: "Trimestrielle",
  YEARLY: "Annuelle",
  CUSTOM: "Personnalisée",
}

export type RecurringExpenseForEdit = {
  id: string
  label: string
  amount: number
  scope: "PRO" | "PERSO"
  frequency: "WEEKLY" | "MONTHLY" | "QUARTERLY" | "YEARLY" | "CUSTOM"
  nextGenerationDate: Date | string
  categoryId: string | null
  notes: string | null
}

export function RecurringExpenseDialog({
  categories,
  recurringExpense,
}: {
  categories: ExpenseCategory[]
  recurringExpense?: RecurringExpenseForEdit
}) {
  const router = useRouter()
  const isEdit = !!recurringExpense
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [isDeleting, startDelete] = useTransition()

  const [label, setLabel]         = useState(recurringExpense?.label ?? "")
  const [amount, setAmount]       = useState(recurringExpense ? String(recurringExpense.amount) : "")
  const [nextDate, setNextDate]   = useState(() => new Date(recurringExpense?.nextGenerationDate ?? new Date()).toISOString().slice(0, 10))
  const [scope, setScope]         = useState<"PRO" | "PERSO">(recurringExpense?.scope ?? "PERSO")
  const [frequency, setFrequency] = useState(recurringExpense?.frequency ?? "MONTHLY")
  const [categoryId, setCategoryId] = useState(recurringExpense?.categoryId ?? "")
  const [notes, setNotes]         = useState(recurringExpense?.notes ?? "")

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const amountNum = parseFloat(amount.replace(",", "."))
    if (!label.trim() || !nextDate || !amountNum || amountNum <= 0) return

    const payload = {
      label: label.trim(),
      amount: amountNum,
      scope,
      frequency,
      nextGenerationDate: new Date(`${nextDate}T00:00:00`),
      categoryId: categoryId || null,
      notes: notes.trim() || null,
    }

    startTransition(async () => {
      if (isEdit) {
        await updateRecurringExpense(recurringExpense.id, payload)
      } else {
        await createRecurringExpense(payload)
      }
      setOpen(false)
      router.refresh()
    })
  }

  function handleDelete() {
    if (!recurringExpense) return
    startDelete(async () => {
      await deleteRecurringExpense(recurringExpense.id)
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
          Ajouter une dépense récurrente
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Modifier la dépense récurrente" : "Nouvelle dépense récurrente"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Libellé</label>
            <Input value={label} onChange={e => setLabel(e.target.value)} placeholder="Loyer, Internet, Assurance…" required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Montant (€)</label>
              <Input type="text" inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" required />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Fréquence</label>
              <select
                value={frequency}
                onChange={e => setFrequency(e.target.value as typeof frequency)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                {Object.entries(FREQUENCY_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Prochaine échéance</label>
              <Input type="date" value={nextDate} onChange={e => setNextDate(e.target.value)} required />
            </div>
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
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Catégorie</label>
            <select
              value={categoryId}
              onChange={e => setCategoryId(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="">Sans catégorie</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
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
