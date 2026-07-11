"use client"

import { useState, useTransition } from "react"
import { Plus, Trash2, CheckCircle2 } from "lucide-react"
import { recordPayment, deletePayment } from "@/actions/facturation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

type Payment = {
  id: string
  amount: number
  paidAt: Date
  note: string | null
}

function fmtEur(n: number) {
  return n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €"
}

function fmtDate(d: Date) {
  return new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })
}

export function InvoicePaymentSection({
  invoiceId,
  userId,
  netAmount,
  payments,
  isPaid,
}: {
  invoiceId: string
  userId: string
  netAmount: number
  payments: Payment[]
  isPaid: boolean
}) {
  const [showForm, setShowForm] = useState(false)
  const [amount, setAmount] = useState("")
  const [paidAt, setPaidAt] = useState(new Date().toISOString().split("T")[0])
  const [note, setNote] = useState("")
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const totalPaid = payments.reduce((s, p) => s + p.amount, 0)
  const remaining = Math.max(0, netAmount - totalPaid)
  const progress = netAmount > 0 ? Math.min(100, (totalPaid / netAmount) * 100) : 100

  function openForm() {
    setAmount(remaining > 0 ? remaining.toFixed(2) : "")
    setPaidAt(new Date().toISOString().split("T")[0])
    setNote("")
    setShowForm(true)
  }

  function handleRecord() {
    const amt = parseFloat(amount)
    if (!amt || !paidAt) return
    startTransition(async () => {
      await recordPayment(invoiceId, userId, { amount: amt, paidAt, note: note || undefined })
      setShowForm(false)
    })
  }

  function handleDelete(paymentId: string) {
    startTransition(async () => {
      await deletePayment(paymentId, invoiceId, userId)
      setConfirmDelete(null)
    })
  }

  return (
    <div className="rounded-xl border border-border/50 bg-card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-sm">Paiements reçus</h2>
        {!showForm && (
          <button
            type="button"
            onClick={openForm}
            className="flex items-center gap-1 text-xs text-primary hover:underline"
          >
            <Plus className="h-3 w-3" />
            Enregistrer un paiement
          </button>
        )}
      </div>

      {/* Barre de progression */}
      <div className="space-y-1.5">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{fmtEur(totalPaid)} payé</span>
          <span>Total dû : {fmtEur(netAmount)}</span>
        </div>
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${isPaid ? "bg-emerald-500" : progress > 0 ? "bg-primary" : ""}`}
            style={{ width: `${progress}%` }}
          />
        </div>
        {isPaid ? (
          <p className="text-xs text-emerald-600 flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" /> Intégralement payée
          </p>
        ) : remaining > 0 ? (
          <p className="text-xs text-muted-foreground">Reste à percevoir : <span className="font-medium text-foreground">{fmtEur(remaining)}</span></p>
        ) : null}
      </div>

      {/* Liste des paiements */}
      {payments.length > 0 ? (
        <div className="space-y-1">
          {payments.map((p) => (
            <div key={p.id} className="flex items-center gap-3 py-1.5 text-sm group border-b border-border/40 last:border-0">
              <span className="text-muted-foreground text-xs w-28 shrink-0">{fmtDate(p.paidAt)}</span>
              <span className="font-medium tabular-nums">{fmtEur(p.amount)}</span>
              {p.note
                ? <span className="text-xs text-muted-foreground flex-1 truncate">{p.note}</span>
                : <span className="flex-1" />}
              {confirmDelete === p.id ? (
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleDelete(p.id)}
                    disabled={isPending}
                    className="text-xs text-red-500 hover:text-red-600 font-medium"
                  >
                    Confirmer
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(null)}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    Annuler
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(p.id)}
                  className="md:opacity-0 md:group-hover:opacity-100 focus:opacity-100 text-muted-foreground hover:text-destructive transition-opacity shrink-0"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground italic">Aucun paiement enregistré</p>
      )}

      {/* Formulaire */}
      {showForm && (
        <div className="rounded-lg border border-border/60 bg-muted/20 p-3 space-y-3">
          <p className="text-xs font-medium">Nouveau paiement</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Montant (€) *</label>
              <Input
                type="number"
                min="0.01"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="h-8"
                autoFocus
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Date *</label>
              <Input
                type="date"
                value={paidAt}
                onChange={(e) => setPaidAt(e.target.value)}
                className="h-8"
              />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Note (optionnel)</label>
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Virement, chèque, paiement partiel…"
              className="h-8"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setShowForm(false)}>
              Annuler
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={isPending || !amount || !paidAt}
              onClick={handleRecord}
            >
              {isPending ? "Enregistrement…" : "Enregistrer"}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
